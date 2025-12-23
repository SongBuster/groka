import { supabase } from '../lib/supabase'

export type SuggestionPreference = {
  id: string
  user_id: string
  product_id: string
  action: 'hide_temporary' | 'hide_permanent'
  hide_until: string | null
  created_at: string
  updated_at: string
}

class SuggestionPreferencesService {
  /**
   * Ocultar una sugerencia temporalmente
   */
  async hideTemporary(productId: string, days: number, userId: string): Promise<void> {
    const hideUntil = new Date()
    hideUntil.setDate(hideUntil.getDate() + days)

    const { error } = await supabase
      .from('suggestion_preferences')
      .upsert({
        user_id: userId,
        product_id: productId,
        action: 'hide_temporary' as const,
        hide_until: hideUntil.toISOString()
      } as any, {
        onConflict: 'user_id,product_id'
      })

    if (error) throw error
  }

  /**
   * Ocultar una sugerencia permanentemente
   */
  async hidePermanent(productId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('suggestion_preferences')
      .upsert({
        user_id: userId,
        product_id: productId,
        action: 'hide_permanent' as const,
        hide_until: null
      } as any, {
        onConflict: 'user_id,product_id'
      })

    if (error) throw error
  }

  /**
   * Eliminar una preferencia (restaurar sugerencias)
   */
  async removePreference(productId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('suggestion_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId)

    if (error) throw error
  }

  /**
   * Obtener todas las preferencias activas de un usuario
   * (excluye las temporales ya expiradas)
   */
  async getActivePreferences(userId: string): Promise<SuggestionPreference[]> {
    const now = new Date()
    
    // Obtener TODAS las preferencias del usuario
    const { data, error } = await supabase
      .from('suggestion_preferences')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error
    
    // Filtrar en código las que están activas
    const activePreferences = (data as SuggestionPreference[])?.filter(pref => {
      if (pref.action === 'hide_permanent') {
        return true
      }
      
      if (pref.action === 'hide_temporary' && pref.hide_until) {
        const hideUntilDate = new Date(pref.hide_until)
        return hideUntilDate > now
      }
      
      return false
    }) || []
    
    return activePreferences
  }

  /**
   * Obtener IDs de productos que deben ser ocultados
   */
  async getHiddenProductIds(userId: string): Promise<Set<string>> {
    const preferences = await this.getActivePreferences(userId)
    return new Set(preferences.map(p => p.product_id))
  }
}

export default new SuggestionPreferencesService()
