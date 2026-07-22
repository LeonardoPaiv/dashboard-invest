import * as XLSX from 'xlsx';
import { PortfolioData } from '../store/useInvestmentStore';

export interface ColumnMappingConfig {
  headerRowIndex: number;
  tickerCol: number;
  quantityCol: number;
  priceCol: number;
  categoryCol: number | null;
}

export interface DetectedFileStructure {
  sheetNames: string[];
  sheets: Record<string, any[][]>;
  activeSheet: string; // 'all' or sheet name
  rows: any[][];
  suggestedMapping: ColumnMappingConfig;
}

const TICKER_SYNONYMS = ['ticker', 'ativo', 'código', 'codigo', 'papel', 'instrumento', 'symbol', 'nome', 'especificação', 'especificacao', 'produto', 'emissor', 'título', 'titulo', 'descrição', 'descricao'];
const QUANTITY_SYNONYMS = ['quantidade', 'qtd', 'quant', 'cotas', 'posicao', 'posição', 'shares', 'quantity', 'unidades', 'quantidade disponível', 'quantidade disponivel'];
const PRICE_SYNONYMS = ['preço médio', 'preco medio', 'pm', 'preço', 'preco', 'cotação', 'cotacao', 'custo médio', 'custo medio', 'valor unitário', 'valor unitario', 'price', 'valor liq', 'valor bruto', 'custo total', 'valor atualizado', 'preço atualizado', 'preco atualizado', 'valor aplicado', 'saldo'];
const CATEGORY_SYNONYMS = ['tipo', 'categoria', 'classe', 'mercado', 'segmento', 'type', 'category', 'indexador'];

export async function parseRawFile(file: File): Promise<DetectedFileStructure> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  let sheets: Record<string, any[][]> = {};
  let sheetNames: string[] = [];

  if (extension === 'csv' || extension === 'txt') {
    const text = await file.text();
    const rows = parseCSVText(text);
    sheets['Sheet1'] = rows;
    sheetNames = ['Sheet1'];
  } else {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    sheetNames = workbook.SheetNames;
    sheetNames.forEach(name => {
      const ws = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      sheets[name] = data;
    });
  }

  // Default to 'all' if multiple sheets exist (e.g. B3 files with Ações, FIIs, Renda Fixa)
  const activeSheet = sheetNames.length > 1 ? 'all' : (sheetNames[0] || 'Sheet1');
  const rows = activeSheet === 'all'
    ? Object.values(sheets).flat()
    : (sheets[activeSheet] || []);
  const suggestedMapping = detectColumnMapping(rows);

  return {
    sheetNames,
    sheets,
    activeSheet,
    rows,
    suggestedMapping
  };
}

function parseCSVText(text: string): any[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Auto-detect delimiter: comma, semicolon, or tab
  const sample = lines.slice(0, 10).join('\n');
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';

  return lines.map(line => {
    const pattern = new RegExp(
      `(\\s*${delimiter}\\s*|\\r?\\n|\\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}\\r\\n]*))`,
      'gi'
    );
    const row: string[] = [];
    let matches;
    while ((matches = pattern.exec(line))) {
      const value = matches[2] ? matches[2].replace(/""/g, '"') : matches[3];
      row.push(value !== undefined ? value.trim() : '');
    }
    if (row.length === 0) {
      return line.split(delimiter).map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
    }
    return row;
  });
}

export function detectColumnMapping(rows: any[][]): ColumnMappingConfig {
  let headerRowIndex = 0;
  let tickerCol = 0;
  let quantityCol = 1;
  let priceCol = 2;
  let categoryCol: number | null = null;

  let bestHeaderScore = -1;

  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    let score = 0;
    let foundTicker = -1;
    let foundQty = -1;
    let foundPrice = -1;
    let foundCategory = -1;

    row.forEach((cell, colIndex) => {
      if (!cell) return;
      const str = String(cell).toLowerCase().trim();

      if (foundTicker === -1 && TICKER_SYNONYMS.some(syn => str.includes(syn))) {
        foundTicker = colIndex;
        score += 3;
      }
      if (foundQty === -1 && QUANTITY_SYNONYMS.some(syn => str.includes(syn))) {
        foundQty = colIndex;
        score += 3;
      }
      if (foundPrice === -1 && PRICE_SYNONYMS.some(syn => str.includes(syn))) {
        foundPrice = colIndex;
        score += 3;
      }
      if (foundCategory === -1 && CATEGORY_SYNONYMS.some(syn => str.includes(syn))) {
        foundCategory = colIndex;
        score += 2;
      }
    });

    if (score > bestHeaderScore && foundTicker !== -1) {
      bestHeaderScore = score;
      headerRowIndex = r;
      tickerCol = foundTicker;
      if (foundQty !== -1) quantityCol = foundQty;
      if (foundPrice !== -1) priceCol = foundPrice;
      if (foundCategory !== -1) categoryCol = foundCategory;
    }
  }

  return {
    headerRowIndex,
    tickerCol,
    quantityCol,
    priceCol,
    categoryCol
  };
}

const KNOWN_STOCK_11_UNITS = [
  'SAPR11', 'SANB11', 'TAEE11', 'KLBN11', 'ALUP11', 'BPAC11', 'SOMA11', 'ENGI11',
  'RPMG11', 'TIET11', 'CPLE11', 'CURY11', 'IGTI11', 'SULA11', 'BIDI11', 'BRPR11',
  'AESB11', 'ALLD11', 'ELET11', 'MODL11', 'PARD11', 'BMEB11', 'ALSO11', 'ANIM11',
  'VIVA11', 'QUAL11', 'DIRR11'
];

export function classifyAssetCategory(
  ticker: string,
  rawCategory?: string,
  sheetName?: string
): 'acoes' | 'fiis' | 'tesouro' | 'renda_fixa' {
  // 1. Sheet name context
  if (sheetName) {
    const sLower = sheetName.toLowerCase().trim();
    if (sLower.includes('renda fixa') || sLower.includes('rendafixa') || sLower.includes('debênture') || sLower.includes('debenture')) {
      return 'renda_fixa';
    }
    if (sLower.includes('tesouro')) {
      return 'tesouro';
    }
    if (sLower.includes('fundo') || sLower.includes('fii') || sLower.includes('imob')) {
      return 'fiis';
    }
    if (sLower.includes('ação') || sLower.includes('acao') || sLower.includes('ações') || sLower.includes('acoes')) {
      return 'acoes';
    }
  }

  // 2. Raw category cell context
  if (rawCategory) {
    const catLower = rawCategory.toLowerCase().trim();
    if (catLower.includes('fii') || catLower.includes('fundo imob') || catLower.includes('imobiliario') || catLower.includes('imobiliário')) return 'fiis';
    if (catLower.includes('ação') || catLower.includes('acao') || catLower.includes('equity') || catLower.includes('ações') || catLower.includes('unit')) return 'acoes';
    if (catLower.includes('tesouro') || catLower.includes('titulo publico') || catLower.includes('título público')) return 'tesouro';
    if (catLower.includes('fixa') || catLower.includes('debênture') || catLower.includes('debenture') || catLower.includes('cdb') || catLower.includes('lci') || catLower.includes('lca') || catLower.includes('cri') || catLower.includes('cra')) return 'renda_fixa';
  }

  const cleanTicker = ticker.trim().toUpperCase();

  // 3. Specific Renda Fixa / Debênture prefix checks
  if (
    cleanTicker.startsWith('DEB') ||
    cleanTicker.includes('DEBENTURE') ||
    cleanTicker.includes('DEBÊNTURE') ||
    cleanTicker.startsWith('CDB') ||
    cleanTicker.startsWith('LCI') ||
    cleanTicker.startsWith('LCA') ||
    cleanTicker.startsWith('CRI') ||
    cleanTicker.startsWith('CRA') ||
    cleanTicker.startsWith('LC ') ||
    cleanTicker.startsWith('RDB')
  ) {
    return 'renda_fixa';
  }

  // 4. Known Stock Units ending in 11 (SAPR11, SANB11, TAEE11, etc.)
  if (KNOWN_STOCK_11_UNITS.includes(cleanTicker)) {
    return 'acoes';
  }

  // 5. FII Suffixes (11, 11B)
  if (cleanTicker.endsWith('11') || cleanTicker.endsWith('11B')) {
    return 'fiis';
  }

  // 6. Stock Suffixes (3, 4, 5, 6, 33)
  if (/^[A-Z]{4}(3|4|5|6|33)$/.test(cleanTicker)) {
    return 'acoes';
  }

  // 7. Tesouro Direto titles
  if (cleanTicker.includes('TESOURO') || cleanTicker.includes('TD') || cleanTicker.includes('SELIC') || cleanTicker.includes('IPCA') || cleanTicker.includes('PREFIXADO')) {
    return 'tesouro';
  }

  // 8. Default fallback for standard stock symbols (4-6 chars)
  if (/^[A-Z0-9]{4,6}$/.test(cleanTicker)) {
    return 'acoes';
  }

  return 'renda_fixa';
}

export function parseNumberString(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;

  let str = String(val).trim();
  str = str.replace(/[R$\s]/g, '');

  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function convertRowsToPortfolioData(rows: any[][], mapping: ColumnMappingConfig, sheetName?: string): PortfolioData {
  const acoes: any[] = [];
  const fiis: any[] = [];
  const tesouro: any[] = [];
  const renda_fixa: any[] = [];

  const startRow = mapping.headerRowIndex + 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    const rawTicker = row[mapping.tickerCol];
    if (!rawTicker || String(rawTicker).trim() === '' || String(rawTicker).toLowerCase().includes('total')) continue;

    const ticker = String(rawTicker).trim().toUpperCase();
    const qty = parseNumberString(row[mapping.quantityCol]);
    const price = parseNumberString(row[mapping.priceCol]);

    if (qty <= 0 && price <= 0) continue;

    const rawCategory = mapping.categoryCol !== null ? String(row[mapping.categoryCol] || '') : undefined;
    const category = classifyAssetCategory(ticker, rawCategory, sheetName);

    const priceHeader = String(rows[mapping.headerRowIndex]?.[mapping.priceCol] || '').toLowerCase().trim();

    // Check if the price column header represents a TOTAL position value (e.g. Valor Atualizado, Valor Bruto, Valor Aplicado, Posição, Saldo)
    const isTotalValueCol = 
      priceHeader.includes('valor atualizado') ||
      priceHeader.includes('valor bruto') ||
      priceHeader.includes('valor liquido') ||
      priceHeader.includes('valor líquido') ||
      priceHeader.includes('valor aplicado') ||
      priceHeader.includes('valor total') ||
      priceHeader.includes('posicao') ||
      priceHeader.includes('posição') ||
      priceHeader.includes('saldo') ||
      (category === 'tesouro' && !priceHeader.includes('unitário') && !priceHeader.includes('unitario') && !priceHeader.includes('médio') && !priceHeader.includes('medio')) ||
      (category === 'renda_fixa' && !priceHeader.includes('unitário') && !priceHeader.includes('unitario') && !priceHeader.includes('médio') && !priceHeader.includes('medio'));

    let position = 0;
    let unitPrice = 0;

    if (isTotalValueCol) {
      position = price; // The column ALREADY represents the total value (e.g. R$ 19.959,82)
      unitPrice = qty > 0 ? price / qty : price; // Calculated unit price (e.g. 789.23)
    } else {
      position = qty > 0 ? qty * price : price;
      unitPrice = price;
    }

    if (category === 'acoes') {
      acoes.push({
        Ticker: ticker,
        Cotacao: unitPrice,
        Posicao: position,
        PrecoMedio: unitPrice,
        Quantidade: qty,
        Segmento: rawCategory || 'Ações'
      });
    } else if (category === 'fiis') {
      fiis.push({
        Ticker: ticker,
        Cotacao: unitPrice,
        Posicao: position,
        PrecoMedio: unitPrice,
        Quantidade: qty,
        Segmento: rawCategory || 'FIIs'
      });
    } else if (category === 'tesouro') {
      tesouro.push({
        Titulo: ticker,
        Posicao: position,
        Quantidade: qty,
        PrecoMedio: unitPrice,
        Vencimento: '-'
      });
    } else {
      renda_fixa.push({
        Ativo: ticker,
        Posicao: position,
        Quantidade: qty,
        PrecoMedio: unitPrice,
        Indexador: '-'
      });
    }
  }

  const total_live = [...acoes, ...fiis, ...tesouro, ...renda_fixa].reduce((acc, curr) => acc + (curr.Posicao || 0), 0);

  return {
    total_live,
    acoes,
    fiis,
    tesouro,
    renda_fixa,
    manualAssets: [],
    dividendos: [],
    resumo: {
      total_investido: total_live,
      saldo_disponivel: 0,
      saldo_projetado: total_live
    }
  };
}

export function convertAllSheetsToPortfolioData(sheets: Record<string, any[][]>): PortfolioData {
  let allAcoes: any[] = [];
  let allFiis: any[] = [];
  let allTesouro: any[] = [];
  let allRendaFixa: any[] = [];

  Object.entries(sheets).forEach(([sheetName, rows]) => {
    if (!rows || rows.length === 0) return;
    const mapping = detectColumnMapping(rows);
    const parsed = convertRowsToPortfolioData(rows, mapping, sheetName);
    allAcoes = allAcoes.concat(parsed.acoes);
    allFiis = allFiis.concat(parsed.fiis);
    allTesouro = allTesouro.concat(parsed.tesouro);
    allRendaFixa = allRendaFixa.concat(parsed.renda_fixa);
  });

  const total_live = [...allAcoes, ...allFiis, ...allTesouro, ...allRendaFixa].reduce((acc, curr) => acc + (curr.Posicao || 0), 0);

  return {
    total_live,
    acoes: allAcoes,
    fiis: allFiis,
    tesouro: allTesouro,
    renda_fixa: allRendaFixa,
    manualAssets: [],
    dividendos: [],
    resumo: {
      total_investido: total_live,
      saldo_disponivel: 0,
      saldo_projetado: total_live
    }
  };
}

