import * as XLSX from 'xlsx';
import { ImportConfig } from '../store/useInvestmentStore';

export interface ParsedData {
  fiis: any[];
  acoes: any[];
  tesouro: any[];
  renda_fixa: any[];
  dividendos: any[];
  resumo: {
    total_investido: number;
    saldo_disponivel: number;
    saldo_projetado: number;
  };
}

const cleanCurrency = (value: any): number => {
  if (value === null || value === undefined || value === '-') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const cleanPercentage = (value: any): number => {
  if (value === null || value === undefined || value === '-') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace('%', '').replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num / 100;
};

export const parseInvestmentExcel = async (file: File, config: ImportConfig): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        const result: ParsedData = {
          fiis: [],
          acoes: [],
          tesouro: [],
          renda_fixa: [],
          dividendos: [],
          resumo: { total_investido: 0, saldo_disponivel: 0, saldo_projetado: 0 }
        };

        // Resumo 
        if (rows[config.resumoRow]) {
          const r = rows[config.resumoRow];
          result.resumo.total_investido = cleanCurrency(r[config.resumoCols.total_investido]);
          result.resumo.saldo_disponivel = cleanCurrency(r[config.resumoCols.saldo_disponivel]);
          result.resumo.saldo_projetado = cleanCurrency(r[config.resumoCols.saldo_projetado]);
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const rowStr = row.join(' ');

          // Check for section triggers
          for (const section of config.sections) {
            if (rowStr.includes(section.trigger)) {
              let j = i + 1;
              // Skip header if it contains words like "Ticker", "Ativo", "Produto"
              if (rows[j] && (String(rows[j][0]).includes("Ticker") || String(rows[j][0]).includes("Ativo") || String(rows[j][0]).includes("Produto"))) {
                j++;
              }

              while (j < rows.length && rows[j] && rows[j][0] && String(rows[j][0]).trim() !== "" && String(rows[j][0]).trim() !== "0") {
                const r = rows[j];
                const m = section.mapping;
                
                const item: any = {
                  Ticker: m.ticker !== null ? String(r[m.ticker] || '') : 'N/A',
                  Posicao: m.position !== null ? cleanCurrency(r[m.position]) : 0,
                  Alocacao: m.allocation !== null ? cleanPercentage(r[m.allocation]) : 0,
                  Cotacao: m.price !== null ? cleanCurrency(r[m.price]) : 0,
                  Quantidade: m.quantity !== null ? (parseFloat(String(r[m.quantity] || 0))) : 0,
                  Segmento: 'Outros'
                };

                if (m.extra !== null && m.extra !== undefined) {
                  item.Vencimento = String(r[m.extra] || '');
                }

                if (section.type === 'fiis') result.fiis.push(item);
                else if (section.type === 'acoes') result.acoes.push(item);
                else if (section.type === 'tesouro') result.tesouro.push({ ...item, Titulo: item.Ticker });
                else if (section.type === 'renda_fixa') result.renda_fixa.push({ ...item, Ativo: item.Ticker });

                j++;
              }
              i = j;
            }
          }

          // Special case for Dividends (might still be hardcoded or added to config later)
          if (rowStr.includes("Dividendos e JDP") || rowStr.includes("Dividendos")) {
             // Basic hardcoded logic for dividends if not in config
             // ... for now let's keep it simple or add as a section type
          }
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
