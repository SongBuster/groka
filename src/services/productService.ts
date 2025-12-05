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
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50)

    if (error) throw error
    return data as ProductWithCategory[]
  }

  /**
   * Search products with priority: first by alias, then by name
   */
  async searchProductsWithPriority(query: string): Promise<ProductWithCategory[]> {
    if (!query.trim()) return []

    const lowerQuery = query.toLowerCase()

    // Search by aliases first
    const { data: byAlias, error: aliasError } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .filter('aliases', 'cs', `{"${lowerQuery}"}`)
      .order('name')
      .limit(10)

    if (aliasError) {
      // Fallback if the array search fails
      const { data: fallback, error: fallbackError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, icon, color)
        `)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(10)

      if (fallbackError) throw fallbackError
      if (fallback && fallback.length > 0) {
        return fallback as ProductWithCategory[]
      }
    } else if (byAlias && byAlias.length > 0) {
      return byAlias as ProductWithCategory[]
    }

    // Otherwise, search by name
    const { data: byName, error: nameError } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(10)

    if (nameError) throw nameError
    return (byName as ProductWithCategory[]) || []
  }

  /**
   * Get the last price of a product from tickets
   */
  async getLastPrice(productId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('ticket_items')
      .select('unit_price, ticket:tickets!inner(purchase_date)')
      .eq('product_id', productId)
      .not('unit_price', 'is', null)
      .order('ticket.purchase_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return (data as any).unit_price
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
