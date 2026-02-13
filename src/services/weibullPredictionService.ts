/**
 * Servicio de predicción de necesidades basado en distribución Weibull
 * 
 * Implementa un algoritmo sofisticado que:
 * - Ajusta distribuciones Weibull a intervalos de compra
 * - Aplica penalizaciones por churn (productos no comprados recientemente)
 * - Considera patrones de días de la semana
 * - Filtra outliers estadísticamente
 * - Calcula confianza basada en regularidad
 */

export type PurchaseHistory = {
  product_id: string
  product_name: string
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  purchase_dates: Date[]
}

export type ProductNeedScore = {
  product_id: string
  product_name: string
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  p_need_score: number // Probabilidad ponderada de necesidad [0-1]
  expected_next_date: Date | null
  days_overdue: number
  confidence: number // [0-1]
  last_purchase_date: Date
  days_since_last_purchase: number
  purchase_count: number
  reason: string
}

class WeibullPredictionService {
  /**
   * Calcula la función Gamma usando aproximación de Stirling
   */
  private gamma(z: number): number {
    if (z === 1) return 1
    if (z === 2) return 1
    if (z < 0.5) {
      // Reflexión para z < 0.5
      return Math.PI / (Math.sin(Math.PI * z) * this.gamma(1 - z))
    }
    
    // Aproximación de Stirling para Gamma
    z -= 1
    const p = [
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ]
    
    let y = 0.99999999999980993
    for (let i = 0; i < p.length; i++) {
      y += p[i] / (z + i + 1)
    }
    
    const t = z + p.length - 0.5
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * y
  }

  /**
   * Calcula intervalos entre fechas en días
   */
  private calculateIntervals(dates: Date[]): number[] {
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      const days = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      intervals.push(days)
    }
    return intervals
  }

  /**
   * Elimina intervalos de 0 días (compras duplicadas el mismo día)
   */
  private removeZeroIntervals(intervals: number[]): number[] {
    return intervals.filter(x => x > 0)
  }

  /**
   * Recorta outliers usando percentiles
   */
  private clipOutliers(intervals: number[], p10: number = 10, p90: number = 90): number[] {
    if (intervals.length < 3) return intervals
    
    const sorted = [...intervals].sort((a, b) => a - b)
    const idx10 = Math.floor(intervals.length * p10 / 100)
    const idx90 = Math.ceil(intervals.length * p90 / 100) - 1
    
    const lower = sorted[idx10]
    const upper = sorted[idx90]
    
    return intervals.filter(x => x >= lower && x <= upper)
  }

  /**
   * Ajusta parámetros de Weibull (k, λ) usando método de momentos
   */
  private fitWeibullByMoments(intervals: number[]): { k: number; lambda: number } {
    if (intervals.length < 2) {
      return { k: 2, lambda: 30 } // Valores por defecto
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / intervals.length
    const cv = Math.sqrt(variance) / mean // Coeficiente de variación

    // Estimar k basándose en el coeficiente de variación
    // CV bajo -> k alto (más regular), CV alto -> k bajo (más irregular)
    let k: number
    if (cv < 0.3) {
      k = 3.5 // Muy regular
    } else if (cv < 0.5) {
      k = 2.5 // Regular
    } else if (cv < 0.8) {
      k = 2.0 // Moderado
    } else if (cv < 1.2) {
      k = 1.5 // Irregular
    } else {
      k = 1.2 // Muy irregular
    }

    // Estimar lambda usando la media y k
    // mean = lambda * Gamma(1 + 1/k)
    const lambda = mean / this.gamma(1 + 1 / k)

    return { k, lambda }
  }

  /**
   * Calcula multiplicador basado en día de la semana (opcional)
   */
  private dowMultiplier(dates: Date[], today: Date): number {
    if (dates.length < 3) return 1.0

    // Contar compras por día de la semana
    const dowCounts = new Array(7).fill(0)
    dates.forEach(d => {
      const dow = d.getDay()
      dowCounts[dow]++
    })

    // Laplace smoothing
    const totalPurchases = dates.length
    const todayDow = today.getDay()
    const todayCount = dowCounts[todayDow]
    
    // Probabilidad suavizada
    const smoothed = (todayCount + 1) / (totalPurchases + 7)
    const uniform = 1 / 7
    
    // Multiplicador: si es un día típico de compra, aumenta
    return smoothed / uniform
  }

  /**
   * Restringe valor entre 0 y 1
   */
  private clamp(value: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(max, value))
  }

  /**
   * Calcula confianza basada en regularidad de intervalos
   */
  private computeConfidence(intervals: number[]): number {
    if (intervals.length < 2) return 0.3
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    const cv = stdDev / mean

    // Mapear CV a confianza [0-1]
    // CV bajo = alta confianza, CV alto = baja confianza
    if (cv < 0.2) return 1.0
    if (cv < 0.4) return 0.9
    if (cv < 0.6) return 0.8
    if (cv < 0.8) return 0.7
    if (cv < 1.0) return 0.6
    if (cv < 1.5) return 0.5
    return 0.4
  }

  /**
   * Genera explicación legible del score
   */
  private explainScore(
    daysSince: number,
    expectedDays: number,
    confidence: number
  ): string {
    const ratio = daysSince / expectedDays
    const confText = confidence > 0.8 ? 'alta' : confidence > 0.6 ? 'media' : 'baja'

    if (ratio > 2) {
      return `Muy retrasado (${Math.round(daysSince)} días vs ${Math.round(expectedDays)} esperados). Confianza: ${confText}.`
    } else if (ratio > 1.5) {
      return `Bastante retrasado (${Math.round(daysSince)} días vs ${Math.round(expectedDays)} esperados). Confianza: ${confText}.`
    } else if (ratio > 1.1) {
      return `Algo retrasado (${Math.round(daysSince)} días vs ${Math.round(expectedDays)} esperados). Confianza: ${confText}.`
    } else if (ratio > 0.9) {
      return `Próximo a comprar (${Math.round(daysSince)} días vs ${Math.round(expectedDays)} esperados). Confianza: ${confText}.`
    } else {
      return `Aún temprano (${Math.round(daysSince)} días vs ${Math.round(expectedDays)} esperados). Confianza: ${confText}.`
    }
  }

  /**
   * Predice necesidades de compra usando distribución Weibull
   */
  predictNeeds(history: PurchaseHistory[], today: Date = new Date()): ProductNeedScore[] {
    const results: ProductNeedScore[] = []

    for (const product of history) {
      const dates = [...product.purchase_dates].sort((a, b) => a.getTime() - b.getTime())
      
      // Necesitamos al menos 2 compras
      if (dates.length < 2) continue

      // Calcular intervalos y limpiar
      let intervals = this.calculateIntervals(dates)
      intervals = this.removeZeroIntervals(intervals)
      
      if (intervals.length < 1) continue

      intervals = this.clipOutliers(intervals)

      // Días desde última compra
      const lastDate = dates[dates.length - 1]
      const daysSince = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)

      // Ajustar Weibull
      let k: number, lambda: number
      if (intervals.length >= 3) {
        ({ k, lambda } = this.fitWeibullByMoments(intervals))
      } else {
        // Fallback: usar valores conservadores
        k = 2
        lambda = intervals.length > 0 
          ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
          : 30
      }

      // Probabilidad base de Weibull: P(T ≤ d) = 1 - exp(-(d/λ)^k)
      const p_base = 1 - Math.exp(-Math.pow(daysSince / lambda, k))

      // Multiplicador de día de la semana
      const m_dow = this.dowMultiplier(dates, today)
      let p_season = this.clamp(p_base * m_dow)

      // Valor esperado de Weibull
      const expected = lambda * this.gamma(1 + 1 / k)
      const ratio = daysSince / expected

      // Penalización por churn (abandono)
      let churnPenalty = 1.0
      if (daysSince > 180 || ratio > 3) {
        churnPenalty = Math.exp(-0.45 * (ratio - 1))
      }

      const p_final = p_season * churnPenalty

      // Confianza basada en regularidad
      const confidence = this.computeConfidence(intervals)

      // Score final ponderado por confianza
      const p_scored = p_final * (0.5 + 0.5 * confidence)

      const expectedNextDate = new Date(lastDate.getTime() + expected * 24 * 60 * 60 * 1000)
      const daysOverdue = daysSince - expected

      results.push({
        product_id: product.product_id,
        product_name: product.product_name,
        category_id: product.category_id,
        category_name: product.category_name,
        category_icon: product.category_icon,
        p_need_score: parseFloat(p_scored.toFixed(4)),
        expected_next_date: expectedNextDate,
        days_overdue: Math.round(daysOverdue),
        confidence: parseFloat(confidence.toFixed(2)),
        last_purchase_date: lastDate,
        days_since_last_purchase: Math.round(daysSince),
        purchase_count: dates.length,
        reason: this.explainScore(daysSince, expected, confidence)
      })
    }

    // Ordenar por score descendente
    return results.sort((a, b) => b.p_need_score - a.p_need_score)
  }
}

export default new WeibullPredictionService()
