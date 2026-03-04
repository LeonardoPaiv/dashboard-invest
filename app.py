import streamlit as st
import pandas as pd
import plotly.express as px
import google.generativeai as genai
import os
from dotenv import load_dotenv

from utils.parser import parse_investment_xlsx, clean_currency
from utils.history import save_to_history, get_equity_history, get_latest_history_content
from utils.settings import load_settings, save_settings
from utils.scraper import fetch_fii_data, fetch_stock_data, save_scraped_cache, merge_with_scraped_cache, fetch_rankings
from utils.financial_plan import load_financial_plan, save_financial_plan, calculate_projection

# Configurações iniciais
load_dotenv()
st.set_page_config(page_title="Investment Dashboard", layout="wide", page_icon="📊")

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
# ------------------------------------
# ------------------------------------

# Configuração do Gemini
# ... (rest of Gemini config remains same)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    st.sidebar.warning("⚠️ Chave da API do Gemini não encontrada.")

# Sidebar
st.sidebar.title("Configurações")
uploaded_file = st.sidebar.file_uploader("Upload da Carteira (.xlsx)", type=["xlsx"])

st.sidebar.markdown("---")
query = st.sidebar.text_input("Dúvida sobre seus investimentos?", placeholder="Ex: Qual minha maior posição?")

# Processamento do Arquivo
data = None
file_content = None

if uploaded_file:
    file_content = uploaded_file.read()
    if 'last_uploaded' not in st.session_state or st.session_state.last_uploaded != uploaded_file.name:
        save_to_history(uploaded_file.name, file_content)
        st.session_state.last_uploaded = uploaded_file.name
    st.sidebar.success("✅ Arquivo carregado e salvo!")
else:
    latest_name, historical_content = get_latest_history_content()
    if historical_content:
        file_content = historical_content
        st.sidebar.info(f"📂 Carregado do histórico: {latest_name}")

if file_content:
    try:
        if 'portfolio_data' not in st.session_state or uploaded_file:
            pd_data = parse_investment_xlsx(file_content)
            # Mesclar com os dados salvos anteriormente (Cache) para continuidade
            st.session_state.portfolio_data = merge_with_scraped_cache(pd_data)
        data = st.session_state.portfolio_data
    except Exception as e:
        st.sidebar.error(f"Erro ao processar arquivo: {str(e)}")

# Botão de Scaper na Sidebar
if data:
    st.sidebar.markdown("---")
    st.sidebar.subheader("🔄 Dados em Tempo Real")
    if st.sidebar.button("Atualizar via Investidor10"):
        progress_bar = st.sidebar.progress(0)
        status_text = st.sidebar.empty()
        
        total_items = len(data['fiis']) + len(data['acoes'])
        processed = 0
        
        if not data['fiis'].empty:
            for idx, row in data['fiis'].iterrows():
                ticker = row['Ticker']
                status_text.text(f"Scraping FII: {ticker}")
                scraped = fetch_fii_data(ticker)
                if scraped:
                    data['fiis'].at[idx, 'DY_Site'] = scraped['DY']
                    data['fiis'].at[idx, 'P_VP_Site'] = scraped['P/VP']
                    data['fiis'].at[idx, 'Cotacao_Site'] = scraped['Cotação']
                    data['fiis'].at[idx, 'Segmento'] = scraped['Segmento']
                processed += 1
                progress_bar.progress(processed / total_items)
        
        if not data['acoes'].empty:
            for idx, row in data['acoes'].iterrows():
                ticker = row['Ticker']
                status_text.text(f"Scraping Ação: {ticker}")
                scraped = fetch_stock_data(ticker)
                if scraped:
                    data['acoes'].at[idx, 'DY_Site'] = scraped['DY']
                    data['acoes'].at[idx, 'PL_Site'] = scraped['P/L']
                    data['acoes'].at[idx, 'Variacao_Site'] = scraped['Variação']
                    data['acoes'].at[idx, 'Cotacao_Site'] = scraped['Cotação']
                    data['acoes'].at[idx, 'Segmento'] = scraped['Segmento']
                processed += 1
                progress_bar.progress(processed / total_items)
        
        st.session_state.portfolio_data = data
        save_scraped_cache(data)  # Persiste os novos dados encontrados
        status_text.text("✅ Atualização concluída!")
        st.sidebar.success("Dados atualizados via Web Scraper!")

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
    
# Lógica do Gemini com contexto dos dados
if query and data:
    if GEMINI_API_KEY:
        with st.spinner("Consultando Gemini..."):
            try:
                contexto = f"O usuário possui R$ {total_live:,.2f} investidos (valor de mercado atualizado). "
                contexto += f"FIIs: {len(data['fiis'])} ativos. Ações: {len(data['acoes'])} ativos. "
                prompt = f"Contexto: {contexto}\n\nPergunta: {query}"
                response = model.generate_content(prompt)
                st.sidebar.info(f"**Insight do Gemini:**\n\n{response.text}")
            except Exception as e:
                st.sidebar.error(f"Erro ao consultar Gemini: {str(e)}")

# Conteúdo Principal
st.title("📊 Painel de Investimentos")

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
                    st.info("💡 Faça o upload de novos arquivos para alimentar o histórico.")
            else:
                st.info("💡 Histórico vazio. Faça upload para começar.")

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
                st.warning("Nenhum dado encontrado para este filtro.")

        # --- QUADRANTE 3: Rankings de Ativos (Webscraping Investidor 10) ---
        with row2_col1:
            st.subheader("🥇 Rankings do Mercado")
            if st.button("🔄 Atualizar Rankings (Investidor 10)", use_container_width=True):
                with st.spinner("Conectando ao Investidor 10..."):
                    rk_data = fetch_rankings()
                    if rk_data:
                        st.session_state.rk_cache = rk_data
                        st.success("Rankings atualizados!")
                    else:
                        st.error("Falha ao buscar rankings.")
            
            if 'rk_cache' in st.session_state:
                rk = st.session_state.rk_cache
                rtab1, rtab2, rtab3 = st.tabs(["Div. Yield", "Val. Mercado", "Receita"])
                
                with rtab1:
                    df_rk1 = pd.DataFrame(rk.get("Maiores Dividend Yield", []))
                    if not df_rk1.empty: st.dataframe(df_rk1, hide_index=True, use_container_width=True)
                with rtab2:
                    df_rk2 = pd.DataFrame(rk.get("Maiores Valor de Mercado", []))
                    if not df_rk2.empty: st.dataframe(df_rk2, hide_index=True, use_container_width=True)
                with rtab3:
                    df_rk3 = pd.DataFrame(rk.get("Maiores Receitas", []))
                    if not df_rk3.empty: st.dataframe(df_rk3, hide_index=True, use_container_width=True)
            else:
                st.info("Clique no botão acima para carregar o scraping do Investidor 10.")

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
            
            # Necessário calcular antes para o Comparativo nas colunas combinadas
            at_fiis = (data['fiis']['Posicao_Live'].sum() / total_live) * 100 if total_live > 0 else 0
            at_acoes = (data['acoes']['Posicao_Live'].sum() / total_live) * 100 if total_live > 0 else 0
            at_rf = ((data['renda_fixa']['Posicao_Live'].sum() + data['tesouro']['Posicao_Live'].sum()) / total_live) * 100 if total_live > 0 else 0
            
            c1, c2, c3, c4 = st.columns([1.5, 1, 1.5, 1.2])
            
            with c1:
                st.markdown("##### 📜 Política de Investimentos")
                nova_est = st.text_area("Sua estratégia", value=settings.get("estrategia", ""), height=255, label_visibility="collapsed")
                
            with c2:
                st.markdown("##### 🎯 Alvos (%)")
                alvos = settings.get("alvos", {"fiis": 33.3, "acoes": 33.3, "renda_fixa": 33.4})
                a_fiis = st.number_input("FIIs", 0.0, 100.0, float(alvos.get("fiis")))
                a_acoes = st.number_input("Ações", 0.0, 100.0, float(alvos.get("acoes")))
                a_rf = st.number_input("Renda Fixa", 0.0, 100.0, float(alvos.get("renda_fixa")))
                st.markdown("<div style='margin-top: 10px;'></div>", unsafe_allow_html=True)
                if st.button("💾 Salvar Alvos", use_container_width=True):
                    save_settings({"estrategia": nova_est, "alvos": {"fiis": a_fiis, "acoes": a_acoes, "renda_fixa": a_rf}})
                    st.success("Salvo!")
            
            with c3:
                st.markdown("##### ⚖️ Comparativo Atual/Alvo")
                df_comp = pd.DataFrame({
                    'Categoria': ['FIIs', 'Ações', 'R. Fixa'],
                    'Atual (%)': [at_fiis, at_acoes, at_rf],
                    'Alvo (%)': [a_fiis, a_acoes, a_rf]
                })
                fig_comp = px.bar(df_comp, y='Categoria', x=['Atual (%)', 'Alvo (%)'], barmode='group', orientation='h')
                fig_comp.update_layout(margin=dict(l=0, r=0, t=0, b=0), height=230, legend={"yanchor": "bottom", "y": 1.02, "xanchor": "right", "x": 1})
                st.plotly_chart(fig_comp, use_container_width=True)
                
            with c4:
                st.markdown("##### 💰 Aporte (IA)")
                str_apporto = "Valor Planejado (R$)"
                aporte_valor = st.number_input(str_apporto, min_value=0.0, value=1000.0, step=100.0)
                st.markdown("<div style='min-height: 120px;'></div>", unsafe_allow_html=True)
                btn_sugestao = st.button("💡 Gerar Sugestão Rápida", use_container_width=True, type="primary")

            st.markdown("---")
            st.subheader("🤖 Consulta e Sugestões do Assistente")
            
            # Inicializa histórico de chat
            if "strategy_chat" not in st.session_state:
                st.session_state.strategy_chat = []
                
            # Mostra o histórico
            for msg in st.session_state.strategy_chat:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"])
            
            user_input = st.chat_input("Ou digite uma dúvida / instrução livre sobre a sua estratégia...")
            
            final_user_input = None
            if btn_sugestao:
                final_user_input = "Analise minha carteira atual e o meu valor de aporte disponível. Me forneça uma sugestão estruturada (em tópicos ou tabela resumida) de onde eu devo aportar para equilibrar meus investimentos com base nos meus alvos definidos."
            elif user_input:
                final_user_input = user_input
            
            if final_user_input:
                st.session_state.strategy_chat.append({"role": "user", "content": final_user_input})
                with st.chat_message("user"):
                    st.markdown(final_user_input)
                
                with st.chat_message("assistant"):
                    with st.spinner("Analisando sua carteira e estratégia..."):
                        if GEMINI_API_KEY:
                            try:
                                str_fiis = data['fiis'][['Ticker', 'Posicao_Live']].to_string(index=False) if not data['fiis'].empty else "Nenhum FII"
                                str_acoes = data['acoes'][['Ticker', 'Posicao_Live']].to_string(index=False) if not data['acoes'].empty else "Nenhuma Ação"
                                
                                resumo_carteira = (
                                    f"- Total Investido: R$ {total_live:,.2f}\n"
                                    f"- FIIs: {at_fiis:.1f}% (Alvo: {a_fiis}%)\nPosições Atuais:\n{str_fiis}\n\n"
                                    f"- Ações: {at_acoes:.1f}% (Alvo: {a_acoes}%)\nPosições Atuais:\n{str_acoes}\n\n"
                                    f"- Renda Fixa: {at_rf:.1f}% (Alvo: {a_rf}%)\n"
                                )
                                
                                prompt_completo = (
                                    f"Você é um consultor financeiro especialista.\n"
                                    f"O usuário enviou a seguinte mensagem/solicitação: '{final_user_input}'\n\n"
                                    f"--- CONTEXTO ---\n"
                                    f"Política/estratégia atual: {nova_est}\n"
                                    f"Valor p/ Aporte: R$ {aporte_valor:,.2f}\n\n"
                                    f"Carteira atual (% e posições):\n{resumo_carteira}\n\n"
                                    f"--- INSTRUÇÕES ---\n"
                                    f"1. Responda diretamente à mensagem do usuário.\n"
                                    f"2. Se ele pedir uma sugestão de aporte, recomende uma distruibuição clara do valor (R$ {aporte_valor:,.2f}) com foco no rebalanceamento dos Alvos definidos, informando os ativos pontualmente e usando tabelas (Markdown) ou uma lista de tópicos curtos para que fique BEM visual e fácil de ler na interface.\n"
                                    f"3. Respeite sempre a 'Política/estratégia' do usuário.\n"
                                    f"4. Siga um tom consultivo, prático e amigável. Seja conciso e evite grandes parágrafos de introdução/conclusão.\n"
                                )
                                
                                history_context = "Histórico da conversa:\n"
                                for m in st.session_state.strategy_chat[-7:-1]:
                                    history_context += f"{'Usuário' if m['role'] == 'user' else 'Consultor'}: {m['content']}\n"
                                
                                final_prompt = f"{history_context}\n{prompt_completo}"
                                
                                response = model.generate_content(final_prompt)
                                st.markdown(response.text)
                                st.session_state.strategy_chat.append({"role": "assistant", "content": response.text})
                            except Exception as e:
                                st.error(f"Erro ao consultar Gemini: {str(e)}")
                        else:
                            st.warning("⚠️ Chave da API do Gemini não está configurada (.env).")

        with etab2:
            st.subheader("Projeção de Longo Prazo")
            if 'plan_data' not in st.session_state:
                st.session_state.plan_data = load_financial_plan()
            
            plan = st.session_state.plan_data
            cp1, cp2 = st.columns([3, 1])
            with cp2:
                r_mensal = st.number_input("Rentabilidade Mensal (%)", 0.0, 5.0, float(plan.get("expected_return_monthly", 0.8)), step=0.1)
                p_ini = st.number_input("Patrimônio Inicial (R$)", 0.0, None, float(total_live if plan.get("initial_equity", 0) == 0 else plan.get("initial_equity")))
                a_proj = st.slider("Anos", 1, 40, int(plan.get("projection_years", 10)))
                
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
                st.info("Nenhum registro de dividendos encontrado.")

else:
    st.info("👋 Por favor, faça o upload do seu arquivo de ativos (.xlsx) para começar a análise.")
