import * as XLSX from 'xlsx'

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
export const MAX_ROWS_PER_SHEET = 300
export const MAX_PROMPT_CHARS = 60_000

export type Sheets = Record<string, unknown[][]>

export interface PreparedAttachment {
  name: string
  meta: string
  promptText: string
}

const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

function readWith<T>(start: (reader: FileReader) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as T)
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    start(reader)
  })
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10).join('\n')
  const count = (char: string) => sample.split(char).length - 1
  const commas = count(',')
  const semicolons = count(';')
  const tabs = count('\t')
  if (semicolons > commas && semicolons > tabs) return ';'
  if (tabs > commas && tabs > semicolons) return '\t'
  return ','
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const delimiter = detectDelimiter(lines)
  return lines.map((line) => splitCsvLine(line, delimiter))
}

export async function readSheets(file: File): Promise<Sheets> {
  const extension = extensionOf(file.name)
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    throw new Error(`Formato não suportado: ${extension || 'sem extensão'}. Envie um arquivo .xlsx, .xls ou .csv.`)
  }
  if (extension === '.csv') {
    const text = await readWith<string>((reader) => reader.readAsText(file))
    return { CSV: parseCsv(text) }
  }
  const buffer = await readWith<ArrayBuffer>((reader) => reader.readAsArrayBuffer(file))
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheets: Sheets = {}
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 })
  }
  return sheets
}

const isFilled = (row: unknown[]): boolean =>
  Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')

export function sheetsToPromptText(
  fileName: string,
  sheets: Sheets,
): { text: string; truncated: boolean; rowCount: number } {
  let truncated = false
  let rowCount = 0
  const parts: string[] = [`Arquivo anexado: ${fileName}`]
  for (const [name, rows] of Object.entries(sheets)) {
    const filled = rows.filter(isFilled)
    rowCount += filled.length
    if (filled.length > MAX_ROWS_PER_SHEET) truncated = true
    parts.push(`### Aba: ${name} (${filled.length} linhas)`)
    for (const row of filled.slice(0, MAX_ROWS_PER_SHEET)) {
      parts.push(Array.from(row, (cell) => String(cell ?? '').replace(/\s+/g, ' ').trim()).join(' | '))
    }
  }
  let text = parts.join('\n')
  if (text.length > MAX_PROMPT_CHARS) {
    text = text.slice(0, MAX_PROMPT_CHARS)
    truncated = true
  }
  if (truncated) {
    text += '\n[AVISO: o arquivo foi truncado; avise o usuário de que nem todas as linhas foram lidas.]'
  }
  return { text, truncated, rowCount }
}

export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const sheets = await readSheets(file)
  const { text, truncated, rowCount } = sheetsToPromptText(file.name, sheets)
  if (rowCount === 0) throw new Error('O arquivo está vazio.')
  const sheetCount = Object.keys(sheets).length
  const base =
    extensionOf(file.name) === '.csv'
      ? `CSV · ${rowCount} ${rowCount === 1 ? 'linha' : 'linhas'}`
      : `Planilha · ${sheetCount} ${sheetCount === 1 ? 'aba' : 'abas'}`
  return { name: file.name, meta: truncated ? `${base} · truncado` : base, promptText: text }
}
