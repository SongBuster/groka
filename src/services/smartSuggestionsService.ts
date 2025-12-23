import { supabase } from '../lib/supabase'

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
  urgency_score: number // Cuanto mayor, más urgente (days_since / average_days)
}

class SmartSuggestionsService {
  /**
   * Obtiene sugerencias de productos basadas en patrones de compra históricos
   * 
   * Lógica:
   * 1. Obtener todos los productos comprados al menos minPurchases veces
   * 2. Calcular el intervalo promedio entre compras
   * 3. Calcular días desde última compra
   * 4. Si días desde última compra >= promedio * threshold, sugerir
   * 5. Calcular urgency_score = días_desde / promedio (>1 = atrasado)
   */
  async getSmartSuggestions(
    userId: string, 
    shoppingListId?: string,
    minPurchases: number = 3,
    urgencyThreshold: number = 0.8
  ): Promise<ProductSuggestion[]> {
    try {
      // 1. Obtener todos los ticket_items con sus fechas de compra
      const { data: ticketItems, error } = await supabase
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

      if (error) {
        console.error('Error fetching ticket items:', error)
        throw error
      }

      if (!ticketItems || ticketItems.length === 0) {
        return []
      }

      // 2. Agrupar por producto y calcular estadísticas
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
        }

        productMap.get(item.product_id)!.purchase_dates.push(purchaseDate)
      }

      // 3. Calcular sugerencias
      const suggestions: ProductSuggestion[] = []
      const now = new Date()

      for (const [productId, data] of productMap.entries()) {
        // Filtrar productos con suficiente historial
        if (data.purchase_dates.length < minPurchases) continue

        // Ordenar fechas
        const sortedDates = data.purchase_dates.sort((a, b) => a.getTime() - b.getTime())
        
        // Calcular intervalos entre compras
        const intervals: number[] = []
        for (let i = 1; i < sortedDates.length; i++) {
          const daysBetween = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
          intervals.push(daysBetween)
        }

        // Promedio de días entre compras
        const averageDays = intervals.reduce((a, b) => a + b, 0) / intervals.length

        // Días desde última compra
        const lastPurchaseDate = sortedDates[sortedDates.length - 1]
        const daysSinceLast = (now.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)

        // Calcular urgency score
        const urgencyScore = daysSinceLast / averageDays

        // Solo sugerir si ha pasado suficiente tiempo
        if (urgencyScore >= urgencyThreshold) {
          suggestions.push({
            product_id: productId,
            product_name: data.product_name,
            category_id: data.category_id,
            category_name: data.category_name,
            category_icon: data.category_icon,
            last_purchase_date: lastPurchaseDate.toISOString(),
            days_since_last_purchase: Math.round(daysSinceLast),
            average_days_between_purchases: Math.round(averageDays),
            purchase_count: data.purchase_dates.length,
            urgency_score: parseFloat(urgencyScore.toFixed(2))
          })
        }
      }

      // 4. Filtrar productos ya en la lista actual (si se proporciona)
      let finalSuggestions = suggestions
      
      if (shoppingListId) {
        const { data: currentItems } = await supabase
          .from('shopping_list_items')
          .select('name')
          .eq('list_id', shoppingListId)
          .eq('purchased', false)

        console.log('📋 Productos actuales en la lista:', currentItems?.length || 0)

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
          console.log('🔍 Nombres normalizados en lista:', Array.from(currentNames))
          
          const beforeFilter = suggestions.length
          finalSuggestions = suggestions.filter(s => 
            !currentNames.has(normalize(s.product_name))
          )
          console.log(`🎯 Filtrado: ${beforeFilter} → ${finalSuggestions.length} sugerencias`)
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
