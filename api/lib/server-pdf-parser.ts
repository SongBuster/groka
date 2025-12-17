import pdf from 'pdf-parse'

export type ParsedTicket = {
  supermarketId?: string | null
  invoiceNumber?: string | null
  store?: string | null
  date?: string | null // ISO date string
  totalFromPDF?: number | null
  totalAmount?: number | null
  products?: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
}

function toNumber(numStr: string): number {
  // Convert European decimals (80,88) or US (80.88)
  const s = numStr.trim().replace(/\./g, '').replace(/,/g, '.')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function extractDate(text: string): string | null {
  // Try formats: DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const m = text.match(/(\b\d{2}[\/-]\d{2}[\/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b)/)
  if (!m) return null
  const raw = m[1]
  if (/\d{4}-\d{2}-\d{2}/.test(raw)) return raw
  const [d, mo, y] = raw.replace(/-/g, '/').split('/')
  const iso = `${y}-${mo}-${d}`
  return iso
}

function extractTotal(text: string): number | null {
  // Look for TOTAL line
  const lines = text.split(/\r?\n/)
  for (const line of lines.reverse()) {
    const m = line.match(/TOTAL\s*[:\-]?\s*([0-9][0-9\.,]*)/i)
    if (m) return toNumber(m[1])
  }
  // Fallback: last amount-like number
  const all = [...text.matchAll(/([0-9][0-9\.,]{1,})(?:€)?/g)].map(m => toNumber(m[1]))
  if (all.length > 0) return all[all.length - 1]
  return null
}

function extractStore(text: string): string | null {
  const m = text.match(/MERCADONA|CARREFOUR|ALDI|LIDL|DIA|ALCAMPO|EL CORTE INGL[ÉE]S/i)
  if (m) return m[0].toUpperCase()
  // Try tienda label
  const t = text.match(/TIENDA\s*[:\-]?\s*([^\n]+)/i)
  if (t) return t[1].trim()
  return null
}

export async function parseTicketFromBuffer(buffer: Buffer): Promise<ParsedTicket | null> {
  const data = await pdf(buffer)
  const text = (data.text || '').replace(/\u00A0/g, ' ')
  if (!text || text.trim().length < 5) return null

  const store = extractStore(text)
  const date = extractDate(text)
  const total = extractTotal(text)

  // Very light parsing: we return header-level info.
  // Items parsing can be added per-supermarket with regexes.
  const parsed: ParsedTicket = {
    supermarketId: null,
    invoiceNumber: null,
    store: store || null,
    date: date || null,
    totalFromPDF: total ?? null,
    totalAmount: total ?? null,
    products: [],
  }

  return parsed
}
