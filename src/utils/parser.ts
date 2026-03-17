import * as XLSX from 'xlsx';

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

export const parseInvestmentExcel = async (file: File): Promise<ParsedData> => {
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

        // Resumo (based on Python logic: row 3, cols 0, 1, 2)
        if (rows[3]) {
          result.resumo.total_investido = cleanCurrency(rows[3][0]);
          result.resumo.saldo_disponivel = cleanCurrency(rows[3][1]);
          result.resumo.saldo_projetado = cleanCurrency(rows[3][2]);
        }

        let currentSection: string | null = null;
        let isDividendArea = false;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const firstCell = String(row[0] || '').trim();

          // Detect Dividends Section
          if (firstCell.includes("Dividendos e JDP") || firstCell.includes("Dividendos")) {
            isDividendArea = true;
          }

          if (!isDividendArea) {
            if (firstCell.includes("Fundos Imobiliários")) currentSection = 'fiis';
            else if (firstCell.includes("Tesouro Direto")) currentSection = 'tesouro';
            else if (firstCell.includes("Ações")) currentSection = 'acoes';
            else if (firstCell.includes("Renda Fixa") && String(row[6] || '').includes("R$")) currentSection = 'renda_fixa';

            // Parse FIIs - Looking for "Fundos Listados" header
            if (currentSection === 'fiis' && firstCell.includes("Fundos Listados")) {
              let j = i + 1;
              while (j < rows.length && rows[j] && rows[j][0] && String(rows[j][0]).trim() !== "") {
                const r = rows[j];
                result.fiis.push({
                  Ticker: String(r[0]),
                  Posicao: cleanCurrency(r[1]),
                  Alocacao: cleanPercentage(r[2]),
                  Cotacao: cleanCurrency(r[6]),
                  Quantidade: parseInt(String(cleanCurrency(r[7]))) || 0,
                  Segmento: 'Outros'
                });
                j++;
              }
              i = j;
              currentSection = null;
            }
            // Parse Stocks - Looking for "Renda Variável Brasil" header
            else if (currentSection === 'acoes' && firstCell.includes("Renda Variável Brasil")) {
              let j = i + 1;
              while (j < rows.length && rows[j] && rows[j][0] && String(rows[j][0]).trim() !== "") {
                const r = rows[j];
                result.acoes.push({
                  Ticker: String(r[0]),
                  Posicao: cleanCurrency(r[1]),
                  Alocacao: cleanPercentage(r[2]),
                  Cotacao: cleanCurrency(r[5]),
                  Quantidade: parseInt(String(cleanCurrency(r[6]))) || 0,
                  Segmento: 'Outros'
                });
                j++;
              }
              i = j;
              currentSection = null;
            }
            // Parse Tesouro
            else if (currentSection === 'tesouro' && (firstCell.includes("Prefixado") || firstCell.includes("Pós-Fixado"))) {
              let j = i + 1;
              while (j < rows.length && rows[j] && rows[j][0] && String(rows[j][0]).trim() !== "") {
                const r = rows[j];
                result.tesouro.push({
                  Titulo: String(r[0]),
                  Posicao: cleanCurrency(r[1]),
                  Alocacao: cleanPercentage(r[2]),
                  TotalAplicado: cleanCurrency(r[3]),
                  Quantidade: cleanCurrency(r[4])
                });
                j++;
              }
              i = j;
            }
            // Parse Renda Fixa
            else if (currentSection === 'renda_fixa' && firstCell.includes("Prefixado")) {
              let j = i + 1;
              while (j < rows.length && rows[j] && rows[j][0] && String(rows[j][0]).trim() !== "") {
                const r = rows[j];
                result.renda_fixa.push({
                  Ativo: String(r[0]),
                  Posicao: cleanCurrency(r[1]),
                  Alocacao: cleanPercentage(r[2]),
                  ValorAplicado: cleanCurrency(r[3]),
                  Vencimento: String(r[7]),
                  Quantidade: cleanCurrency(r[8])
                });
                j++;
              }
              i = j;
              currentSection = null;
            }
          } else {
            // Dividend Area
            if ((firstCell.includes("Fundos Imobiliários") || firstCell.includes("Ações")) && 
                rows[i+1] && String(rows[i+1][0]).includes("Ticker")) {
              let j = i + 2;
              while (j < rows.length && rows[j] && rows[j][0] && String(rows[j][0]).trim() !== "") {
                const r = rows[j];
                result.dividendos.push({
                  Ticker: String(r[0]),
                  Tipo: String(r[1]),
                  DataCom: String(r[2]),
                  Pagamento: String(r[3]),
                  Valor: cleanCurrency(r[4])
                });
                j++;
              }
              i = j;
            }
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
