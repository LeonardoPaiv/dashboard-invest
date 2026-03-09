import streamlit as st
import pandas as pd
import plotly.express as px
import os
import time
from dotenv import load_dotenv

from utils.parser import parse_investment_xlsx, clean_currency
from utils.history import save_to_history, get_equity_history, get_latest_history_content
from utils.settings import load_settings, save_settings
from utils.scraper import fetch_fii_data, fetch_stock_data, save_scraped_cache, merge_with_scraped_cache
from utils.financial_plan import load_financial_plan, save_financial_plan, calculate_projection
from utils.notes import load_snapshots, save_snapshot, delete_snapshot
from utils.custom_lists import load_custom_lists, save_custom_lists, add_list, delete_list, add_item_to_list, remove_item_from_list, rename_list
from utils.storage import get_data, save_data, initialize_state, export_all_data, import_all_data, save_to_browser
from datetime import datetime, timedelta, timezone

# Configurações iniciais
load_dotenv()
st.set_page_config(page_title="Investment Dashboard", layout="wide", page_icon="📊")

# Inicializa o storage do navegador
initialize_state()

# --- Funções Auxiliares de Cálculo ---
def get_live_position(df):
    """
    Calcula a posição atualizada com base na cotação do site ou original.
    """
    df = df.copy()
    
    # Garantir que todas as colunas essenciais sejam numéricas
    for col in ['Quantidade', 'Posicao', 'Cotacao']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # RECOVER: Se Posicao é 0 mas temos Quantidade e Cotacao, calcular Posicao
    if 'Posicao' in df.columns and 'Quantidade' in df.columns and 'Cotacao' in df.columns:
        mask = (df['Posicao'] == 0) & (df['Quantidade'] > 0) & (df['Cotacao'] > 0)
        df.loc[mask, 'Posicao'] = df.loc[mask, 'Quantidade'] * df.loc[mask, 'Cotacao']
    
    if 'Cotacao_Site' in df.columns:
        # Converter cotação do site para float
        df['Cotacao_Float'] = df['Cotacao_Site'].apply(clean_currency)
        # Se cotação do site falhou ou é 0, usar a original (já garantida float acima)
        df['Cotacao_Final'] = df.apply(lambda r: r['Cotacao_Float'] if r['Cotacao_Float'] > 0 else r['Cotacao'], axis=1)
        # Recalcular Posição Live: Quantidade * Cotação Final
        df['Posicao_Live'] = df['Quantidade'] * df['Cotacao_Final']
        # Se por algum motivo Posicao_Live ficou 0 mas temos Posicao original, usar Posicao
        df['Posicao_Live'] = df.apply(lambda r: r['Posicao'] if r['Posicao_Live'] == 0 else r['Posicao_Live'], axis=1)
    else:
        df['Posicao_Live'] = df['Posicao']
        
    return df
# ------------------------------------
def generate_rebalance_prompt(data, total_live, targets, current_alloc, aporte, estrategia):
    """
    Gera um prompt estruturado para ser usado em modelos de IA (LLMs) para análise de rebalanceamento.
    """
    prompt = f"### 🤖 Prompt de Rebalanceamento Estratégico\n\n"
    prompt += "Atue como um analista de investimentos sênior. Baseado nos dados abaixo, sugira como devo alocar meu novo aporte para rebalancear minha carteira de acordo com meus alvos.\n\n"
    
    prompt += f"**💰 Valor para investir agora:** R$ {aporte:,.2f}\n"
    prompt += f"**📈 Patrimônio Total Atual:** R$ {total_live:,.2f}\n"
    prompt += f"**📜 Minha Estratégia:** {estrategia if estrategia else 'Não definida'}\n\n"
    
    prompt += "#### 🎯 Alvos vs Atual:\n"
    prompt += f"- **Ações:** Alvo {targets['acoes']:.1f}% | Atual {current_alloc['acoes']:.1f}%\n"
    prompt += f"- **FIIs:** Alvo {targets['fiis']:.1f}% | Atual {current_alloc['fiis']:.1f}%\n"
    prompt += f"- **Renda Fixa:** Alvo {targets['rf']:.1f}% | Atual {current_alloc['rf']:.1f}%\n\n"
    
    prompt += "#### 📄 Minhas Posições Atuais:\n"
    
    if not data['acoes'].empty:
        prompt += "**Ações:**\n"
        for _, row in data['acoes'].iterrows():
            prompt += f"- {row['Ticker']}: R$ {row['Posicao_Live']:,.2f} ({row.get('Segmento', 'N/A')})\n"
    
    if not data['fiis'].empty:
        prompt += "\n**FIIs:**\n"
        for _, row in data['fiis'].iterrows():
            prompt += f"- {row['Ticker']}: R$ {row['Posicao_Live']:,.2f} ({row.get('Segmento', 'N/A')})\n"
            
    prompt += "\n**Instruções para a IA:**\n"
    prompt += "1. Identifique qual classe de ativo está mais abaixo do alvo.\n"
    prompt += "2. Dentro dessa classe, sugira onde alocar os R$ {aporte:,.2f} baseando-se em manter a diversificação por segmento.\n"
    prompt += "3. Apresente o resultado final projetado da carteira após o aporte.\n"
    
    return prompt
# ------------------------------------

# --- Sidebar ---

# Sidebar
st.sidebar.title("Configurações")

# --- Seção de Dados ---
with st.sidebar.expander("📁 Importar / Exportar Dados", expanded=False):
    st.markdown("### Exportar")
    if st.button("Gerar Arquivo de Backup"):
        data_json = export_all_data()
        st.download_button(
            label="Download Backup (.json)",
            data=data_json,
            file_name=f"invest_backup_{datetime.now().strftime('%Y%m%d')}.json",
            mime="application/json"
        )
    
    st.markdown("---")
    st.markdown("### Importar")
    import_file = st.file_uploader("Upload de Backup (.json)", type=["json"])
    if import_file:
        if st.button("Confirmar Importação"):
            if import_all_data(import_file.read().decode('utf-8')):
                st.success("✅ Dados importados com sucesso! Recarregando...")
                st.rerun()
            else:
                st.error("❌ Erro ao importar dados.")

st.sidebar.markdown("---")
uploaded_file = st.sidebar.file_uploader("Upload da Carteira (.xlsx)", type=["xlsx"])

# --- Modelo de Arquivo ---
with st.sidebar.expander("📄 Modelo de Arquivo"):
    st.markdown("""
    O padrão do arquivo segue o **export de carteira da corretora XP Investimentos**. 
    Se você usa outra plataforma, deve seguir o modelo para que o sistema consiga ler as informações corretamente.
    """)
    # Link manual para o CSV de exemplo (será criado a seguir)
    with open("templates/modelo_carteira.csv", "r", encoding="utf-8") as f:
        st.download_button(
            label="Baixar Modelo CSV",
            data=f.read(),
            file_name="modelo_carteira_xp.csv",
            mime="text/csv"
        )

# Processamento do Arquivo
data = None
file_content = None

if uploaded_file:
    file_content = uploaded_file.read()
    if 'last_uploaded' not in st.session_state or st.session_state.last_uploaded != uploaded_file.name:
        save_to_history(uploaded_file.name, file_content)
        st.session_state.last_uploaded = uploaded_file.name
    st.toast("✅ Arquivo carregado e salvo!")
else:
    latest_name, historical_content = get_latest_history_content()
    if historical_content:
        file_content = historical_content
        st.toast(f"📂 Carregado do histórico: {latest_name}")

if file_content:
    try:
        if 'portfolio_data' not in st.session_state or uploaded_file:
            pd_data = parse_investment_xlsx(file_content)
            # Mesclar com os dados salvos anteriormente (Cache) para continuidade
            st.session_state.portfolio_data = merge_with_scraped_cache(pd_data)
        data = st.session_state.portfolio_data
    except Exception as e:
        st.toast(f"❌ Erro ao processar arquivo: {str(e)}")

# Botão de Scaper na Sidebar
if data:
    st.sidebar.markdown("---")
    st.sidebar.subheader("🔄 Dados em Tempo Real")
    if st.sidebar.button("Atualizar via Investidor10"):
        st.session_state.trigger_manual_update = True
        st.rerun()

if data:
    # APLICAR CÁLCULOS LIVE EM TODOS OS DATAFRAMES
    data['fiis'] = get_live_position(data['fiis'])
    data['acoes'] = get_live_position(data['acoes'])
    data['tesouro'] = get_live_position(data['tesouro'])
    data['renda_fixa'] = get_live_position(data['renda_fixa'])

    # Recalcular Total Investido Live
    total_live = (data['fiis']['Posicao_Live'].sum() + 
                  data['acoes']['Posicao_Live'].sum() + 
                  data['tesouro']['Posicao_Live'].sum() + 
                  data['renda_fixa']['Posicao_Live'].sum())
    resumo = data['resumo']

# --- Funções de Controle de Horário e Atualização ---
def is_in_update_window():
    """Verifica se está no horário de atualização (10h às 17h Brasília)"""
    tz_brt = timezone(timedelta(hours=-3))
    now_brt = datetime.now(tz_brt)
    return 10 <= now_brt.hour < 17

# ------------------------------------
# ------------------------------------
# ------------------------------------

# --- Lógica de Auto-Update (5 minutos) ---
UPDATE_INTERVAL = 5 # minutos
if 'last_update' not in st.session_state:
    st.session_state.last_update = datetime.now() - timedelta(minutes=UPDATE_INTERVAL + 1) # Forçar primeira atualização

if 'trigger_manual_update' not in st.session_state:
    st.session_state.trigger_manual_update = False

if 'show_update_toast' not in st.session_state:
    st.session_state.show_update_toast = False

next_update_time = st.session_state.last_update + timedelta(minutes=UPDATE_INTERVAL)
is_updating = False

def perform_global_update():
    global data
    # Atualizar Portfolio (Investidor 10)
    if data:
        total_items = len(data['fiis']) + len(data['acoes'])
        if not data['fiis'].empty:
            for idx, row in data['fiis'].iterrows():
                scraped = fetch_fii_data(row['Ticker'])
                if scraped:
                    data['fiis'].at[idx, 'DY_Site'] = scraped['DY']
                    data['fiis'].at[idx, 'P_VP_Site'] = scraped['P/VP']
                    data['fiis'].at[idx, 'Cotacao_Site'] = scraped['Cotação']
                    data['fiis'].at[idx, 'Segmento'] = scraped['Segmento']
        
        if not data['acoes'].empty:
            for idx, row in data['acoes'].iterrows():
                scraped = fetch_stock_data(row['Ticker'])
                if scraped:
                    data['acoes'].at[idx, 'DY_Site'] = scraped['DY']
                    data['acoes'].at[idx, 'PL_Site'] = scraped['P/L']
                    data['acoes'].at[idx, 'Variacao_Site'] = scraped['Variação']
                    data['acoes'].at[idx, 'Cotacao_Site'] = scraped['Cotação']
                    data['acoes'].at[idx, 'Segmento'] = scraped['Segmento']
        
        st.session_state.portfolio_data = data
        save_scraped_cache(data)

    # Atualizar Listas Customizadas
    custom_lists_to_update = load_custom_lists()
    for l_data in custom_lists_to_update:
        id_list = l_data['id']
        updated_items = []
        for item in l_data['items']:
            ticker = item['ticker']
            scraped = fetch_stock_data(ticker) if item['type'] == "Ação" else fetch_fii_data(ticker)
            if scraped:
                if item['type'] == "Ação":
                    updated_items.append({'Ticker': ticker, 'Cotação': scraped.get('Cotação'), 'DY': scraped.get('DY', 'N/A'), 'P/L': scraped.get('P/L', 'N/A')})
                else:
                    updated_items.append({'Ticker': ticker, 'Cotação': scraped.get('Cotação'), 'DY': scraped.get('DY', 'N/A'), 'P/VP': scraped.get('P/VP', 'N/A')})
            else:
                updated_items.append({'Ticker': ticker, 'Cotação': 'Erro', 'DY': 'N/A'})
        st.session_state[f"list_cache_{id_list}"] = updated_items
    
    st.session_state.last_update = datetime.now()

# Conteúdo Principal
t_col1, t_col2 = st.columns([6, 1])
with t_col1:
    st.title("📊 Painel de Investimentos")
with t_col2:
    st.write("") # alinhamento
    st.write("") # alinhamento
    status_placeholder = st.empty()
    last_up_str = st.session_state.last_update.strftime("%H:%M")
    if is_in_update_window():
        next_up_str = (st.session_state.last_update + timedelta(minutes=UPDATE_INTERVAL)).strftime("%H:%M")
        status_help = f"Última atualização: {last_up_str}\nPróxima automática: {next_up_str}"
    else:
        status_help = f"Última atualização: {last_up_str}\nAuto-update pausado (horário permitido: 10h-17h Brasília)"
    status_placeholder.markdown(f"### ℹ️", help=status_help)

if st.session_state.show_update_toast:
    st.toast("✅ Dados atualizados com sucesso!", icon="✨")
    st.session_state.show_update_toast = False

# (Auto-refresh trigger moved to bottom)

# Navegação Centralizada
col_nav1, col_nav2, col_nav3 = st.columns([1, 1, 1])
with col_nav2:
    page = st.radio("Selecione a Página", ["📊 Dashboard", "🎯 Estratégia"], horizontal=True, label_visibility="collapsed")

st.markdown("---")

if data:
    if page == "📊 Dashboard":
        # Métricas principales atualizadas
        m1, m2, m3 = st.columns(3)
        m1.metric("Total Investido (Mercado)", f"R$ {total_live:,.2f}")
        m2.metric("Saldo Disponível", f"R$ {resumo.get('saldo_disponivel', 0):,.2f}")
        m3.metric("Saldo Projetado", f"R$ {resumo.get('saldo_projetado', 0):,.2f}")

        st.markdown("---")

        # GRID LAYOUT
        row1_col1, row1_col2 = st.columns(2)
        row2_col1, row2_col2 = st.columns(2)

        # --- QUADRANTE 1: Evolução Patrimonial (12 Meses) ---
        with row1_col1:
            st.subheader("📈 Evolução Patrimonial (Ult. 12m)")
            df_history = get_equity_history()
            if not df_history.empty:
                # Filtrar últimos 12 meses
                limit_date = pd.Timestamp.now() - pd.DateOffset(months=12)
                df_history_12m = df_history[df_history['Data'] >= limit_date].copy()
                
                if not df_history_12m.empty:
                    # Garantir que temos pelo menos uma barra por mês no gráfico
                    fig_evo = px.bar(df_history_12m, x='Data', y='Total', 
                                     labels={'Total': 'Patrimônio Total (R$)', 'Data': 'Mês/Ano'},
                                     color_discrete_sequence=['#00CC96'],
                                     text_auto='.2s')
                    fig_evo.update_layout(showlegend=False, margin=dict(l=10, r=10, t=10, b=10))
                    st.plotly_chart(fig_evo, use_container_width=True)
                else:
                    st.toast("💡 Faça o upload de novos arquivos para alimentar o histórico.", icon="ℹ️")
            else:
                st.toast("💡 Histórico vazio. Faça upload para começar.", icon="ℹ️")

        # --- QUADRANTE 2: Gráfico de Ativos com Filtros Dinâmicos ---
        with row1_col2:
            st.subheader("🔍 Composição da Carteira")
            
            # Filtros dinâmicos em uma linha compacta
            f_cols = st.columns(2)
            with f_cols[0]:
                tipo_filtro = st.selectbox("Classe de Ativo", ["Todos", "Ações", "FIIs", "Renda Fixa"])
            
            # Preparar dados base
            df_view = pd.DataFrame()
            if tipo_filtro == "Todos":
                list_dfs = []
                if not data['fiis'].empty: list_dfs.append(data['fiis'].assign(Categoria='FIIs'))
                if not data['acoes'].empty: list_dfs.append(data['acoes'].assign(Categoria='Ações'))
                if not data['tesouro'].empty: list_dfs.append(data['tesouro'].assign(Categoria='Renda Fixa', Ticker=data['tesouro']['Titulo']))
                if not data['renda_fixa'].empty: list_dfs.append(data['renda_fixa'].assign(Categoria='Renda Fixa', Ticker=data['renda_fixa']['Ativo']))
                if list_dfs: df_view = pd.concat(list_dfs, ignore_index=True)
                group_col = 'Categoria'
            elif tipo_filtro == "Ações":
                df_view = data['acoes'].assign(Categoria='Ações')
                group_col = 'Segmento' if 'Segmento' in df_view.columns else 'Ticker'
            elif tipo_filtro == "FIIs":
                df_view = data['fiis'].assign(Categoria='FIIs')
                group_col = 'Segmento' if 'Segmento' in df_view.columns else 'Ticker'
            else: # Renda Fixa
                list_rf = []
                if not data['tesouro'].empty: list_rf.append(data['tesouro'].assign(Ticker=data['tesouro']['Titulo']))
                if not data['renda_fixa'].empty: list_rf.append(data['renda_fixa'].assign(Ticker=data['renda_fixa']['Ativo']))
                if list_rf: df_view = pd.concat(list_rf, ignore_index=True)
                group_col = 'Ticker'

            # Filtro de Segmento (se aplicável)
            if tipo_filtro in ["Ações", "FIIs"] and not df_view.empty and 'Segmento' in df_view.columns:
                with f_cols[1]:
                    segmentos = ["Todos os Segmentos"] + sorted([s for s in df_view['Segmento'].unique() if pd.notna(s)])
                    seg_selecionado = st.selectbox("Filtrar Segmento", segmentos)
                    if seg_selecionado != "Todos os Segmentos":
                        df_view = df_view[df_view['Segmento'] == seg_selecionado]
                        group_col = 'Ticker'

            if not df_view.empty:
                df_plot = df_view.groupby(group_col)['Posicao_Live'].sum().reset_index().sort_values('Posicao_Live', ascending=False)
                fig_assets = px.pie(df_plot, values='Posicao_Live', names=group_col, hole=.5, 
                                   color_discrete_sequence=px.colors.qualitative.Prism)
                fig_assets.update_layout(margin=dict(l=10, r=10, t=10, b=10))
                st.plotly_chart(fig_assets, use_container_width=True)
            else:
                st.toast("⚠️ Nenhum dado encontrado para este filtro.", icon="⚠️")

        # --- QUADRANTE 3: Listas Personalizadas (CRUD + Webscraping) ---
        with row2_col1:
            st.subheader("🥇 Listas Personalizadas")
            
            # Carregar listas
            custom_lists = load_custom_lists()
            if 'list_offset' not in st.session_state:
                st.session_state.list_offset = 0
            visible_lists = custom_lists[st.session_state.list_offset : st.session_state.list_offset + 3]

            # Controles em uma linha: Seta Esq, Nova, Att Tudo, Seta Dir
            ctrl_c1, ctrl_c2, ctrl_c3, ctrl_c4 = st.columns([1, 2, 2, 1])
            with ctrl_c1:
                if st.button("⬅️", disabled=st.session_state.list_offset == 0, key="prev_list", use_container_width=True):
                    st.session_state.list_offset = max(0, st.session_state.list_offset - 1)
                    st.rerun()
            with ctrl_c2:
                if st.button("➕ Nova Lista", use_container_width=True):
                    add_list(f"Nova Lista {len(custom_lists) + 1}")
                    st.rerun()
            with ctrl_c3:
                if st.button("🔄 Atualizar Tudo", use_container_width=True, type="primary"):
                    st.session_state.trigger_manual_update = True
                    st.rerun()
            with ctrl_c4:
                if st.button("➡️", disabled=st.session_state.list_offset + 3 >= len(custom_lists), key="next_list", use_container_width=True):
                    st.session_state.list_offset = min(len(custom_lists) - 3, st.session_state.list_offset + 1)
                    st.rerun()
            
            st.markdown("---")

            # Renderizar Listas
            list_cols = st.columns(len(visible_lists)) if visible_lists else [st.empty()]
            
            for i, l_data in enumerate(visible_lists):
                id_list = l_data['id']
                with list_cols[i]:
                    # Header da Lista: Nome + Ações no menu de 3 pontos
                    t_col, m_col = st.columns([4, 1])
                    with t_col:
                        new_name = st.text_input("Nome", value=l_data['name'], key=f"name_{id_list}", label_visibility="collapsed")
                        if new_name != l_data['name']:
                            rename_list(id_list, new_name)
                            st.rerun()
                    with m_col:
                        with st.popover("⋮"):
                            st.markdown("**➕ Adicionar**")
                            new_ticker = st.text_input("Ticker", key=f"ticker_add_{id_list}").upper()
                            new_type = st.selectbox("Tipo", ["Ação", "FII"], key=f"type_add_{id_list}")
                            if st.button("Add", key=f"btn_add_{id_list}", use_container_width=True):
                                if new_ticker:
                                    add_item_to_list(id_list, new_ticker, new_type)
                                    st.session_state[f"list_cache_{id_list}"] = []
                                    st.rerun()
                            
                            st.divider()
                            st.markdown("**🗑️ Remover**")
                            if l_data['items']:
                                ticker_to_rem = st.selectbox("Ticker", [i['ticker'] for i in l_data['items']], key=f"rem_sel_{id_list}")
                                if st.button("Rem", key=f"btn_rem_{id_list}", use_container_width=True):
                                    remove_item_from_list(id_list, ticker_to_rem)
                                    st.session_state[f"list_cache_{id_list}"] = []
                                    st.rerun()
                            else:
                                st.caption("Vazio")
                                
                            st.divider()
                            if st.button("❌ Excluir Lista", key=f"del_list_{id_list}", type="primary", use_container_width=True):
                                delete_list(id_list)
                                st.rerun()

                    # Tabela de Dados
                    if f"list_cache_{id_list}" not in st.session_state:
                        st.session_state[f"list_cache_{id_list}"] = []
                    
                    cached_data = st.session_state[f"list_cache_{id_list}"]
                    if cached_data:
                        st.dataframe(pd.DataFrame(cached_data), hide_index=True, use_container_width=True)
                    else:
                        if l_data['items']:
                            st.dataframe(pd.DataFrame(l_data['items']), hide_index=True, use_container_width=True)
                        else:
                            st.caption("Lista vazia.")

        # --- QUADRANTE 4: Lista Detalhada Filtrada ---
        with row2_col2:
            st.subheader("📄 Detalhamento da Seleção")
            if not df_view.empty:
                cols_to_use = ['Ticker', 'Posicao_Live']
                if 'Quantidade' in df_view.columns: cols_to_use.insert(1, 'Quantidade')
                if 'Segmento' in df_view.columns: cols_to_use.append('Segmento')
                if 'DY_Site' in df_view.columns: cols_to_use.append('DY_Site')
                
                df_detalhe = df_view[cols_to_use].sort_values('Posicao_Live', ascending=False)
                st.dataframe(df_detalhe, use_container_width=True, hide_index=True)
            else:
                st.caption("Ajuste os filtros no quadrante acima para ver os ativos aqui.")

    elif page == "🎯 Estratégia":
        # Estrutura para a segunda página
        etab1, etab2, etab3 = st.tabs(["🎯 Alocação & Alvos", "🗓️ Planejamento e Projeções", "💰 Dividendos"])
        
        with etab1:
            settings = load_settings()
            # Necessário calcular para o prompt e snapshot
            at_fiis = (data['fiis']['Posicao_Live'].sum() / total_live) * 100 if total_live > 0 else 0
            at_acoes = (data['acoes']['Posicao_Live'].sum() / total_live) * 100 if total_live > 0 else 0
            at_rf = ((data['renda_fixa']['Posicao_Live'].sum() + data['tesouro']['Posicao_Live'].sum()) / total_live) * 100 if total_live > 0 else 0

            # --- ÁREA 1: Configuração & Notas ---
            c_config, c_notes = st.columns([1, 1.2]) # Re-alocando espaço
            
            with c_config:
                st.markdown("##### 🎯 Configurações de Alvos")
                alvos = settings.get("alvos", {"fiis": 33.3, "acoes": 33.3, "renda_fixa": 33.4})
                
                # Layout compacto para inputs
                cc1, cc2, cc3 = st.columns(3)
                a_fiis = cc1.number_input("FIIs (%)", 0.0, 100.0, float(alvos.get("fiis")), key="target_fiis")
                a_acoes = cc2.number_input("Ações (%)", 0.0, 100.0, float(alvos.get("acoes")), key="target_acoes")
                a_rf = cc3.number_input("R. Fixa (%)", 0.0, 100.0, float(alvos.get("renda_fixa")), key="target_rf")
                
                st.markdown("##### 💰 Aporte Atual")
                aporte_valor = st.number_input("Valor para Investir (R$)", min_value=0.0, value=1000.0, step=100.0, key="aporte_input_strat")
                
                st.markdown("##### 📜 Política de Investimentos")
                nova_est = st.text_area("Sua estratégia", value=settings.get("estrategia", ""), height=100, label_visibility="collapsed", placeholder="Ex: Foco em dividendos e crescimento de longo prazo.")
                
                if st.button("💾 Salvar Configurações", use_container_width=True):
                    save_settings({"estrategia": nova_est, "alvos": {"fiis": a_fiis, "acoes": a_acoes, "renda_fixa": a_rf}})
                    st.toast("✅ Configurações salvas!")
                
                st.markdown("---")
                if st.button("📸 Capturar Snapshot e Criar Nota", use_container_width=True, type="primary"):
                    new_snap = {
                        "portfolio_total": total_live,
                        "aporte": aporte_valor,
                        "targets": {"fiis": a_fiis, "acoes": a_acoes, "rf": a_rf},
                        "current": {"fiis": at_fiis, "acoes": at_acoes, "rf": at_rf},
                        "result": "" 
                    }
                    save_snapshot(new_snap)
                    st.toast("Snapshot capturado!", icon="✅")
                
                st.markdown("---")
                st.markdown("##### 🤖 Gerador de Prompt (Deep Research)")
                full_prompt = generate_rebalance_prompt(
                    data, 
                    total_live, 
                    {"fiis": a_fiis, "acoes": a_acoes, "rf": a_rf},
                    {"fiis": at_fiis, "acoes": at_acoes, "rf": at_rf},
                    aporte_valor, 
                    nova_est
                )
                with st.expander("Visualizar Prompt para Copiar"):
                    st.code(full_prompt, language="markdown")
                    st.caption("💡 Copie o texto acima e cole em uma ferramenta de IA para obter uma análise detalhada.")

            with c_notes:
                st.markdown("##### 📓 Notas e Resultados de Research")
                snapshots = load_snapshots()
                
                if not snapshots:
                    st.caption("Ainda não há snapshots salvos.")
                
                for idx, snap in enumerate(snapshots):
                    with st.expander(f"📍 {snap.get('date')} (R$ {snap.get('aporte'):,.0f})"):
                        col_info, col_res = st.columns([1, 1.5])
                        
                        with col_info:
                            st.write(f"**Patrimônio:** R$ {snap.get('portfolio_total'):,.0f}")
                            st.write(f"**Alvos:** F:{snap['targets']['fiis']}% | A:{snap['targets']['acoes']}%")
                            if st.button(f"🗑️", key=f"del_{snap['id']}"):
                                delete_snapshot(snap['id'])
                                st.rerun()
                        
                        with col_res:
                            res_key = f"res_{snap['id']}"
                            current_res = snap.get('result', '')
                            new_res = st.text_area("Research Result:", value=current_res, height=150, key=res_key, label_visibility="collapsed")
                            
                            if new_res != current_res:
                                all_snaps = load_snapshots()
                                for s in all_snaps:
                                    if s['id'] == snap['id']:
                                        s['result'] = new_res
                                        break
                                save_data("snapshots", all_snaps)
                                st.rerun()
                            
                            if current_res:
                                st.markdown("---")
                                st.markdown(current_res)

        with etab2:
            st.subheader("Projeção de Longo Prazo")
            if 'plan_data' not in st.session_state:
                st.session_state.plan_data = load_financial_plan()
            
            plan = st.session_state.plan_data
            cp1, cp2 = st.columns([3, 1])
            with cp2:
                r_mensal = st.number_input("Rentabilidade Mensal (%)", 0.0, 5.0, float(plan.get("expected_return_monthly", 0.8)), step=0.1, key="plan_return")
                p_ini = st.number_input("Patrimônio Inicial (R$)", 0.0, None, float(total_live if plan.get("initial_equity", 0) == 0 else plan.get("initial_equity")), key="plan_initial")
                a_proj = st.slider("Anos", 1, 40, int(plan.get("projection_years", 10)), key="plan_years")
                
                if (r_mensal != plan.get("expected_return_monthly") or p_ini != plan.get("initial_equity") or a_proj != plan.get("projection_years")):
                    plan.update({"expected_return_monthly": r_mensal, "initial_equity": p_ini, "projection_years": a_proj})
                    save_financial_plan(plan)

            with cp1:
                df_plan = pd.DataFrame(plan.get("monthly_data", []))
                edit_plan = st.data_editor(df_plan, use_container_width=True)
                if not edit_plan.equals(df_plan):
                    plan["monthly_data"] = edit_plan.to_dict('records')
                    save_financial_plan(plan)
                    st.rerun()
            
            _, df_proj = calculate_projection(plan, current_equity=total_live, years=a_proj)
            st.plotly_chart(px.area(df_proj, x='Período', y='Patrimônio Acumulado (R$)', title="Simulação de Juros Compostos"), use_container_width=True)

        with etab3:
            st.subheader("Histórico de Proventos")
            if not data['dividendos'].empty:
                st.dataframe(data['dividendos'], use_container_width=True)
                st.metric("Total Acumulado", f"R$ {data['dividendos']['Valor'].sum():,.2f}")
            else:
                st.caption("Nenhum registro de dividendos encontrado.")

else:
    st.info("👋 Por favor, faça o upload do seu arquivo de ativos (.xlsx) para começar a análise.")

# --- Execução de Atualização em Segundo Plano (No final para não bloquear o render) ---
if (is_in_update_window() and datetime.now() >= next_update_time) or st.session_state.trigger_manual_update:
    is_updating = True
    with status_placeholder:
        with st.spinner("Atualizando..."):
            perform_global_update()
            if st.session_state.trigger_manual_update:
                st.session_state.show_update_toast = True
    st.session_state.trigger_manual_update = False
    is_updating = False
    st.rerun()

# Gatilho de auto-update suave para a próxima atualização automática
@st.fragment(run_every=60) # Checar a cada minuto se é hora de atualizar
def auto_refresh_trigger():
    if is_in_update_window() and datetime.now() >= next_update_time:
        st.rerun()

auto_refresh_trigger()

# --- Sincronização Final com LocalStorage ---
if st.session_state.get('sync_required', False):
    save_to_browser(st.session_state.app_data)
    st.session_state.sync_required = False
