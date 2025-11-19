/**
 * Convierte fecha DD/MM/YYYY a YYYY-MM-DD (ISO 8601)
 */
export function convertToISODate(dateStr: string | null): string | null {
  if (!dateStr) return null
  
  try {
    // Si ya está en formato ISO, retornar
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }
    
    // Convertir DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD
    const parts = dateStr.split(/[/-]/)
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0')
      const month = parts[1].padStart(2, '0')
      let year = parts[2]
      
      // Si el año es de 2 dígitos, asumir 20XX
      if (year.length === 2) {
        year = `20${year}`
      }
      
      return `${year}-${month}-${day}`
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Formatea número como moneda
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '€0.00'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount)
}

/**
 * Formatea fecha ISO a formato legible
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  } catch {
    return dateStr
  }
}

/**
 * Formatea cantidad con decimales
 */
export function formatNumber(num: number | null | undefined, decimals: number = 2): string {
  if (num == null) return '0'
  return num.toFixed(decimals)
}
