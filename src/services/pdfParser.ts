import * as pdfjsLib from 'pdfjs-dist'
import { convertToISODate } from '../lib/formatters'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

// Regex para números decimales (acepta hasta 3 decimales)
const DEC = '\\d+(?:[.,]\\d{1,3})?'

interface ParsedItem {
  item_name: string
  cantidad: number
  precioUnitario: number | null
  precioTotal: number
  weight_kg: number | null
  price_per_kg: number | null
}

interface TicketHeader {
  date: string | null
  store: string | null
  total: number | null
  invoiceNumber: string | null
}

interface Row {
  y: number
  x_first: number
  text: string
}

interface ParsedTicket {
  header: {
    invoiceNumber: string | null
    fecha: string | null
    hora: string
    tienda: string | null
    total: number | null
  }
  invoiceNumber: string | null
  date: string | null
  time: string
  store: string | null
  products: Array<{
    item_name: string
    quantity: number
    unit_price: number | null
    weight_kg: number | null
    price_per_kg: number | null
    total: number
  }>
  totalProducts: number
  totalAmount: number
  totalFromPDF: number | null
  rawText: string
}

class PDFParser {
  /**
   * Normaliza un string numérico a float
   */
  normNum(s: string | null | undefined): number | null {
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
   * Extrae texto completo del PDF
   */
  async extractFullText(pdf: pdfjsLib.PDFDocumentProxy): Promise<string> {
    let fullText = ''
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n'
    }
    return fullText
  }

  /**
   * Extrae filas con posiciones
   */
  async extractRowsWithPositions(pdf: pdfjsLib.PDFDocumentProxy): Promise<Row[]> {
    const rows: Row[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const spans: Array<{ text: string; x: number; y: number; y1: number }> = []
      for (const item of textContent.items as any[]) {
        const txt = (item.str || '').trim()
        if (!txt) continue

        const [x, y] = item.transform.slice(4, 6)
        spans.push({
          text: txt,
          x: x,
          y: y,
          y1: y + (item.height || 0)
        })
      }

      // Localizar Y de 'Descripción' y de 'TOTAL'
      let yStart: number | null = null
      let yEnd: number | null = null

      for (const sp of spans) {
        if (sp.text.toLowerCase() === 'descripción') {
          yStart = sp.y
        }
        if (sp.text.toUpperCase().startsWith('TOTAL')) {
          if (yStart !== null && sp.y < yStart && yEnd === null) {
            yEnd = sp.y
          }
        }
      }

      if (yStart === null) continue

      // Filtrar región entre Descripción y TOTAL
      const region = spans.filter(s => s.y < yStart && (yEnd === null || s.y > yEnd - 2))

      // Agrupar por línea (Y redondeada)
      const grouped: Record<string, typeof spans> = {}
      for (const s of region) {
        const yk = (Math.round(s.y * 10) / 10).toString()
        if (!grouped[yk]) grouped[yk] = []
        grouped[yk].push(s)
      }

      // Crear filas
      for (const [yk, arr] of Object.entries(grouped)) {
        const arrSorted = arr.sort((a, b) => a.x - b.x)
        const rowText = arrSorted.map(a => a.text).join(' ')
        rows.push({
          y: parseFloat(yk),
          x_first: arrSorted[0].x,
          text: rowText
        })
      }
    }

    rows.sort((a, b) => {
      if (a.y !== b.y) return b.y - a.y
      return a.x_first - b.x_first
    })

    return rows
  }

  /**
   * Parsea las filas extraídas (Mercadona)
   */
  parseRowsMercadona(rows: Row[]): ParsedItem[] {
    const items: ParsedItem[] = []
    let i = 0

    while (i < rows.length) {
      const text = rows[i].text

      // Caso normal: "2 GARBANZO M.COCIDO 0,75 1,50"
      const pattern1 = new RegExp(`^(\\d+)\\s+(.+?)\\s+(${DEC})(?:\\s+(${DEC}))?$`)
      const m = text.match(pattern1)

      if (m) {
        const qty = parseInt(m[1])
        const name = m[2].trim()
        let unit = this.normNum(m[3])
        let total = m[4] ? this.normNum(m[4]) : null

        if (total === null) {
          total = unit
          unit = qty ? (total ?? 0) / qty : null
        }

        items.push({
          item_name: name,
          cantidad: qty,
          precioUnitario: unit,
          precioTotal: total ?? 0,
          weight_kg: null,
          price_per_kg: null
        })
        i++
        continue
      }

      // Caso a peso: fila nombre + fila "1,182 kg 2,90 €/kg 3,26"
      const pattern2 = /^(\d+)\s+(.+)$/
      const m2 = text.match(pattern2)

      if (m2 && i + 1 < rows.length && rows[i + 1].text.includes('kg')) {
        const qty = parseInt(m2[1])
        const name = m2[2].trim()
        const wrow = rows[i + 1].text

        const patternW = new RegExp(`^(${DEC})\\s*kg\\s+(${DEC})\\s*€\\s*/kg\\s+(${DEC})$`)
        const mw = wrow.match(patternW)

        if (mw) {
          const weight = this.normNum(mw[1])
          const pperkg = this.normNum(mw[2])
          const total = this.normNum(mw[3])
          const unit = qty ? (total ?? 0) / qty : null

          items.push({
            item_name: name,
            cantidad: qty,
            precioUnitario: unit,
            precioTotal: total ?? 0,
            weight_kg: weight,
            price_per_kg: pperkg
          })
          i += 2
          continue
        }
      }

      // No reconocido: avanzar
      i++
    }

    return items
  }

  /**
   * Extrae información del header
   */
  async extractHeader(pdf: pdfjsLib.PDFDocumentProxy, fullText: string): Promise<TicketHeader> {
    const header: TicketHeader = {
      date: null,
      store: null,
      total: null,
      invoiceNumber: null
    }

    // Fecha/hora
    const dateMatch = fullText.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{1,2}:\d{2})/)
    if (dateMatch) {
      try {
        const [, datePart, timePart] = dateMatch
        header.date = `${datePart} ${timePart}`
      } catch {
        // Ignorar error
      }
    }

    // Tienda - Extraer items estructurados de la primera página
    try {
      const page = await pdf.getPage(1)
      const textContent = await page.getTextContent()
      const items = textContent.items
        .map((item: any) => item.str.trim())
        .filter((s: string) => s)
      
      let storeName = 'Mercadona'
      
      // Buscar el NIF y tomar el siguiente item como dirección
      for (let i = 0; i < items.length - 1; i++) {
        if (items[i].match(/^[A-Z]-?\d{8}$/)) {
          if (i + 1 < items.length) {
            let street = items[i + 1].trim()
            
            // Limpiar formato común: quitar números de portal al final si están separados por coma
            street = street.replace(/,\s*\d+\s*$/, '')
            
            // Limpiar espacios múltiples
            street = street.replace(/\s+/g, ' ').trim()
            
            if (street && street.length > 3) {
              storeName = `Mercadona ${street}`
              break
            }
          }
        }
      }
      
      header.store = storeName
    } catch (error) {
      console.error('Error extrayendo tienda:', error)
      header.store = 'Mercadona'
    }

    // Total
    const totalPattern = new RegExp(`TOTAL\\s*\\(\\s*€\\s*\\)\\s*(${DEC})`, 'i')
    const totalMatch = fullText.match(totalPattern)
    if (totalMatch) {
      header.total = this.normNum(totalMatch[1])
    } else {
      const importePattern = new RegExp(`Importe:\\s*(${DEC})\\s*€`, 'i')
      const importeMatch = fullText.match(importePattern)
      if (importeMatch) {
        header.total = this.normNum(importeMatch[1])
      }
    }

    // Número de factura
    const invoiceMatch = fullText.match(/FACTURA\s+SIMPLIFICADA[:\s]*([A-Z0-9-]+)/i)
    if (invoiceMatch) {
      header.invoiceNumber = invoiceMatch[1].trim()
    }

    return header
  }

  /**
   * Parsea un ticket desde un File object
   */
  async parseTicketFromFile(file: File): Promise<ParsedTicket> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      // Extraer texto completo para header
      const fullText = await this.extractFullText(pdf)
      console.log('📄 Texto completo (primeros 500 chars):', fullText.substring(0, 500))

      // Extraer header (fecha, tienda, total, factura)
      const header = await this.extractHeader(pdf, fullText)
      console.log('📋 Header:', header)

      // Extraer filas con posiciones
      const rows = await this.extractRowsWithPositions(pdf)
      console.log('📦 Filas extraídas:', rows.length)
      console.log('Primeras 5 filas:', rows.slice(0, 5))

      // Parsear productos
      const items = this.parseRowsMercadona(rows)
      console.log('✅ Productos parseados:', items.length)

      // Separar fecha y hora
      let fecha = header.date
      let hora = ''
      if (header.date && header.date.includes(' ')) {
        const parts = header.date.split(' ')
        fecha = parts[0]
        hora = parts[1]
      }

      // Convertir fecha a ISO
      fecha = convertToISODate(fecha)

      return {
        header: {
          invoiceNumber: header.invoiceNumber,
          fecha: fecha,
          hora: hora,
          tienda: header.store,
          total: header.total
        },
        invoiceNumber: header.invoiceNumber,
        date: fecha,
        time: hora,
        store: header.store,
        products: items.map(item => ({
          item_name: item.item_name,
          quantity: item.cantidad,
          unit_price: item.precioUnitario,
          weight_kg: item.weight_kg,
          price_per_kg: item.price_per_kg,
          total: item.precioTotal
        })),
        totalProducts: items.length,
        totalAmount: items.reduce((sum, p) => sum + p.precioTotal, 0),
        totalFromPDF: header.total,
        rawText: fullText
      }
    } catch (error) {
      console.error('❌ Error al parsear ticket:', error)
      throw error
    }
  }
}

export default new PDFParser()
