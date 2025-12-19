import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Category = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']
type CategoryInput = Omit<CategoryInsert, 'user_id'>
type CategoryUpdateInput = Omit<CategoryUpdate, 'user_id'>

class CategoryService {
  async getAll(userId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data
  }

  async getById(id: string, userId: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  }

  async create(category: CategoryInput, userId: string): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...category, user_id: userId } as any)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, updates: CategoryUpdateInput, userId: string): Promise<Category> {
    const { data, error } = await (supabase as any)
      .from('categories')
      .update({ ...updates, user_id: userId } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  }
}

export default new CategoryService()
