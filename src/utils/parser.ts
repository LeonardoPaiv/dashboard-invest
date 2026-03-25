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
  
  let str = String(value).replace(/R\$\s?/, '').trim();
  
  // Se tem vírgula e ponto, ou só vírgula, tratamos como formato BR (1.234,56)
  if (str.includes(',')) {
    // Remove os pontos de milhar e troca a vírgula decimal por ponto
    str = str.replace(/\./g, '').replace(',', '.');
  }
  // Se não tem vírgula mas tem ponto, e não parece ser apenas separador de milhar (ex: 1.234)
  // o parseFloat padrão já resolve se for 1234.56
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};



export const parseInvestmentExcel = async (file: File, config: ImportConfig): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: 'array' });

        const result: ParsedData = {
          fiis: [],
          acoes: [],
          tesouro: [],
          renda_fixa: [],
          dividendos: [],
          resumo: { total_investido: 0, saldo_disponivel: 0, saldo_projetado: 0 }
        };

        // 2. Sections
        for (const section of config.sections) {
          const sheetsToSearch = section.sheetName 
            ? [section.sheetName] 
            : workbook.SheetNames;

          let foundInSection = false;

          for (const sheetName of sheetsToSearch) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
            const trigger = section.trigger.toLowerCase().trim();

            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const rowStr = row.map((cell: any) => String(cell || '').toLowerCase().trim()).filter(Boolean).join(' ');

              if (rowStr.includes(trigger)) {
                let j = i + 1;
                
                // Skip potential header rows (up to 3)
                for (let k = 0; k < 3; k++) {
                  if (rows[j]) {
                    const headerStr = rows[j].map(cell => String(cell || '').toLowerCase()).join(' ');
                    if (headerStr.includes("ticker") || headerStr.includes("ativo") || headerStr.includes("produto") || headerStr.includes("unitário") || headerStr.includes("valor")) {
                      j++;
                    } else {
                      break;
                    }
                  }
                }

                while (j < rows.length && rows[j]) {
                  const r = rows[j];
                  const m = section.mapping;
                  
                  if (!r || r.every(cell => !cell || String(cell).trim() === "")) break;

                  const rStr = r.join(' ').toLowerCase();
                  if (rStr.includes("total ") || rStr.includes("subtotal") || rStr.includes("resumo")) break;

                  if (m.ticker !== null && (!r[m.ticker] || String(r[m.ticker]).trim() === "" || String(r[m.ticker]).trim() === "0")) {
                    j++;
                    continue; 
                  }

                  const ticker = m.ticker !== null ? String(r[m.ticker] || '') : 'N/A';
                  const quantidade = m.quantity !== null ? cleanCurrency(r[m.quantity]) : 0;
                  const valorUnitarioSource = m.price !== null ? cleanCurrency(r[m.price]) : 0;
                  let precoMedioSource = m.avgPrice !== null && m.avgPrice !== undefined ? cleanCurrency(r[m.avgPrice]) : 0;

                  // Se for Tesouro, o valor aplicado costuma ser o total, então convertemos para unitário
                  if (section.type === 'tesouro' && quantidade > 0 && m.avgPrice !== null && m.avgPrice !== undefined) {
                     // Heurística de milhar
                  }

                  const item: any = {
                    Ticker: ticker,
                    Posicao: 0, 
                    Quantidade: quantidade,
                    Cotacao: valorUnitarioSource,
                    PrecoMedio: precoMedioSource,
                    Segmento: 'Outros',
                    SectionName: section.name,
                    SectionType: section.type
                  };

                  if (section.type === 'renda_fixa') {
                    item.Posicao = quantidade * valorUnitarioSource;
                    item.Indexador = m.indexador !== null && m.indexador !== undefined ? String(r[m.indexador] || '') : '';
                    item.Vencimento = m.extra !== null && m.extra !== undefined ? String(r[m.extra] || '') : '';
                    result.renda_fixa.push(item);
                  } else if (section.type === 'tesouro') {
                    const valorLiquido = m.netValue !== null && m.netValue !== undefined ? cleanCurrency(r[m.netValue]) : 0;
                    item.Posicao = valorLiquido;
                    item.ValorBruto = m.grossValue !== null && m.grossValue !== undefined ? cleanCurrency(r[m.grossValue]) : 0;
                    item.Vencimento = m.extra !== null && m.extra !== undefined ? String(r[m.extra] || '') : '';
                    // Para o Tesouro, o PrecoMedio (Preço Unitário de Compra) deve ser ValorAplicado / Quantidade se o mapeamento foi o total
                    if (quantidade > 0 && precoMedioSource > valorLiquido * 0.5) { 
                      // Se o precoMedioSource é comparável ao valor total, provavelmente é o total
                      item.PrecoMedio = precoMedioSource / quantidade;
                      item.ValorAplicadoTotal = precoMedioSource;
                    }
                    result.tesouro.push(item);
                  } else {
                    item.Posicao = quantidade * valorUnitarioSource;
                    if (section.type === 'fiis') result.fiis.push(item);
                    else result.acoes.push(item);
                  }

                  j++;
                }
                foundInSection = true;
                break; 
              }
            }
            if (foundInSection) break;
          }
        }

        // Calculate total_investido manually from assets cost (PriceMedio * Quantity)
        const allAssets = [...result.fiis, ...result.acoes, ...result.tesouro, ...result.renda_fixa];
        result.resumo.total_investido = allAssets.reduce((acc, curr) => {
          const cost = (curr.PrecoMedio || 0) * (curr.Quantidade || 0);
          return acc + (cost || 0);
        }, 0);


        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
