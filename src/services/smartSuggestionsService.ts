import { supabase } from '../lib/supabase'
import suggestionPreferencesService from './suggestionPreferencesService'
import weibullPredictionService, { type PurchaseHistory, type ProductNeedScore } from './weibullPredictionService'

export type ProductSuggestion = {
  product_id: string
  product_name: string
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  last_purchase_date: string
  days_since_last_purchase: number
  average_days_between_purchases: number
  purchase_count: number
  urgency_score: number // Score de necesidad basado en Weibull [0-1+]
  confidence: number // Confianza en la predicción [0-1]
  days_overdue: number // Días de retraso vs esperado
  reason: string // Explicación del score
}

class SmartSuggestionsService {
  /**
   * Obtiene sugerencias de productos usando predicción Weibull avanzada
   * 
   * Algoritmo:
   * 1. Obtener historial de compras por producto
   * 2. Aplicar distribución Weibull para modelar intervalos
   * 3. Calcular probabilidad de necesidad con penalizaciones por churn
   * 4. Filtrar por score mínimo y productos en lista actual
   * 5. Ordenar por urgencia descendente
   */
  async getSmartSuggestions(
    userId: string, 
    shoppingListId?: string,
    minPurchases: number = 2,
    minScore: number = 0.3,
    maxRecencyDays: number = 365
  ): Promise<ProductSuggestion[]> {
    try {
      // 1. Obtener todos los ticket_items con sus fechas de compra (paginado)
      const pageSize = 1000
      let page = 0
      let ticketItems: any[] = []

      while (true) {
        const from = page * pageSize
        const to = from + pageSize - 1

        const { data, error } = await supabase
          .from('ticket_items')
          .select(`
            product_id,
            name,
            created_at,
            tickets!inner(
              user_id,
              purchase_date,
              created_at
            ),
            products(
              name,
              category_id,
              categories(
                name,
                icon
              )
            )
          `)
          .eq('tickets.user_id', userId)
          .not('product_id', 'is', null)
          .order('created_at', { ascending: true })
          .range(from, to)

        if (error) {
          console.error('Error fetching ticket items:', error)
          throw error
        }

        const batch = (data as any[]) || []
        ticketItems = ticketItems.concat(batch)

        if (batch.length < pageSize) break
        page += 1
      }

      if (ticketItems.length === 0) {
        return []
      }

      // Normalization: lowercase, strip accents, punctuation, collapse spaces
      const normalize = (s: string) => s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // 2. Agrupar por product_id y calcular estadísticas
      const productMap = new Map<string, {
        product_id: string
        product_name: string
        category_id: string | null
        category_name: string | null
        category_icon: string | null
        purchase_dates: Date[]
      }>()

      for (const item of ticketItems as any[]) {
        if (!item.product_id) continue

        const purchaseDate = new Date(item.tickets?.purchase_date || item.tickets?.created_at || item.created_at)
        const productName = item.products?.name || item.name
        if (!productName) continue
        const categoryId = item.products?.category_id || null
        const categoryName = item.products?.categories?.name || null
        const categoryIcon = item.products?.categories?.icon || null

        if (!productMap.has(item.product_id)) {
          productMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: productName,
            category_id: categoryId,
            category_name: categoryName,
            category_icon: categoryIcon,
            purchase_dates: []
          })
        } else {
          const existing = productMap.get(item.product_id)!
          const lastKnown = existing.purchase_dates[existing.purchase_dates.length - 1]
          if (!lastKnown || purchaseDate.getTime() >= lastKnown.getTime()) {
            existing.product_name = productName
            existing.category_id = categoryId
            existing.category_name = categoryName
            existing.category_icon = categoryIcon
          }
        }

        productMap.get(item.product_id)!.purchase_dates.push(purchaseDate)
      }

      // 3. Calcular la compra más reciente por nombre (evita duplicados con mismo nombre)
      const latestByName = new Map<string, Date>()
      for (const data of productMap.values()) {
        if (!data.product_name || data.purchase_dates.length === 0) continue
        const maxTs = Math.max(...data.purchase_dates.map(d => d.getTime()))
        const last = new Date(maxTs)
        const key = normalize(data.product_name)
        const existing = latestByName.get(key)
        if (!existing || last.getTime() > existing.getTime()) {
          latestByName.set(key, last)
        }
      }

      // 4. Preparar historial para predicción Weibull
      const history: PurchaseHistory[] = []
      const hiddenProductIds = await suggestionPreferencesService.getHiddenProductIds(userId)

      for (const [, data] of productMap.entries()) {
        // Filtrar productos ocultos
        if (hiddenProductIds.has(data.product_id)) continue

        // Filtrar duplicados por nombre (quedarse con el más reciente)
        const nameKey = normalize(data.product_name)
        const latestForName = latestByName.get(nameKey)
        if (latestForName && data.purchase_dates.length > 0) {
          const lastForProduct = new Date(Math.max(...data.purchase_dates.map(d => d.getTime())))
          if (lastForProduct.getTime() < latestForName.getTime()) continue
        }

        // Filtrar productos con suficiente historial
        if (data.purchase_dates.length < minPurchases) continue

        history.push({
          product_id: data.product_id,
          product_name: data.product_name,
          category_id: data.category_id,
          category_name: data.category_name,
          category_icon: data.category_icon,
          purchase_dates: data.purchase_dates
        })
      }

      // 5. Aplicar predicción Weibull
      const predictions: ProductNeedScore[] = weibullPredictionService.predictNeeds(history, new Date())

      // 6. Convertir a formato de sugerencias y filtrar
      const suggestions: ProductSuggestion[] = predictions
        .filter(p => {
          // Filtrar por score mínimo
          if (p.p_need_score < minScore) return false
          
          // Filtrar por antigüedad máxima
          if (p.days_since_last_purchase > maxRecencyDays) return false
          
          return true
        })
        .map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          category_id: p.category_id,
          category_name: p.category_name,
          category_icon: p.category_icon,
          last_purchase_date: p.last_purchase_date.toISOString(),
          days_since_last_purchase: p.days_since_last_purchase,
          average_days_between_purchases: Math.round(
            p.expected_next_date 
              ? (p.expected_next_date.getTime() - p.last_purchase_date.getTime()) / (1000 * 60 * 60 * 24)
              : 0
          ),
          purchase_count: p.purchase_count,
          urgency_score: parseFloat(p.p_need_score.toFixed(2)),
          confidence: p.confidence,
          days_overdue: p.days_overdue,
          reason: p.reason
        }))

      // 5. Filtrar productos ya en la lista actual (si se proporciona)
      let finalSuggestions = suggestions
      
      if (shoppingListId) {
        const { data: currentItems } = await supabase
          .from('shopping_list_items')
          .select('name')
          .eq('list_id', shoppingListId)
          .eq('purchased', false)

        if (currentItems && currentItems.length > 0) {
          // Normalizar nombres para comparación más robusta
          const normalize = (s: string) => s
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}+/gu, '') // Eliminar acentos
            .replace(/[\p{P}\p{S}]+/gu, ' ') // Eliminar puntuación
            .replace(/\s+/g, ' ')
            .trim()
          
          const currentNames = new Set((currentItems as any[]).map((i: any) => normalize(i.name)))
          
          finalSuggestions = suggestions.filter(s => 
            !currentNames.has(normalize(s.product_name))
          )
        }
      }

      // Ordenar por urgency_score descendente
      return finalSuggestions.sort((a, b) => b.urgency_score - a.urgency_score)

    } catch (error) {
      console.error('Error getting smart suggestions:', error)
      return []
    }
  }

  /**
   * Versión simplificada que retorna las top N sugerencias más urgentes
   */
  async getTopSuggestions(
    userId: string,
    shoppingListId?: string,
    limit: number = 10
  ): Promise<ProductSuggestion[]> {
    const all = await this.getSmartSuggestions(userId, shoppingListId)
    return all.slice(0, limit)
  }
}

export default new SmartSuggestionsService()
