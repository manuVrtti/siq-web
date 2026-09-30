import 'server-only'

import * as XLSX from 'xlsx'

import { ValidationError } from '@/lib/errors'

/**
 * Plan 020 — spreadsheet I/O (SheetJS).
 *
 * SheetJS is installed from the vendor CDN (0.20.3), NOT the npm registry:
 * the npm `xlsx` package froze at 0.18.5, which carries a prototype-
 * pollution CVE in its parser. We parse admin-uploaded files, so that
 * matters.
 *
 * Reads .xlsx, .xls and .csv (SheetJS sniffs the format). Only the first
 * sheet is read; hard caps on bytes and rows keep a stray 50 MB export from
 * tying up a serverless function.
 */

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 2000
export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const

export type SheetRow = {
  /** 1-based row number as the user sees it in Excel (header is row 1). */
  rowNumber: number
  values: Record<string, string>
}

/** "Option A", "option_a", " OPTION-A " → "optiona". */
export function canonicalHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Parse the first sheet into rows keyed by canonical header. Fully blank rows
 * are dropped (spreadsheets often carry trailing empties). Values are
 * stringified and trimmed; numeric cells (e.g. phone numbers stored as
 * numbers) become plain digit strings.
 */
export function parseSheet(
  bytes: ArrayBuffer | Buffer,
  opts: { requiredHeaders: string[] },
): { headers: string[]; rows: SheetRow[] } {
  const size = bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.length
  if (size === 0) throw new ValidationError('The file is empty')
  if (size > MAX_IMPORT_BYTES) {
    throw new ValidationError(`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB`)
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(bytes, { type: bytes instanceof ArrayBuffer ? 'array' : 'buffer', dense: true })
  } catch {
    throw new ValidationError('Could not read the file. Upload an .xlsx, .xls or .csv file.')
  }
  const sheet = wb.Sheets[wb.SheetNames[0] ?? '']
  if (!sheet) throw new ValidationError('The file has no sheets')

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true,
  })
  if (grid.length === 0) throw new ValidationError('The sheet is empty')

  const headers = (grid[0] ?? []).map((h) => canonicalHeader(String(h ?? '')))
  const missing = opts.requiredHeaders.filter((r) => !headers.includes(r))
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Download the template to see the expected columns.`,
    )
  }

  const rows: SheetRow[] = []
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i] ?? []
    const values: Record<string, string> = {}
    let any = false
    headers.forEach((h, c) => {
      if (!h) return
      const raw = cells[c]
      const v =
        typeof raw === 'number'
          ? Number.isInteger(raw)
            ? raw.toFixed(0) // avoid "9.87654321E9" for big integers
            : String(raw)
          : String(raw ?? '').trim()
      if (v) any = true
      values[h] = v
    })
    if (!any) continue
    rows.push({ rowNumber: i + 1, values })
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new ValidationError(`Import at most ${MAX_IMPORT_ROWS} rows at a time — split the file`)
    }
  }
  if (rows.length === 0) throw new ValidationError('No data rows found under the header row')
  return { headers, rows }
}

/**
 * Build an .xlsx from sheets of plain row objects. Cells are written as
 * typed values (string / number), never formulas — so a candidate named
 * "=HYPERLINK(...)" is stored as literal text and can't execute in Excel.
 */
export function buildWorkbook(
  sheets: { name: string; rows: Record<string, string | number | null>[]; widths?: number[] }[],
): Buffer {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}])
    if (s.widths) ws['!cols'] = s.widths.map((wch) => ({ wch }))
    // Excel caps sheet names at 31 chars and forbids []:*?/\
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer
}

/** HTTP response for a generated file download. */
export function fileResponse(body: Buffer | Uint8Array, filename: string, contentType: string): Response {
  const safe = filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120)
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
