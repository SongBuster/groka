import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import weibullPredictionService, { type PurchaseHistory } from './weibullPredictionService'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
type ProductInput = Omit<ProductInsert, 'user_id'>
type ProductUpdateInput = Omit<ProductUpdate, 'user_id'>

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

export type ProductPricePoint = {
  date: string
  price: number
}

export type ProductStatsDetail = {
  firstPurchasedAt: string | null
  lastPurchasedAt: string | null
  purchaseCount: number
  averageDaysBetweenPurchases: number | null
  maxPrice: { value: number; date: string } | null
  minPrice: { value: number; date: string } | null
  lastPrice: { value: number; date: string } | null
  averagePrice: number | null
  priceHistory: ProductPricePoint[]
  // Campos de predicción Weibull
  needScore: number | null // Score de necesidad [0-1+]
  needConfidence: number | null // Confianza [0-1]
  daysOverdue: number | null // Días de retraso vs esperado
  urgencyLevel: 'very-high' | 'high' | 'medium' | 'low' | null // Nivel de urgencia
  needReason: string | null // Explicación
}

class ProductService {
  async getAll(userId: string): Promise<ProductWithCategory[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data as ProductWithCategory[]
  }

  async getByStatus(status: 'pending' | 'uncategorized' | 'reviewed', userId: string): Promise<ProductWithCategory[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('review_status', status)
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data as ProductWithCategory[]
  }

  async getByCategory(categoryId: string, userId: string): Promise<ProductWithCategory[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('category_id', categoryId)
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data as ProductWithCategory[]
  }

  async getStats(userId: string): Promise<ProductStats> {
    const { data, error } = await supabase
      .from('products')
      .select('review_status')
      .eq('user_id', userId)

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

  async searchProducts(query: string, userId: string): Promise<ProductWithCategory[]> {
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
        .eq('user_id', userId)
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
      const aAliasList = Array.isArray(a.aliases) ? a.aliases : []
      const bAliasList = Array.isArray(b.aliases) ? b.aliases : []
      const aAlias = aAliasList.some((x: string) => normalize(x).includes(nq))
      const bAlias = bAliasList.some((x: string) => normalize(x).includes(nq))
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
  async searchProductsWithPriority(query: string, userId: string): Promise<ProductWithCategory[]> {
    return this.searchProducts(query, userId)
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
   * Get detailed product stats based on ticket history
   */
  async getProductStats(productId: string, userId: string): Promise<ProductStatsDetail> {
    try {
      const { data, error } = await supabase
        .from('ticket_items')
        .select('unit_price, total_price, quantity, created_at, tickets!inner(purchase_date, user_id)')
        .eq('product_id', productId)
        .eq('tickets.user_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const rows = (data as any[]) || []
      if (rows.length === 0) {
        return {
          firstPurchasedAt: null,
          lastPurchasedAt: null,
          purchaseCount: 0,
          averageDaysBetweenPurchases: null,
          maxPrice: null,
          minPrice: null,
          lastPrice: null,
          averagePrice: null,
          priceHistory: []
        }
      }

      const priceHistory: ProductPricePoint[] = []
      const purchaseDates: Date[] = []

      for (const row of rows) {
        const dateStr = row.tickets?.purchase_date || row.created_at
        if (!dateStr) continue
        const date = new Date(dateStr)
        purchaseDates.push(date)

        const quantity = row.quantity || 1
        const unit = row.unit_price ?? (row.total_price != null ? row.total_price / quantity : null)
        if (unit != null && Number.isFinite(unit)) {
          priceHistory.push({
            date: date.toISOString(),
            price: Number(unit)
          })
        }
      }

      purchaseDates.sort((a, b) => a.getTime() - b.getTime())
      priceHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      let averageDaysBetweenPurchases: number | null = null
      if (purchaseDates.length >= 2) {
        const intervals: number[] = []
        for (let i = 1; i < purchaseDates.length; i++) {
          const diff = (purchaseDates[i].getTime() - purchaseDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
          intervals.push(diff)
        }
        if (intervals.length > 0) {
          averageDaysBetweenPurchases = intervals.reduce((a, b) => a + b, 0) / intervals.length
        }
      }

      let maxPrice: { value: number; date: string } | null = null
      let minPrice: { value: number; date: string } | null = null
      let lastPrice: { value: number; date: string } | null = null
      let averagePrice: number | null = null

      if (priceHistory.length > 0) {
        let sum = 0
        for (const p of priceHistory) {
          sum += p.price
          if (!maxPrice || p.price > maxPrice.value) maxPrice = { value: p.price, date: p.date }
          if (!minPrice || p.price < minPrice.value) minPrice = { value: p.price, date: p.date }
        }
        averagePrice = sum / priceHistory.length
        const last = priceHistory[priceHistory.length - 1]
        lastPrice = { value: last.price, date: last.date }
      }

      const firstPurchasedAt = purchaseDates.length > 0
        ? purchaseDates[0].toISOString()
        : null
      const lastPurchasedAt = purchaseDates.length > 0
        ? purchaseDates[purchaseDates.length - 1].toISOString()
        : null

      // Calcular score de necesidad usando Weibull
      let needScore: number | null = null
      let needConfidence: number | null = null
      let daysOverdue: number | null = null
      let urgencyLevel: 'very-high' | 'high' | 'medium' | 'low' | null = null
      let needReason: string | null = null

      if (purchaseDates.length >= 2) {
        // Obtener producto info para Weibull
        const { data: productData } = await supabase
          .from('products')
          .select('id, name, category_id, categories(id, name, icon)')
          .eq('id', productId)
          .single()

        if (productData) {
          const history: PurchaseHistory = {
            product_id: productData.id,
            product_name: productData.name,
            category_id: productData.category_id,
            category_name: (productData as any).categories?.name || null,
            category_icon: (productData as any).categories?.icon || null,
            purchase_dates: purchaseDates
          }

          const predictions = weibullPredictionService.predictNeeds([history], new Date())
          if (predictions.length > 0) {
            const prediction = predictions[0]
            needScore = prediction.p_need_score
            needConfidence = prediction.confidence
            daysOverdue = prediction.days_overdue
            needReason = prediction.reason

            // Determinar nivel de urgencia
            if (needScore >= 0.8) urgencyLevel = 'very-high'
            else if (needScore >= 0.6) urgencyLevel = 'high'
            else if (needScore >= 0.4) urgencyLevel = 'medium'
            else urgencyLevel = 'low'
          }
        }
      }

      return {
        firstPurchasedAt,
        lastPurchasedAt,
        purchaseCount: purchaseDates.length,
        averageDaysBetweenPurchases,
        maxPrice,
        minPrice,
        lastPrice,
        averagePrice,
        priceHistory,
        needScore,
        needConfidence,
        daysOverdue,
        urgencyLevel,
        needReason
      }
    } catch (error) {
      console.error('Error getting product stats:', error)
      return {
        firstPurchasedAt: null,
        lastPurchasedAt: null,
        purchaseCount: 0,
        averageDaysBetweenPurchases: null,
        maxPrice: null,
        minPrice: null,
        lastPrice: null,
        averagePrice: null,
        priceHistory: [],
        needScore: null,
        needConfidence: null,
        daysOverdue: null,
        urgencyLevel: null,
        needReason: null
      }
    }
  }

  /**
   * Add an alias to a product
   */
  async addAlias(productId: string, newAlias: string, userId: string): Promise<void> {
    const alias = newAlias.trim()
    if (!alias) return

    // Fetch existing aliases
    const { data: product, error: getError } = await supabase
      .from('products')
      .select('aliases')
      .eq('id', productId)
      .eq('user_id', userId)
      .single()

    if (getError) throw getError
    if (!product) throw new Error('Product not found')

    const currentAliases = Array.isArray((product as any).aliases) ? (product as any).aliases as string[] : []
    if (currentAliases.some(a => a.toLowerCase() === alias.toLowerCase())) return
    const updatedAliases = [...currentAliases, alias]

    const { error: updateError } = await (supabase as any)
      .from('products')
      .update({ aliases: updatedAliases, updated_at: new Date().toISOString() } as any)
      .eq('id', productId)
      .eq('user_id', userId)
    if (updateError) throw updateError
  }

  /**
   * Remove an alias from a product
   */
  async removeAlias(productId: string, aliasToRemove: string, userId: string): Promise<void> {
    const { data: product, error: getError } = await supabase
      .from('products')
      .select('aliases')
      .eq('id', productId)
      .eq('user_id', userId)
      .single()

    if (getError) throw getError
    if (!product) throw new Error('Product not found')

    const currentAliases = Array.isArray((product as any).aliases) ? (product as any).aliases as string[] : []
    const updatedAliases = currentAliases.filter(a => a.toLowerCase() !== aliasToRemove.toLowerCase())

    const { error: updateError } = await (supabase as any)
      .from('products')
      .update({ aliases: updatedAliases, updated_at: new Date().toISOString() } as any)
      .eq('id', productId)
      .eq('user_id', userId)
    if (updateError) throw updateError
  }

  async getById(id: string, userId: string): Promise<ProductWithCategory | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, icon, color)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data as ProductWithCategory
  }

  async create(product: ProductInput, userId: string): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, user_id: userId } as any)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, updates: ProductUpdateInput, userId: string): Promise<Product> {
    const updateData: ProductUpdate = {
      ...updates,
      user_id: userId,
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
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error, data } = await (supabase as any)
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Delete error:', error)
      throw error
    }
    
    console.log('Delete response:', data)
  }

  async bulkUpdateCategory(productIds: string[], categoryId: string, userId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('products')
      .update({
        category_id: categoryId,
        review_status: 'reviewed',
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: userId,
      } as any)
      .in('id', productIds)
      .eq('user_id', userId)

    if (error) throw error
  }
}

export default new ProductService()
