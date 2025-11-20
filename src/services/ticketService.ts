import { supabase } from '../lib/supabase'
import pdfParser from './pdfParser'
import type { Database } from '../types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']
type TicketInsert = Database['public']['Tables']['tickets']['Insert']
type TicketItem = Database['public']['Tables']['ticket_items']['Row']

export class TicketService {
  /**
   * Sanitize filename for storage (remove special characters)
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .toLowerCase()
  }

  /**
   * Upload a PDF ticket file and parse it
   */
  async uploadAndParseTicket(file: File, userId: string): Promise<Ticket> {
    try {
      // 1. Upload PDF to Supabase Storage
      const sanitizedName = this.sanitizeFileName(file.name)
      const fileName = `${userId}/${Date.now()}-${sanitizedName}`
      const { error: uploadError } = await supabase.storage
        .from('tickets')
        .upload(fileName, file, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tickets')
        .getPublicUrl(fileName)

      // 2. Parse the PDF
      let parsed = false
      let parsingError: string | null = null
      let ticketNumber: string | null = null
      let storeName: string | null = null
      let purchaseDate: string | null = null
      let totalAmount: number | null = null
      let products: any[] = []

      try {
        const parsedData = await pdfParser.parseTicketFromFile(file)
        parsed = true
        ticketNumber = parsedData.invoiceNumber
        storeName = parsedData.store
        purchaseDate = parsedData.date
        totalAmount = parsedData.totalFromPDF || parsedData.totalAmount
        products = parsedData.products
      } catch (error: any) {
        parsingError = error.message || 'Error parsing PDF'
        console.error('PDF parsing error:', error)
      }

      // 3. Insert ticket record
      const ticketData: TicketInsert = {
        user_id: userId,
        file_name: file.name,
        file_url: publicUrl,
        ticket_number: ticketNumber,
        store_name: storeName,
        purchase_date: purchaseDate,
        total_amount: totalAmount,
        parsed,
        parsing_error: parsingError
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketData as any)
        .select()
        .single() as { data: Ticket | null, error: any }

      if (ticketError) throw ticketError
      if (!ticket) throw new Error('Failed to create ticket')

      // 4. Insert ticket items if parsing was successful
      if (parsed && products.length > 0) {
        await this.saveTicketItems(ticket.id, products)
      }

      return ticket
    } catch (error) {
      console.error('Error uploading ticket:', error)
      throw error
    }
  }

  /**
   * Save parsed products as ticket items
   */
  private async saveTicketItems(ticketId: string, products: any[]): Promise<void> {
    try {
      // First, ensure products exist in the catalog
      const productIds = await this.ensureProductsExist(products)

      // Insert ticket items
      const items = products.map((product, index) => ({
        ticket_id: ticketId,
        product_id: productIds[index],
        name: product.item_name,
        quantity: product.quantity,
        unit_price: product.unit_price,
        total_price: product.total
      }))

      const { error } = await supabase.from('ticket_items').insert(items as any)
      if (error) throw error
    } catch (error) {
      console.error('Error saving ticket items:', error)
      throw error
    }
  }

  /**
   * Ensure products exist in the catalog, create if they don't
   * Returns array of product IDs
   */
  private async ensureProductsExist(products: any[]): Promise<(string | null)[]> {
    const productIds: (string | null)[] = []

    for (const product of products) {
      try {
        // Check if product exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('name', product.item_name)
          .maybeSingle() as { data: { id: string } | null }

        if (existing) {
          productIds.push(existing.id)
        } else {
          // Create new product
          const { data: newProduct, error } = await supabase
            .from('products')
            .insert({ name: product.item_name, category: null } as any)
            .select('id')
            .single() as { data: { id: string } | null, error: any }

          if (error) {
            console.error('Error creating product:', error)
            productIds.push(null)
          } else if (newProduct) {
            productIds.push(newProduct.id)
          } else {
            productIds.push(null)
          }
        }
      } catch (error) {
        console.error('Error ensuring product exists:', error)
        productIds.push(null)
      }
    }

    return productIds
  }

  /**
   * Get all tickets for a user
   */
  async getUserTickets(userId: string): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get ticket with its items
   */
  async getTicketWithItems(ticketId: string): Promise<{
    ticket: Ticket
    items: TicketItem[]
  }> {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (ticketError) throw ticketError

    const { data: items, error: itemsError } = await supabase
      .from('ticket_items')
      .select('*')
      .eq('ticket_id', ticketId)

    if (itemsError) throw itemsError

    return { ticket, items: items || [] }
  }

  /**
   * Delete a ticket
   */
  async deleteTicket(ticketId: string): Promise<void> {
    // Get ticket to delete file from storage
    const { data: ticket } = await supabase
      .from('tickets')
      .select('file_url')
      .eq('id', ticketId)
      .single() as { data: { file_url: string | null } | null }

    // Delete from database (cascade will delete items)
    const { error } = await supabase.from('tickets').delete().eq('id', ticketId)
    if (error) throw error

    // Delete file from storage if exists
    if (ticket?.file_url) {
      try {
        const fileName = ticket.file_url.split('/').pop()
        if (fileName) {
          await supabase.storage.from('tickets').remove([fileName])
        }
      } catch (error) {
        console.error('Error deleting file from storage:', error)
      }
    }
  }
}

export default new TicketService()
