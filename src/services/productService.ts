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
      .or(`name.ilike.%${query}%,alias.ilike.%${query}%`)
      .order('name')
      .limit(50)

    if (error) throw error
    return data as ProductWithCategory[]
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
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw error
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
