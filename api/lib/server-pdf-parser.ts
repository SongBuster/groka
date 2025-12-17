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

  // Try per-supermarket item parsing (Mercadona first)
  const products: ParsedTicket['products'] = store?.includes('MERCADONA')
    ? parseMercadonaItems(text)
    : []

  // Very light parsing: header + optional items
  const parsed: ParsedTicket = {
    supermarketId: null,
    invoiceNumber: null,
    store: store || null,
    date: date || null,
    totalFromPDF: total ?? null,
    totalAmount: total ?? null,
    products,
  }

  return parsed
}

function looksLikeHeaderOrFooter(line: string): boolean {
  const l = line.trim().toUpperCase()
  if (!l) return true
  return (
    l.includes('TOTAL') ||
    l.includes('BASE') ||
    l.includes('IVA') ||
    l.includes('NIF') ||
    l.includes('CIF') ||
    l.includes('TICKET') ||
    l.includes('FACTURA') ||
    l.includes('TPV') ||
    l.includes('CAJA') ||
    l.includes('HORA') ||
    /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(l)
  )
}

function normalizeText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.replace(/[\t\u00A0]+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(l => l.length > 0)
}

function parseMercadonaItems(text: string): ParsedTicket['products'] {
  const lines = normalizeText(text)
  const items: ParsedTicket['products'] = []

  const qtyUnitPriceTotal = /^(?<qty>[0-9]+(?:[.,][0-9]+)?)\s*(?<unit>kg|ud|u|l)?\s*x\s*(?<unitPrice>[0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur|e)?\s*(?<total>[0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur|e)?$/i
  const inlinePattern = /^(?<name>.+?)\s+(?<qty>[0-9]+(?:[.,][0-9]+)?)\s*(?<unit>kg|ud|u|l)?\s*x\s*(?<unitPrice>[0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur|e)?\s*(?<total>[0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur|e)?$/i
  const trailingTotalPattern = /^(?<name>.+?)\s+(?<total>[0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur|e)?$/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (looksLikeHeaderOrFooter(line)) continue

    // Case 1: inline "NAME qty x unitPrice total"
    let m = line.match(inlinePattern)
    if (m && m.groups) {
      const name = m.groups.name.trim()
      const qty = toNumber(m.groups.qty)
      const unitPrice = toNumber(m.groups.unitPrice)
      const totalPrice = toNumber(m.groups.total)
      if (name && qty > 0 && unitPrice >= 0 && totalPrice > 0) {
        items.push({ name, quantity: qty, unitPrice, totalPrice })
        continue
      }
    }

    // Case 2: two-line pattern: NAME on line i, then "qty x unitPrice total" on line i+1
    if (i + 1 < lines.length) {
      const next = lines[i + 1]
      const mm = next.match(qtyUnitPriceTotal)
      if (mm && mm.groups) {
        const name = line.trim()
        if (!looksLikeHeaderOrFooter(name) && /[A-Za-z]/.test(name)) {
          const qty = toNumber(mm.groups.qty)
          const unitPrice = toNumber(mm.groups.unitPrice)
          const totalPrice = toNumber(mm.groups.total)
          if (name && qty > 0 && unitPrice >= 0 && totalPrice > 0) {
            items.push({ name, quantity: qty, unitPrice, totalPrice })
            i++ // consume next line
            continue
          }
        }
      }
    }

    // Case 3: fallback "NAME total" → assume quantity 1
    const t = line.match(trailingTotalPattern)
    if (t && t.groups) {
      const name = t.groups.name.trim()
      if (!looksLikeHeaderOrFooter(name) && /[A-Za-z]/.test(name)) {
        const totalPrice = toNumber(t.groups.total)
        if (totalPrice > 0) {
          items.push({ name, quantity: 1, unitPrice: totalPrice, totalPrice })
          continue
        }
      }
    }
  }

  return items
}
