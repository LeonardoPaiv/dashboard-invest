import pandas as pd
import io
import re

def clean_currency(value):
    if pd.isna(value) or value == '-':
        return 0.0
    if isinstance(value, str):
        # Remove R$, dots (thousands separator) and replace comma with dot (decimal separator)
        value = value.replace('R$', '').replace('.', '').replace(',', '.').strip()
        try:
            return float(value)
        except ValueError:
            return 0.0
    return float(value)

def clean_percentage(value):
    if pd.isna(value) or value == '-':
        return 0.0
    if isinstance(value, str):
        value = value.replace('%', '').replace(',', '.').strip()
        try:
            return float(value) / 100.0
        except ValueError:
            return 0.0
    return float(value)

def parse_fii_section(df_raw, start_row):
    end = start_row
    while end < len(df_raw) and not pd.isna(df_raw.iloc[end, 0]) and df_raw.iloc[end, 0] != " ":
        end += 1
    
    # Mapeamento para FIIs: 
    # Index 0: Ticker, Index 1: Posicao, Index 2: Alocacao, Index 6: Cotacao, Index 7: Quantidade
    df = df_raw.iloc[start_row:end, [0, 1, 2, 6, 7]]
    df.columns = ['Ticker', 'Posicao', 'Alocacao', 'Cotacao', 'Quantidade']
    
    df['Posicao'] = df['Posicao'].apply(clean_currency)
    df['Alocacao'] = df['Alocacao'].apply(clean_percentage)
    df['Cotacao'] = df['Cotacao'].apply(clean_currency)
    df['Quantidade'] = df['Quantidade'].apply(clean_currency)
    return df, end

def parse_acoes_section(df_raw, start_row):
    end = start_row
    while end < len(df_raw) and not pd.isna(df_raw.iloc[end, 0]) and df_raw.iloc[end, 0] != " ":
        end += 1
    
    # Mapeamento para Ações:
    # Index 0: Ticker, Index 1: Posicao, Index 2: Alocacao, Index 4: Cotacao, Index 5: Quantidade
    df = df_raw.iloc[start_row:end, [0, 1, 2, 4, 5]]
    df.columns = ['Ticker', 'Posicao', 'Alocacao', 'Cotacao', 'Quantidade']
    
    df['Posicao'] = df['Posicao'].apply(clean_currency)
    df['Alocacao'] = df['Alocacao'].apply(clean_percentage)
    df['Cotacao'] = df['Cotacao'].apply(clean_currency)
    df['Quantidade'] = df['Quantidade'].apply(clean_currency)
    return df, end

def parse_dividend_section(df_raw, start_row):
    end = start_row
    while end < len(df_raw) and not pd.isna(df_raw.iloc[end, 0]) and df_raw.iloc[end, 0] != " ":
        end += 1
    
    # Tabela de Dividendos costuma ter Ticker, Tipo, Data Com, Pagamento, Valor
    # Vamos pegar as 5 primeiras colunas
    df = df_raw.iloc[start_row:end, :5]
    df.columns = ['Ticker', 'Tipo', 'Data Com', 'Pagamento', 'Valor']
    df['Valor'] = df['Valor'].apply(clean_currency)
    return df, end

def parse_tesouro_section(df_raw, start_row):
    end = start_row
    while end < len(df_raw) and not pd.isna(df_raw.iloc[end, 0]) and df_raw.iloc[end, 0] != " ":
        end += 1
    
    df = df_raw.iloc[start_row:end, [0, 1, 2, 3, 4]]
    df.columns = ['Titulo', 'Posicao', 'Alocacao', 'Total Aplicado', 'Quantidade']
    
    df['Posicao'] = df['Posicao'].apply(clean_currency)
    df['Alocacao'] = df['Alocacao'].apply(clean_percentage)
    df['Total Aplicado'] = df['Total Aplicado'].apply(clean_currency)
    df['Quantidade'] = df['Quantidade'].apply(clean_currency)
    return df, end

def parse_renda_fixa_section(df_raw, start_row):
    end = start_row
    while end < len(df_raw) and not pd.isna(df_raw.iloc[end, 0]) and df_raw.iloc[end, 0] != " ":
        end += 1
    
    df = df_raw.iloc[start_row:end, [0, 1, 2, 3, 7, 8]]
    df.columns = ['Ativo', 'Posicao', 'Alocacao', 'Valor Aplicado', 'Vencimento', 'Quantidade']
    
    df['Posicao'] = df['Posicao'].apply(clean_currency)
    df['Alocacao'] = df['Alocacao'].apply(clean_percentage)
    df['Valor Aplicado'] = df['Valor Aplicado'].apply(clean_currency)
    df['Quantidade'] = df['Quantidade'].apply(clean_currency)
    return df, end

def parse_investment_xlsx(file_content):
    df_raw = pd.read_excel(io.BytesIO(file_content), engine='openpyxl', header=None)
    
    data = {
        'resumo': {},
        'fiis': pd.DataFrame(),
        'tesouro': pd.DataFrame(),
        'acoes': pd.DataFrame(),
        'renda_fixa': pd.DataFrame(),
        'dividendos': pd.DataFrame()
    }
    
    try:
        data['resumo']['total_investido'] = clean_currency(df_raw.iloc[3, 0])
        data['resumo']['saldo_disponivel'] = clean_currency(df_raw.iloc[3, 1])
        data['resumo']['saldo_projetado'] = clean_currency(df_raw.iloc[3, 2])
    except:
        pass

    current_section = None
    is_dividend_area = False
    i = 0
    while i < len(df_raw):
        row = df_raw.iloc[i]
        cell_val = str(row[0]).strip()
        
        # Detectar mudança para área de dividendos
        if "Dividendos e JDP" in cell_val or "Dividendos" in cell_val:
            is_dividend_area = True
        
        if not is_dividend_area:
            if "Fundos Imobiliários" in cell_val:
                current_section = 'fiis'
            elif "Tesouro Direto" in cell_val:
                current_section = 'tesouro'
            elif "Ações" in cell_val:
                current_section = 'acoes'
            elif "Renda Fixa" in cell_val and "R$" in str(row[6]):
                current_section = 'renda_fixa'

            if current_section == 'fiis' and "Fundos Listados" in cell_val:
                data['fiis'], next_i = parse_fii_section(df_raw, i + 1)
                i = next_i
                current_section = None
                continue
            elif current_section == 'tesouro' and ("Prefixado" in cell_val or "Pós-Fixado" in cell_val):
                df_t, next_i = parse_tesouro_section(df_raw, i + 1)
                data['tesouro'] = pd.concat([data['tesouro'], df_t])
                i = next_i
            elif current_section == 'acoes' and "Renda Variável Brasil" in cell_val:
                data['acoes'], next_i = parse_acoes_section(df_raw, i + 1)
                i = next_i
                current_section = None
                continue
            elif current_section == 'renda_fixa' and "Prefixado" in cell_val:
                data['renda_fixa'], next_i = parse_renda_fixa_section(df_raw, i + 1)
                i = next_i
                current_section = None
                continue
        else:
            # Estamos na área de dividendos
            if ("Fundos Imobiliários" in cell_val or "Ações" in cell_val) and "Ticker" in str(df_raw.iloc[i+1, 0]):
                df_div, next_i = parse_dividend_section(df_raw, i + 2)
                data['dividendos'] = pd.concat([data['dividendos'], df_div])
                i = next_i
                continue
            
        i += 1

    return data
