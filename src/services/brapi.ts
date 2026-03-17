import axios from 'axios';
import * as cheerio from 'cheerio';

const apiKey = import.meta.env.VITE_BRAPI_API_KEY;

// Use the proxy in dev, or the full URL in prod.
const BASE_URL = import.meta.env.DEV ? '' : 'https://brapi.dev';

export interface QuoteData {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  logourl: string;
  sector: string;
  priceEarnings?: number;
  priceToBook?: number;
  dividendYield?: number;
}

// Função de Scraping para Investidor10 - Focada apenas em P/VP e DY
const scrapeInvestidor10 = async (ticker: string, isFII: boolean) => {
  const url = isFII 
    ? `/i10/fiis/${ticker.toLowerCase()}/`
    : `/i10/acoes/${ticker.toLowerCase()}/`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);

    const getCardValue = (label: string) => {
      let value = '---';
      $('._card').each((_, el) => {
        const title = $(el).find('span').text().trim().toUpperCase();
        if (title.includes(label.toUpperCase())) {
          value = $(el).find('._card-body span').text().trim() || $(el).find('._card-body').text().trim();
        }
      });
      return value;
    };

    const parseBrazilianNumber = (val: string) => {
      if (!val || val === '---' || val === 'N/A') return undefined;
      const clean = val.replace('%', '').replace(/\./g, '').replace(',', '.').trim();
      const num = parseFloat(clean);
      return isNaN(num) ? undefined : num;
    };

    return {
      pvp: parseBrazilianNumber(getCardValue('P/VP')),
      dy: parseBrazilianNumber(getCardValue('DY'))
    };
  } catch (error) {
    console.error(`Erro no scraping do ticker ${ticker}:`, error);
    return null;
  }
};

export const fetchQuotes = async (symbols: string[], isManualLoad = false): Promise<QuoteData[]> => {
  if (symbols.length === 0) return [];
  
  const fetchPromises = symbols.map(async (symbol) => {
    const sanitizedSymbol = symbol.toUpperCase().replace('12', '11');
    const isFII = sanitizedSymbol.endsWith('11');
    
    try {
      // 1. BRA-PI: Responsável por Cotação e P/L
      const response = await axios.get(`${BASE_URL}/api/quote/${sanitizedSymbol}`, {
        params: {
          token: apiKey,
          fundamental: true // Garante P/L na raiz
        }
      });
      
      const r = response.data.results?.[0];
      if (!r) return null;

      const data: QuoteData = {
        symbol: r.symbol,
        shortName: r.shortName,
        regularMarketPrice: r.regularMarketPrice,
        regularMarketChangePercent: r.regularMarketChangePercent,
        logourl: r.logourl,
        sector: r.sector,
        priceEarnings: r.priceEarnings,
      };

      // 2. INVESTIDOR10: Responsável por P/VP e DY (Apenas no Load Manual)
      if (isManualLoad) {
        const scraped = await scrapeInvestidor10(sanitizedSymbol, isFII);
        if (scraped) {
          data.priceToBook = scraped.pvp;
          data.dividendYield = scraped.dy;
        }
      }

      return data;
    } catch (err: any) {
      console.error(`Erro ao buscar ticker ${symbol}:`, err);
      return null;
    }
  });

  const settleResults = await Promise.allSettled(fetchPromises);
  
  const results: QuoteData[] = [];
  settleResults.forEach((res) => {
    if (res.status === 'fulfilled' && res.value !== null) {
      results.push(res.value);
    }
  });

  return results;
};
