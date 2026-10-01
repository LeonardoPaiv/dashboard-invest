import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { MAX_ROWS_PER_SHEET, prepareAttachment, readSheets, sheetsToPromptText } from './attachments'

const csvFile = (text: string, name = 'posicao.csv') => new File([text], name, { type: 'text/csv' })

describe('readSheets', () => {
  it('reads a semicolon-separated CSV, keeping decimal commas inside cells', async () => {
    const sheets = await readSheets(csvFile('Ativo;Cotas;Custo médio\nTAEE11;80;35,20\nVISC11;40;104,50\n'))
    expect(sheets).toEqual({
      CSV: [
        ['Ativo', 'Cotas', 'Custo médio'],
        ['TAEE11', '80', '35,20'],
        ['VISC11', '40', '104,50'],
      ],
    })
  })

  it('reads a comma-separated CSV with quoted cells and an empty first cell', async () => {
    const sheets = await readSheets(csvFile(',Qtd,Nome\n"ITUB4",100,"Itaú, PN"\n'))
    expect(sheets.CSV).toEqual([
      ['', 'Qtd', 'Nome'],
      ['ITUB4', '100', 'Itaú, PN'],
    ])
  })

  it('reads every sheet of an xlsx workbook', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Papel', 'Qtd'], ['ITUB4', 100]]), 'Custódia')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Outra')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const sheets = await readSheets(new File([bytes], 'extrato.xlsx'))
    expect(Object.keys(sheets)).toEqual(['Custódia', 'Outra'])
    expect(sheets['Custódia']).toEqual([['Papel', 'Qtd'], ['ITUB4', 100]])
  })

  it('rejects unsupported formats with a readable message', async () => {
    await expect(readSheets(new File(['x'], 'nota.pdf'))).rejects.toThrow(
      'Formato não suportado: .pdf. Envie um arquivo .xlsx, .xls ou .csv.',
    )
  })
})

describe('sheetsToPromptText', () => {
  it('serializes rows with a header per sheet and skips empty rows', () => {
    const { text, truncated, rowCount } = sheetsToPromptText('extrato.xlsx', {
      Custódia: [['Papel', 'Qtd'], [], [null, ''], ['ITUB4', 100]],
    })
    expect(truncated).toBe(false)
    expect(rowCount).toBe(2)
    expect(text).toBe('Arquivo anexado: extrato.xlsx\n### Aba: Custódia (2 linhas)\nPapel | Qtd\nITUB4 | 100')
  })

  it('truncates long sheets and tells the model about it', () => {
    const rows = Array.from({ length: MAX_ROWS_PER_SHEET + 50 }, (_, i) => [`ATIVO${i}`, i])
    const { text, truncated } = sheetsToPromptText('grande.csv', { CSV: rows })
    expect(truncated).toBe(true)
    expect(text).toContain(`ATIVO${MAX_ROWS_PER_SHEET - 1} |`)
    expect(text).not.toContain(`ATIVO${MAX_ROWS_PER_SHEET} |`)
    expect(text).toContain('[AVISO: o arquivo foi truncado')
  })
})

describe('prepareAttachment', () => {
  it('describes a CSV by its number of rows', async () => {
    const prepared = await prepareAttachment(csvFile('Ativo;Cotas\nTAEE11;80\nVISC11;40\n', 'posicao_nuinvest.csv'))
    expect(prepared.name).toBe('posicao_nuinvest.csv')
    expect(prepared.meta).toBe('CSV · 3 linhas')
    expect(prepared.promptText).toContain('TAEE11 | 80')
  })

  it('describes a workbook by its number of sheets', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['a']]), 'Um')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    expect((await prepareAttachment(new File([bytes], 'x.xlsx'))).meta).toBe('Planilha · 1 aba')
  })

  it('flags truncated files in the meta line', async () => {
    const text = Array.from({ length: MAX_ROWS_PER_SHEET + 10 }, (_, i) => `A${i};1`).join('\n')
    expect((await prepareAttachment(csvFile(text))).meta).toBe(`CSV · ${MAX_ROWS_PER_SHEET + 10} linhas · truncado`)
  })

  it('rejects a file with no data', async () => {
    await expect(prepareAttachment(csvFile('\n\n'))).rejects.toThrow('O arquivo está vazio.')
  })
})
