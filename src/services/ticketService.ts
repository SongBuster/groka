import { supabase } from '../lib/supabase'
import pdfParser from './pdfParser'
import { handleSupabaseError } from '../lib/sessionManager'
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
      let supermarketId: string | null = null
      let products: any[] = []

      try {
        const parsedData = await pdfParser.parseTicketFromFile(file)
        parsed = true
        ticketNumber = parsedData.invoiceNumber
        storeName = parsedData.store
        purchaseDate = parsedData.date
        totalAmount = parsedData.totalFromPDF || parsedData.totalAmount
        supermarketId = parsedData.supermarketId
        products = parsedData.products
      } catch (error: any) {
        parsingError = error.message || 'Error parsing PDF'
        console.error('PDF parsing error:', error)
      }

      // 3. Insert ticket record
      const ticketData: TicketInsert = {
        user_id: userId,
        supermarket_id: supermarketId,
        file_name: file.name,
        file_url: publicUrl,
        ticket_number: ticketNumber,
        store_name: storeName,
        purchase_date: purchaseDate,
        total_amount: totalAmount,
        parsed,
        parsing_error: parsingError,
        source_type: 'pdf'
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
        await this.saveTicketItems(ticket.id, products, supermarketId, purchaseDate)
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
  private async saveTicketItems(ticketId: string, products: any[], supermarketId: string | null, purchaseDate: string | null): Promise<void> {
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

      // Update product-supermarket associations if supermarket is known
      if (supermarketId && purchaseDate) {
        await this.updateProductSupermarketAssociations(productIds, products, supermarketId, purchaseDate)
      }
    } catch (error) {
      console.error('Error saving ticket items:', error)
      throw error
    }
  }

  /**
   * Update product-supermarket associations with last price and last seen date
   */
  private async updateProductSupermarketAssociations(
    productIds: (string | null)[],
    products: any[],
    supermarketId: string,
    purchaseDate: string
  ): Promise<void> {
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]
      if (!productId) continue

      const product = products[i]
      const lastPrice = product.unit_price || product.total

      try {
        // Upsert: insert or update if exists
        await supabase
          .from('product_supermarkets')
          .upsert({
            product_id: productId,
            supermarket_id: supermarketId,
            last_price: lastPrice,
            last_seen_at: purchaseDate
          } as any, {
            onConflict: 'product_id,supermarket_id'
          })
      } catch (error) {
        console.error('Error updating product-supermarket association:', error)
        // Don't throw, continue with other products
      }
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
            .insert({ 
              name: product.item_name, 
              alias: null,
              category_id: null 
            } as any)
            .select('id')
            .single() as { data: { id: string } | null, error: any }

          if (error) {
            // Si es error de duplicado (23505), buscar el producto que ya existe
            if (error.code === '23505') {
              const { data: duplicate } = await supabase
                .from('products')
                .select('id')
                .eq('name', product.item_name)
                .maybeSingle() as { data: { id: string } | null }
              
              if (duplicate) {
                productIds.push(duplicate.id)
              } else {
                productIds.push(null)
              }
            } else {
              console.error('Error creating product:', error)
              productIds.push(null)
            }
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

    if (error) {
      handleSupabaseError(error)
      throw error
    }
    return data || []
  }

  /**
   * Process a single pending ticket by downloading and parsing its PDF
   */
  private async processTicketFile(ticket: { id: string; file_url: string | null; file_name: string | null }): Promise<void> {
    if (!ticket.file_url) throw new Error('El ticket no tiene archivo asociado')

    // Extract storage path from public URL or use file_url directly
    // file_url format: https://[project].supabase.co/storage/v1/object/public/tickets/[path]
    let downloadUrl = ticket.file_url
    
    // If bucket is not public, try to create a signed URL
    const urlMatch = ticket.file_url.match(/\/tickets\/(.+)$/)
    if (urlMatch) {
      const storagePath = urlMatch[1]
      try {
        // Try to create a signed URL (valid for 1 hour)
        const { data, error } = await supabase.storage
          .from('tickets')
          .createSignedUrl(storagePath, 3600)
        
        if (!error && data?.signedUrl) {
          downloadUrl = data.signedUrl
          console.log('✓ Using signed URL for download')
        }
      } catch (e) {
        console.warn('Could not create signed URL, using public URL:', e)
      }
    }

    // Download PDF
    const resp = await fetch(downloadUrl)
    if (!resp.ok) throw new Error('No se pudo descargar el PDF')
    const blob = await resp.blob()
    const file = new File([blob], ticket.file_name || `ticket_${ticket.id}.pdf`, { type: 'application/pdf' })

    // Parse PDF
    const parsedData = await pdfParser.parseTicketFromFile(file)

    // Update ticket data
    const updateData: TicketInsert = {
      supermarket_id: parsedData.supermarketId,
      ticket_number: parsedData.invoiceNumber,
      store_name: parsedData.store || parsedData.supermarketName,
      purchase_date: parsedData.date,
      total_amount: parsedData.totalFromPDF ?? parsedData.totalAmount ?? null,
      parsed: true,
      parsing_error: null,
      source_type: 'pdf'
    } as any

    const { error: upErr } = await (supabase.from('tickets') as any)
      .update(updateData as any)
      .eq('id', ticket.id)

    if (upErr) throw upErr

    // Insert items
    if (parsedData.products && parsedData.products.length > 0) {
      const items = parsedData.products.map((p: any) => ({
        ticket_id: ticket.id,
        product_name: p.item_name || p.name || 'Producto',
        quantity: p.quantity ?? p.weight_kg ?? p.cantidad ?? 1,
        unit_price: p.unit_price ?? p.price_per_kg ?? p.precioUnitario ?? null,
        total_price: p.total ?? p.totalPrice ?? p.precioTotal ?? null,
      }))
      const { error: itemsErr } = await supabase.from('ticket_items').insert(items as any)
      if (itemsErr) console.warn('Insert items error', itemsErr)
    }
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

    if (ticketError) {
      handleSupabaseError(ticketError)
      throw ticketError
    }

    const { data: items, error: itemsError } = await supabase
      .from('ticket_items')
      .select('*')
      .eq('ticket_id', ticketId)

    if (itemsError) throw itemsError

    return { ticket, items: items || [] }
  }

  /**
   * Create a manual ticket (without PDF)
   */
  async createManualTicket(
    userId: string,
    supermarketId: string,
    storeName: string,
    purchaseDate: string,
    ticketNumber: string | null,
    products: Array<{
      product_id: string | null
      name: string
      product_type: 'unit' | 'weight'
      quantity: number
      unit_price: number
      total: number
    }>
  ): Promise<Ticket> {
    try {
      // Calculate total amount
      const totalAmount = products.reduce((sum, p) => sum + p.total, 0)

      // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO timestamp
      const purchaseTimestamp = new Date(purchaseDate).toISOString()

      // Create ticket record
      const ticketData: TicketInsert = {
        user_id: userId,
        supermarket_id: supermarketId || null,
        file_name: 'Manual',
        file_url: null,
        ticket_number: ticketNumber,
        store_name: storeName,
        purchase_date: purchaseTimestamp,
        total_amount: totalAmount,
        parsed: true, // Manual tickets are already "parsed"
        parsing_error: null,
        source_type: 'manual'
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketData as any)
        .select()
        .single() as { data: Ticket | null, error: any }

      if (ticketError) throw ticketError
      if (!ticket) throw new Error('Failed to create ticket')

      // Process products and save ticket items
      if (products.length > 0) {
        await this.saveManualTicketItems(ticket.id, products, supermarketId, purchaseTimestamp)
      }

      return ticket
    } catch (error) {
      console.error('Error creating manual ticket:', error)
      throw error
    }
  }

  /**
   * Save manual ticket items (creates products if needed)
   */
  private async saveManualTicketItems(
    ticketId: string, 
    products: Array<{
      product_id: string | null
      name: string
      product_type: 'unit' | 'weight'
      quantity: number
      unit_price: number
      total: number
    }>,
    supermarketId: string | null = null,
    purchaseDate: string | null = null
  ): Promise<void> {
    try {
      const items = []
      const productIds: string[] = []

      for (const product of products) {
        let productId = product.product_id

        // Si no existe el producto, crearlo
        if (!productId) {
          productId = await this.createProductFromTicket(product.name)
        }

        productIds.push(productId)

        items.push({
          ticket_id: ticketId,
          product_id: productId,
          name: product.name,
          quantity: product.quantity,
          unit_price: product.unit_price,
          total_price: product.total
        })
      }

      const { error } = await supabase.from('ticket_items').insert(items as any)
      if (error) throw error

      // Update product-supermarket associations if supermarket is known
      if (supermarketId && purchaseDate) {
        for (let i = 0; i < productIds.length; i++) {
          const productId = productIds[i]
          const product = products[i]
          
          try {
            await supabase
              .from('product_supermarkets')
              .upsert({
                product_id: productId,
                supermarket_id: supermarketId,
                last_price: product.unit_price,
                last_seen_at: purchaseDate
              } as any, {
                onConflict: 'product_id,supermarket_id'
              })
          } catch (error) {
            console.error('Error updating product-supermarket association:', error)
            // Don't throw, continue with other products
          }
        }
      }
    } catch (error) {
      console.error('Error saving manual ticket items:', error)
      throw error
    }
  }

  /**
   * Create a new product from ticket (with auto-categorization)
   */
  private async createProductFromTicket(productName: string): Promise<string> {
    try {
      // Primero verificar si ya existe
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('name', productName)
        .maybeSingle() as { data: { id: string } | null }

      if (existing) {
        return existing.id
      }

      // Create product directly (will auto-categorize based on keywords via trigger)
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert({
          name: productName,
          alias: null,
          category_id: null
        } as any)
        .select('id')
        .single() as { data: { id: string } | null, error: any }

      if (error) {
        // Si es error de duplicado, buscar el producto
        if (error.code === '23505') {
          const { data: duplicate } = await supabase
            .from('products')
            .select('id')
            .eq('name', productName)
            .maybeSingle() as { data: { id: string } | null }
          
          if (duplicate) {
            return duplicate.id
          }
        }
        console.error('Error creating product:', error)
        throw error
      }
      
      if (!newProduct) {
        throw new Error('Failed to create product')
      }

      return newProduct.id
    } catch (error) {
      console.error('Error creating product from ticket:', error)
      throw error
    }
  }

  /**
   * Update an existing manual ticket
   */
  async updateTicket(
    ticketId: string,
    supermarketId: string,
    storeName: string,
    purchaseDate: string,
    ticketNumber: string | null,
    products: Array<{
      product_id: string | null
      name: string
      product_type: 'unit' | 'weight'
      quantity: number
      unit_price: number
      total: number
    }>
  ): Promise<void> {
    try {
      // Calculate total amount
      const totalAmount = products.reduce((sum, p) => sum + p.total, 0)

      // Convert datetime-local format to ISO timestamp
      const purchaseTimestamp = new Date(purchaseDate).toISOString()

      // Update ticket record
      const { error: ticketError } = await (supabase
        .from('tickets') as any)
        .update({
          supermarket_id: supermarketId || null,
          store_name: storeName,
          ticket_number: ticketNumber,
          purchase_date: purchaseTimestamp,
          total_amount: totalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)

      if (ticketError) throw ticketError

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('ticket_items')
        .delete()
        .eq('ticket_id', ticketId)

      if (deleteError) throw deleteError

      // Insert new items
      if (products.length > 0) {
        await this.saveManualTicketItems(ticketId, products, supermarketId, purchaseTimestamp)
      }
    } catch (error) {
      console.error('Error updating ticket:', error)
      throw error
    }
  }

  /**
   * Get the last price and quantity info for a product
   */
  async getLastProductInfo(productId: string): Promise<{ unitPrice: number; quantity: number } | null> {
    try {
      const { data, error } = await supabase
        .from('ticket_items')
        .select('unit_price, quantity')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { unit_price: number; quantity: number } | null, error: any }

      if (error) throw error
      return data ? { unitPrice: data.unit_price, quantity: data.quantity } : null
    } catch (error) {
      console.error('Error getting last product info:', error)
      return null
    }
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

  /**
   * Process pending tickets (parsed=false) by downloading the PDF and parsing client-side
   */
  async processPendingTickets(userId: string): Promise<{ processed: number; errors: number }> {
    // 1. Fetch pending tickets for user
    const { data: pending, error } = await supabase
      .from('tickets')
      .select('id, file_url, file_name')
      .eq('user_id', userId)
      .eq('parsed', false)

    if (error) throw error
    const tickets: any[] = (pending as any[]) || []
    let processed = 0
    let errors = 0

    for (const t of tickets as any[]) {
      try {
        await this.processTicketFile(t)
        processed++
      } catch (e) {
        console.error('Error processing pending ticket', t.id, e)
        errors++
      }
    }

    return { processed, errors }
  }

  /**
   * Process a specific pending ticket by id
   */
  async processPendingTicket(ticketId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, file_url, file_name, parsed')
      .eq('id', ticketId)
      .maybeSingle() as { data: { id: string; file_url: string | null; file_name: string | null; parsed: boolean } | null, error: any }

    if (error) throw error
    if (!data) return { success: false, error: 'Ticket no encontrado' }
    if (data.parsed) return { success: false, error: 'El ticket ya está parseado' }

    try {
      await this.processTicketFile(data)
      return { success: true }
    } catch (e: any) {
      console.error('Error processing ticket', ticketId, e)
      return { success: false, error: e?.message || 'Error procesando ticket' }
    }
  }
}

export default new TicketService()
