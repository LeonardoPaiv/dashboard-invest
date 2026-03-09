import requests
import pandas as pd
from bs4 import BeautifulSoup
from utils.storage import get_data, save_data

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, hasattr(t, "innerHTML") ? t.innerHTML : t.textContent) Chrome/119.0.0.0 Safari/537.36'
}

def save_scraped_cache(data):
    """
    Saves only the 'site' and 'segmento' columns from FIIs and Stocks to a local cache.
    """
    cache = {
        'fiis': {},
        'acoes': {}
    }
    
    # Salva FIIs
    if 'fiis' in data and not data['fiis'].empty:
        cols = [c for c in data['fiis'].columns if '_Site' in c or c == 'Segmento']
        for _, row in data['fiis'].iterrows():
            ticker = row['Ticker']
            cache['fiis'][ticker] = {col: row[col] for col in cols if col in row and pd.notna(row[col])}
            
    # Salva Ações
    if 'acoes' in data and not data['acoes'].empty:
        cols = [c for c in data['acoes'].columns if '_Site' in c or c == 'Segmento']
        for _, row in data['acoes'].iterrows():
            ticker = row['Ticker']
            cache['acoes'][ticker] = {col: row[col] for col in cols if col in row and pd.notna(row[col])}
            
    save_data('scraped_cache', cache)

def merge_with_scraped_cache(data):
    """
    Merges existing data with cached scraper results if tickers match.
    """
    cache = get_data('scraped_cache')
    if not cache:
        return data
        
    try:
        # Merge FIIs
        if 'fiis' in data and not data['fiis'].empty:
            for idx, row in data['fiis'].iterrows():
                ticker = row['Ticker']
                if ticker in cache.get('fiis', {}):
                    for col, val in cache['fiis'][ticker].items():
                        # Só sobreescreve se o valor cacheado não for N/A
                        if val != "N/A":
                            data['fiis'].at[idx, col] = val
                        
        # Merge Ações
        if 'acoes' in data and not data['acoes'].empty:
            for idx, row in data['acoes'].iterrows():
                ticker = row['Ticker']
                if ticker in cache.get('acoes', {}):
                    for col, val in cache['acoes'][ticker].items():
                        if val != "N/A":
                            data['acoes'].at[idx, col] = val
    except Exception as e:
        print(f"Erro ao carregar cache de scraping: {e}")
        
    return data

def get_card_value(soup, label):
    try:
        cards = soup.find_all('div', class_='_card')
        for card in cards:
            title_span = card.find('span')
            if title_span and label.upper() in title_span.text.upper():
                value_div = card.find('div', class_='_card-body')
                if value_div:
                    val_span = value_div.find('span')
                    return val_span.text.strip() if val_span else value_div.text.strip()
    except Exception as e:
        print(f"Erro ao buscar {label}: {e}")
    return "N/A"

def get_info_value(soup, label):
    """
    Finds values in the 'Dados da Empresa' or 'Informações Gerais' sections.
    Common structure: <div class="cell"> <span class="name">Label</span> <span class="value">Value</span> </div>
    """
    try:
        # Tenta encontrar qualquer elemento que contenha o texto do label de forma exata (ignorando case e espaços)
        target = soup.find(lambda tag: tag.text and label.upper() == tag.text.strip().upper())
        
        # Se não achar exato, tenta conter
        if not target:
            target = soup.find(lambda tag: tag.text and label.upper() in tag.text.strip().upper() and len(tag.text.strip()) < 20)
            
        if target:
            # 1. Tenta no pai (div.cell ou div.info)
            parent = target.parent
            if parent:
                # Procura por span.value, strong, ou o segundo span no pai
                val = parent.find(class_=lambda x: x and ('value' in x or 'content' in x))
                if val and val != target:
                    return val.text.strip()
                
                # Se for uma estrutura de lista/grid, o valor pode ser o próximo elemento no pai
                all_spans = parent.find_all(['span', 'div', 'strong', 'a'], recursive=False)
                for i, s in enumerate(all_spans):
                    if s == target or target in s.descendants:
                        if i + 1 < len(all_spans):
                            return all_spans[i+1].text.strip()

            # 2. Tenta o próximo elemento irmão direto
            next_el = target.find_next_sibling()
            if next_el:
                return next_el.text.strip()
            
            # 3. Tenta o próximo elemento de texto próximo (BS4 find_next)
            # Evita pegar o próprio label se ele for um nó de texto
            potential_val = target.find_next(['span', 'div', 'strong', 'a'])
            if potential_val and potential_val.text.strip().upper() != label.upper():
                return potential_val.text.strip()

        # Fallback específico para FIIs (div.desc > span + strong)
        desc_divs = soup.find_all('div', class_='desc')
        for div in desc_divs:
            span = div.find('span')
            if span and label.upper() in span.text.upper():
                strong = div.find('strong')
                if strong:
                    return strong.text.strip()
                    
    except Exception as e:
        print(f"Erro no parser de info {label}: {e}")
    return "N/A"

def fetch_fii_data(ticker):
    url = f"https://investidor10.com.br/fiis/{ticker.lower()}/"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        data = {
            'Ticker': ticker.upper(),
            'Cotação': get_card_value(soup, "COTAÇÃO"),
            'DY': get_card_value(soup, "DY (12M)"),
            'P/VP': get_card_value(soup, "P/VP"),
            'Segmento': get_info_value(soup, "Segmento")
        }
        # Fallback for DY if label is slightly different
        if data['DY'] == "N/A":
            data['DY'] = get_card_value(soup, "DY")
            
        return data
    except Exception as e:
        print(f"Erro ao buscar FII {ticker}: {e}")
        return None

def fetch_stock_data(ticker):
    url = f"https://investidor10.com.br/acoes/{ticker.lower()}/"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        data = {
            'Ticker': ticker.upper(),
            'Cotação': get_card_value(soup, "COTAÇÃO"),
            'Variação': get_card_value(soup, "VARIAÇÃO"),
            'P/L': get_card_value(soup, "P/L"),
            'DY': get_card_value(soup, "DY"),
            'Segmento': get_info_value(soup, "Segmento")
        }
        return data
    except Exception as e:
        print(f"Erro ao buscar Ação {ticker}: {e}")
        return None

def fetch_rankings():
    """
    Scrapes the 'Rankings de Ativos' from Investidor 10 homepage.
    Returns a dictionary with categories: Maiores Dividend Yield, Maiores Valor de Mercado, Maiores Receitas.
    """
    url = "https://investidor10.com.br/"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        rankings = {}
        
        # O seletor provável para os rankings baseando-se no conteúdo lido anteriormente
        # As seções têm h3 com o título da categoria
        sections = soup.find_all('div', class_='ranking-list') # Chute baseado em padrões, mas vamos usar os H3
        
        # Alternativa: procurar pelos H3 e pegar o conteúdo seguinte
        categories = ["Maiores Dividend Yield", "Maiores Valor de Mercado", "Maiores Receitas"]
        
        for cat in categories:
            h3 = soup.find('h3', string=lambda t: t and cat in t)
            if h3:
                # O ranking está logo abaixo, geralmente em uma lista ou série de links
                items = []
                parent = h3.parent
                # Procura por links ou spans que contenham o ticker e o valor
                # No markdown vimos: [#1 Ticker Nome Valor]
                links = parent.find_all('a', href=True, limit=5)
                for link in links:
                    ticker_el = link.find('span', class_='ticker') or link.find('div', class_='ticker')
                    if not ticker_el:
                        # Tenta extrair do texto se não houver classe específica
                        text = link.text.strip().split()
                        if len(text) >= 2:
                            # Heurística simples: o ticker costuma ser a primeira palavra em caps
                            ticker = next((w for w in text if w.isupper() and len(w) >= 4 and len(w) <= 6), text[0])
                            # O valor costuma ser o último item (ex: 46,99% ou R$ 514,26 B)
                            value = " ".join(text[-2:]) if 'R$' in text[-2] else text[-1]
                            items.append({'Ticker': ticker, 'Valor': value})
                    else:
                        ticker = ticker_el.text.strip()
                        value_el = link.find('span', class_='value') or link.find('div', class_='value')
                        value = value_el.text.strip() if value_el else "N/A"
                        items.append({'Ticker': ticker, 'Valor': value})
                
                if not items:
                    # Fallback robusto usando o texto bruto do link se o find_all falhou nos filhos
                    for link in links:
                        # O texto costuma ter muita quebra de linha. Vamos limpar.
                        clean_text = " ".join(link.text.split())
                        # Ex: "#1 SCAR3 SÃO CARLOS 46,99%"
                        parts = clean_text.split()
                        if len(parts) >= 3:
                            # Procura o Ticker (palavra em caixa alta com 4-6 chars)
                            ticker = next((p for p in parts if p.isupper() and 4 <= len(p) <= 6), parts[1])
                            val = parts[-1]
                            if 'B' in parts or 'M' in parts: # Valor de mercado
                                val = " ".join(parts[-2:])
                            items.append({'Ticker': ticker, 'Valor': val})
                
                rankings[cat] = items[:5]
        
        return rankings
    except Exception as e:
        print(f"Erro ao buscar rankings: {e}")
        return None

