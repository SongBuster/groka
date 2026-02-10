/**
 * Basic server-side PDF parser for email-ingested tickets
 * Extracts minimal info: date, store, total
 */
// @ts-ignore - pdf-parse has no type definitions
import pdfParse from 'pdf-parse'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Regex para números decimales (acepta hasta 3 decimales)
const DEC = '\\d+(?:[.,]\\d{1,3})?'

interface BasicTicketData {
  date: string | null
  time: string | null
  store: string | null
  total: number | null
  invoiceNumber: string | null
  supermarketId: string | null
}

/**
 * Normalize numeric string to float
 */
function normNum(s: string | null | undefined): number | null {
  if (!s) return null
  let cleaned = s.trim().replace('€', '').replace('EUR', '')
  cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  try {
    return parseFloat(cleaned)
  } catch {
    return null
  }
}

/**
 * Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD ISO format
 */
function convertToISODate(dateStr: string | null): string | null {
  if (!dateStr) return null
  
  // Match DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!match) return null
  
  let [, day, month, year] = match
  
  // Convert 2-digit year to 4-digit
  if (year.length === 2) {
    const currentYear = new Date().getFullYear()
    const century = Math.floor(currentYear / 100) * 100
    year = (century + parseInt(year)).toString()
  }
  
  // Pad day and month with leading zero
  day = day.padStart(2, '0')
  month = month.padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

function normalizeTime(timeStr: string | null): string | null {
  if (!timeStr) return null
  const match = timeStr.match(/(\d{1,2})[:.](\d{2})(?::\d{2})?/)
  if (!match) return null
  const hour = match[1].padStart(2, '0')
  const minute = match[2]
  return `${hour}:${minute}`
}

function extractDateTime(fullText: string): { date: string | null; time: string | null } {
  // Date followed by time (allow separators and small gaps)
  let match = fullText.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})[^\d]{0,10}(\d{1,2}[:.]\d{2})(?::\d{2})?/)
  if (match) {
    return {
      date: convertToISODate(match[1]),
      time: normalizeTime(match[2])
    }
  }

  // Time followed by date
  match = fullText.match(/(\d{1,2}[:.]\d{2})(?::\d{2})?[^\d]{0,10}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
  if (match) {
    return {
      date: convertToISODate(match[2]),
      time: normalizeTime(match[1])
    }
  }

  // Date only
  const dateMatch = fullText.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
  const timeMatch = fullText.match(/\b(\d{1,2}[:.]\d{2})(?::\d{2})?\b/)
  return {
    date: dateMatch ? convertToISODate(dateMatch[1]) : null,
    time: timeMatch ? normalizeTime(timeMatch[1]) : null
  }
}

/**
 * Detect supermarket from NIF or name patterns and get ID from DB
 */
async function detectSupermarket(text: string): Promise<{ id: string | null; name: string | null }> {
  const upperText = text.toUpperCase()
  
  // Mercadona: A-46103834
  if (upperText.includes('A-46103834') || upperText.includes('A46103834')) {
    try {
      const { data } = await supabase
        .from('supermarkets')
        .select('id, name')
        .ilike('name', '%mercadona%')
        .maybeSingle()
      
      if (data) {
        return { id: data.id, name: data.name }
      }
    } catch (e) {
      console.warn('Could not fetch Mercadona ID from DB:', e)
    }
    return { id: null, name: 'MERCADONA' }
  }
  
  // Add more supermarkets here as needed
  
  return { id: null, name: null }
}

/**
 * Parse PDF buffer and extract basic ticket data
 */
export async function parseBasicTicket(pdfBuffer: Buffer): Promise<BasicTicketData> {
  try {
    const data = await pdfParse(pdfBuffer)
    const fullText = data.text || ''

    const result: BasicTicketData = {
      date: null,
      time: null,
      store: null,
      total: null,
      invoiceNumber: null,
      supermarketId: null
    }

    // Detect supermarket
    const supermarket = await detectSupermarket(fullText)
    result.store = supermarket.name
    result.supermarketId = supermarket.id

    // Extract date and time (robust)
    const extracted = extractDateTime(fullText)
    result.date = extracted.date
    result.time = extracted.time

    // Extract store location for Mercadona
    if (supermarket.name === 'MERCADONA') {
      const storeMatch = fullText.match(/MERCADONA,?\s*S\.?\s*A\.?[^\n]*\n([^\n]+)\n([^\n]+)/i)
      if (storeMatch) {
        const line1 = storeMatch[1].trim()
        const line2 = storeMatch[2].trim()
        result.store = `MERCADONA — ${line1} — ${line2}`
      }
    }

    // Extract total amount
    const totalPattern = new RegExp(`TOTAL\\s*\\(?\\s*€?\\s*\\)?\\s*:?\\s*(${DEC})`, 'i')
    const totalMatch = fullText.match(totalPattern)
    if (totalMatch) {
      result.total = normNum(totalMatch[1])
    } else {
      // Alternative patterns
      const importePattern = new RegExp(`Importe\\s*:?\\s*(${DEC})\\s*€?`, 'i')
      const importeMatch = fullText.match(importePattern)
      if (importeMatch) {
        result.total = normNum(importeMatch[1])
      }
    }

    // Extract invoice number
    const invoiceMatch = fullText.match(/FACTURA\s+SIMPLIFICADA[:\s]*([A-Z0-9-]+)/i)
    if (invoiceMatch) {
      result.invoiceNumber = invoiceMatch[1].trim()
    }

    return result
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw error
  }
}
