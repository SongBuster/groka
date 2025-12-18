import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

export type ProductWithCategory = Product & {
  category?: {
    id: string
    name: string
    icon: string | null
    color: string | null
  } | null
}

export type ProductStats = {
  total: number
  pending: number
  uncategorized: number
  reviewed: number
}

class ProductService {
  async getAll(): Promise<ProductWithCategory[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .order('name')

    if (error) throw error
    return data as ProductWithCategory[]
  }

  async getByStatus(status: 'pending' | 'uncategorized' | 'reviewed'): Promise<ProductWithCategory[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('review_status', status)
      .order('name')

    if (error) throw error
    return data as ProductWithCategory[]
  }

  async getByCategory(categoryId: string): Promise<ProductWithCategory[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('category_id', categoryId)
      .order('name')

    if (error) throw error
    return data as ProductWithCategory[]
  }

  async getStats(): Promise<ProductStats> {
    const { data, error } = await supabase
      .from('products')
      .select('review_status')

    if (error) throw error

    const rows = (data as any[]) || []
    const stats: ProductStats = {
      total: rows.length,
      pending: rows.filter(p => p.review_status === 'pending').length,
      uncategorized: rows.filter(p => p.review_status === 'uncategorized').length,
      reviewed: rows.filter(p => p.review_status === 'reviewed').length,
    }

    return stats
  }

  async searchProducts(query: string): Promise<ProductWithCategory[]> {
    const q = (query || '').trim()
    if (!q) return []

    // Normalization: lowercase, strip accents, punctuation, collapse spaces
    const normalize = (s: string) => s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const nq = normalize(q)

    // Fetch products in batches to support alias scanning across large catalogs
    const pageSize = 1000
    const maxPages = 5
    let all: any[] = []
    for (let page = 0; page < maxPages; page++) {
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, aliases, category_id,
          category:categories(id, name, icon, color)
        `)
        .order('name')
        .range(from, to)

      if (error) throw error
      const batch = (data as any[]) || []
      all = all.concat(batch)
      if (batch.length < pageSize) break // no more rows
      // Early stop if we already have plenty of matches
      const tmp = all.filter((p: any) => {
        const nName = p?.name ? normalize(p.name) : ''
        const nameMatch = nName.includes(nq)
        const aliases: string[] = Array.isArray(p?.aliases) ? p.aliases : []
        const aliasMatch = aliases.some(a => normalize(a).includes(nq))
        return nameMatch || aliasMatch
      })
      if (tmp.length >= 50) break
    }

    const list = (all as any[]).filter((p: any) => {
      const nName = p?.name ? normalize(p.name) : ''
      const nameMatch = nName.includes(nq)
      const aliases: string[] = Array.isArray(p?.aliases) ? p.aliases : []
      const aliasMatch = aliases.some(a => {
        const normalized = normalize(a)
        return normalized.includes(nq)
      })
      return nameMatch || aliasMatch
    }) as ProductWithCategory[]

    // Sort: alias matches first, then name, then by name asc
    list.sort((a: any, b: any) => {
      const aAlias = (Array.isArray(a.aliases) ? a.aliases : []).some((x: string) => normalize(x).includes(nq))
      const bAlias = (Array.isArray(b.aliases) ? b.aliases : []).some((x: string) => normalize(x).includes(nq))
      if (aAlias !== bAlias) return aAlias ? -1 : 1
      const aNameMatch = normalize(a.name).includes(nq)
      const bNameMatch = normalize(b.name).includes(nq)
      if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    // Limit final results
    return list.slice(0, 25)
  }

  /**
   * Search products with priority: first by alias, then by name
   * (Uses same robust logic as searchProducts)
   */
  async searchProductsWithPriority(query: string): Promise<ProductWithCategory[]> {
    // Reuse the robust search logic
    return this.searchProducts(query)
  }

  /**
   * Get the last price of a product from tickets
   */
  async getLastPrice(productId: string): Promise<number | null> {
    try {
      // Get all ticket_items for this product with their ticket dates
      const { data, error } = await supabase
        .from('ticket_items')
        .select('unit_price, created_at, tickets!inner(purchase_date)')
        .eq('product_id', productId)
        .not('unit_price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching last price:', error)
        return null
      }

      if (!data || data.length === 0) return null

      // Sort by ticket purchase_date on the client side and get the most recent
      const sorted = (data as any[]).sort((a, b) => {
        const dateA = a.tickets?.purchase_date || a.created_at
        const dateB = b.tickets?.purchase_date || b.created_at
        return dateB.localeCompare(dateA)
      })

      return sorted[0].unit_price
    } catch (err) {
      console.error('Error in getLastPrice:', err)
      return null
    }
  }

  /**
   * Add an alias to a product
   */
  async addAlias(productId: string, newAlias: string): Promise<void> {
    // Get current product
    const { data: product, error: getError } = await (supabase as any)
      .from('products')
      .select('aliases')
      .eq('id', productId)
      .single()

    if (getError) throw getError
    if (!product) throw new Error('Product not found')

    // Add new alias to array if not already present
    const currentAliases = (product.aliases as any[]) || []
    const lowerNewAlias = newAlias.toLowerCase().trim()
    
    if (!currentAliases.some((a: any) => a.toLowerCase() === lowerNewAlias)) {
      currentAliases.push(lowerNewAlias)
    }

    // Update product
    const { error: updateError } = await (supabase as any)
      .from('products')
      .update({
        aliases: currentAliases,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)

    if (updateError) throw updateError
  }

  /**
   * Remove an alias from a product
   */
  async removeAlias(productId: string, aliasToRemove: string): Promise<void> {
    // Get current product
    const { data: product, error: getError } = await (supabase as any)
      .from('products')
      .select('aliases')
      .eq('id', productId)
      .single()

    if (getError) throw getError
    if (!product) throw new Error('Product not found')

    // Remove alias from array
    const currentAliases = (product.aliases as any[]) || []
    const lowerRemove = aliasToRemove.toLowerCase()
    const updatedAliases = currentAliases.filter(
      (a: any) => a.toLowerCase() !== lowerRemove
    )

    // Update product
    const { error: updateError } = await (supabase as any)
      .from('products')
      .update({
        aliases: updatedAliases,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)

    if (updateError) throw updateError
  }

  async getById(id: string): Promise<ProductWithCategory | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as ProductWithCategory
  }

  async create(product: ProductInsert): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product as any)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, updates: ProductUpdate, userId?: string): Promise<Product> {
    const updateData: ProductUpdate = {
      ...updates,
    }

    // If category is being changed, mark as reviewed
    if (updates.category_id !== undefined) {
      updateData.review_status = 'reviewed'
      updateData.last_reviewed_at = new Date().toISOString()
      if (userId) {
        updateData.last_reviewed_by = userId
      }
    }

    const { data, error } = await (supabase as any)
      .from('products')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string): Promise<void> {
    const { error, data } = await (supabase as any)
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete error:', error)
      throw error
    }
    
    console.log('Delete response:', data)
  }

  async bulkUpdateCategory(productIds: string[], categoryId: string, userId?: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('products')
      .update({
        category_id: categoryId,
        review_status: 'reviewed',
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: userId,
      } as any)
      .in('id', productIds)

    if (error) throw error
  }
}

export default new ProductService()
