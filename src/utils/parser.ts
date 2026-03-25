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

          // Normalize row string: collapse multiple spaces and trim
          const rowStr = row.map((cell: any) => String(cell || '').toLowerCase().trim()).filter(Boolean).join(' ');

          // Check for section triggers
          for (const section of config.sections) {
            const trigger = section.trigger.toLowerCase().trim();
            
            // Allow partial matches if the trigger is distinct enough, or exact word matches
            if (rowStr.includes(trigger)) {
              let j = i + 1;
              
              // Skip potential header rows (up to 2)
              for (let k = 0; k < 2; k++) {
                if (rows[j]) {
                  const headerStr = rows[j].map(cell => String(cell || '').toLowerCase()).join(' ');
                  if (headerStr.includes("ticker") || headerStr.includes("ativo") || headerStr.includes("produto") || headerStr.includes("cotação") || headerStr.includes("quantidade")) {
                    j++;
                  } else {
                    break;
                  }
                }
              }

              // Read assets until we find an empty row or a row that looks like a subtotal/summary
              while (j < rows.length && rows[j]) {
                const r = rows[j];
                const m = section.mapping;
                
                // If row is completely empty, stop this section
                if (!r || r.every(cell => !cell || String(cell).trim() === "")) break;

                // If it's a subtotal or total row, stop
                const rStr = r.join(' ').toLowerCase();
                if (rStr.includes("total ") || rStr.includes("subtotal") || rStr.includes("resumo")) break;

                // Stop if we find another trigger from any section
                const isAnotherTrigger = config.sections.some(s => rStr.includes(s.trigger.toLowerCase()));
                if (isAnotherTrigger && j > i + 1) break;

                // If ticker/name column is empty, skip this row but continue the loop
                if (m.ticker !== null && (!r[m.ticker] || String(r[m.ticker]).trim() === "" || String(r[m.ticker]).trim() === "0")) {
                  j++;
                  continue; 
                }

                const item: any = {
                  Ticker: m.ticker !== null ? String(r[m.ticker] || '') : 'N/A',
                  Posicao: m.position !== null ? cleanCurrency(r[m.position]) : 0,
                  Alocacao: m.allocation !== null ? cleanPercentage(r[m.allocation]) : 0,
                  Cotacao: m.price !== null ? cleanCurrency(r[m.price]) : 0,
                  Quantidade: m.quantity !== null ? (parseFloat(String(r[m.quantity] || 0))) : 0,
                  Segmento: 'Outros',
                  SectionName: section.name,
                  SectionType: section.type
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
              i = j; // Advance main loop
              break; // Found section, don't check other triggers for this row
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
