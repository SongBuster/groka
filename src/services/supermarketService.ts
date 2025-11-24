import { supabase } from '../lib/supabase'
import { handleSupabaseError } from '../lib/sessionManager'
import type { Database } from '../types/database'

type Supermarket = Database['public']['Tables']['supermarkets']['Row']

export class SupermarketService {
  /**
   * Get all supermarkets
   */
  async getAll(): Promise<Supermarket[]> {
    const { data, error } = await supabase
      .from('supermarkets')
      .select('*')
      .order('name')

    if (error) {
      handleSupabaseError(error)
      throw error
    }
    return data || []
  }

  /**
   * Get supermarket by ID
   */
  async getById(id: string): Promise<Supermarket | null> {
    const { data, error } = await supabase
      .from('supermarkets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      handleSupabaseError(error)
      throw error
    }
    return data
  }

  /**
   * Get supermarket by NIF
   */
  async getByNif(nif: string): Promise<Supermarket | null> {
    const { data, error } = await supabase
      .from('supermarkets')
      .select('*')
      .eq('nif', nif)
      .maybeSingle()

    if (error) {
      handleSupabaseError(error)
      throw error
    }
    return data
  }

  /**
   * Get supermarket by name (fuzzy match)
   */
  async getByName(name: string): Promise<Supermarket | null> {
    const { data, error } = await supabase
      .from('supermarkets')
      .select('*')
      .ilike('name', `%${name}%`)
      .maybeSingle()

    if (error) {
      handleSupabaseError(error)
      throw error
    }
    return data
  }

  /**
   * Detect supermarket from text (by NIF or name)
   */
  async detectFromText(text: string): Promise<Supermarket | null> {
    // Try to find by NIF first (more reliable)
    const nifMatch = text.match(/[A-Z]-?\d{8}/g)
    if (nifMatch) {
      for (const nif of nifMatch) {
        const cleanNif = nif.replace('-', '')
        const supermarket = await this.getByNif(cleanNif)
        if (supermarket) return supermarket
      }
    }

    // Try to find by name
    const supermarkets = await this.getAll()
    for (const supermarket of supermarkets) {
      if (text.toUpperCase().includes(supermarket.name.toUpperCase())) {
        return supermarket
      }
    }

    return null
  }
}

export default new SupermarketService()
