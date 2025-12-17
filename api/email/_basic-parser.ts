/**
 * Basic server-side PDF parser for email-ingested tickets
 * Extracts minimal info: date, store, total
 */
// @ts-ignore - pdf-parse has no type definitions
import pdfParse from 'pdf-parse'

// Regex para números decimales (acepta hasta 3 decimales)
const DEC = '\\d+(?:[.,]\\d{1,3})?'

interface BasicTicketData {
  date: string | null
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

/**
 * Detect supermarket from NIF or name patterns
 */
function detectSupermarket(text: string): { id: string | null; name: string | null } {
  const upperText = text.toUpperCase()
  
  // Mercadona: A-46103834
  if (upperText.includes('A-46103834') || upperText.includes('A46103834')) {
    return { id: null, name: 'MERCADONA' } // We'll need the actual ID from DB
  }
  
  // Add more supermarkets here as needed
  
  return { id: null, name: null }
}

/**
 * Parse PDF buffer and extract basic ticket data
 */
export async function parseBasicTicket(buffer: Buffer): Promise<BasicTicketData> {
  try {
    const data = await pdfParse(buffer)
    const fullText = data.text
    
    const result: BasicTicketData = {
      date: null,
      store: null,
      total: null,
      invoiceNumber: null,
      supermarketId: null
    }
    
    // Detect supermarket
    const supermarket = detectSupermarket(fullText)
    result.store = supermarket.name
    result.supermarketId = supermarket.id
    
    // Extract date: DD/MM/YYYY or DD-MM-YYYY
    const dateMatch = fullText.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
    if (dateMatch) {
      result.date = convertToISODate(dateMatch[1])
    }
    
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
