import { supabase } from '../lib/supabase'
import suggestionPreferencesService from './suggestionPreferencesService'

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

      // 4. Calcular sugerencias
      const suggestions: ProductSuggestion[] = []
      const now = new Date()
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

        // Ordenar fechas
        const sortedDates = data.purchase_dates.sort((a, b) => a.getTime() - b.getTime())
        
        // Calcular intervalos entre compras
        const intervals: number[] = []
        for (let i = 1; i < sortedDates.length; i++) {
          const daysBetween = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
          intervals.push(daysBetween)
        }

        // === MEJORA 1: Ponderación por recencia ===
        // Dar más peso a los intervalos más recientes (últimos 60% tienen más peso)
        const recentWeight = 1.5  // Los recientes pesan 1.5x más
        const recentCount = Math.ceil(intervals.length * 0.6) // Últimos 60%
        
        let weightedSum = 0
        let totalWeight = 0
        
        intervals.forEach((interval, idx) => {
          const isRecent = idx >= intervals.length - recentCount
          const weight = isRecent ? recentWeight : 1.0
          weightedSum += interval * weight
          totalWeight += weight
        })
        
        const averageDays = weightedSum / totalWeight

        // === MEJORA 2: Calcular desviación estándar ===
        const squaredDiffs = intervals.map(interval => Math.pow(interval - averageDays, 2))
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / intervals.length
        const stdDeviation = Math.sqrt(variance)
        
        // Coeficiente de variación (CV): mide irregularidad relativa
        const coefficientOfVariation = stdDeviation / averageDays
        
        // === MEJORA 3: Factor de confianza basado en regularidad ===
        // CV bajo = alta confianza, CV alto = baja confianza
        let confidenceFactor = 1.0
        if (coefficientOfVariation > 1.0) {
          confidenceFactor = 0.6  // Muy irregular
        } else if (coefficientOfVariation > 0.5) {
          confidenceFactor = 0.8  // Bastante irregular
        } else if (coefficientOfVariation > 0.3) {
          confidenceFactor = 0.9  // Algo irregular
        }
        // Si CV <= 0.3, mantener 1.0 (muy regular)

        // Días desde última compra
        const lastPurchaseDate = sortedDates[sortedDates.length - 1]
        const daysSinceLast = (now.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)

        // Calcular urgency score base
        const baseUrgencyScore = daysSinceLast / averageDays
        
        // Aplicar factor de confianza
        const urgencyScore = baseUrgencyScore * confidenceFactor

        // Solo sugerir si ha pasado suficiente tiempo
        if (urgencyScore >= urgencyThreshold) {
          suggestions.push({
            product_id: data.product_id,
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
