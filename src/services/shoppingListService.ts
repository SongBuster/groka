import { supabase } from '../lib/supabase'
import productService from './productService'
import categoryService from './categoryService'

export type ShoppingList = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export type ShoppingListItem = {
  id: string
  list_id: string
  user_id: string
  product_id: string | null
  category_id: string | null
  name: string
  quantity: number
  purchased: boolean
  position: number
  notes: string | null
  created_at: string
  updated_at: string
  category?: { id: string; name: string; icon: string | null; color: string | null } | null
}

class ShoppingListService {
  async getLists(userId: string): Promise<ShoppingList[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data as any[]) || []
  }

  async getUnpurchasedItemCount(listId: string, userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('shopping_list_items')
      .select('*', { count: 'exact' })
      .eq('list_id', listId)
      .eq('user_id', userId)
      .eq('purchased', false)
    if (error) throw error
    return count || 0
  }

  async createList(name: string, userId: string): Promise<ShoppingList> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ name, user_id: userId } as any)
      .select('*')
      .single()
    if (error) throw error
    return data as ShoppingList
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async getItems(listId: string, userId: string): Promise<ShoppingListItem[]> {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select(`*, category:categories(id,name,icon,color)`)
      .eq('list_id', listId)
      .eq('user_id', userId)
      .order('position')
      .order('created_at')
    if (error) throw error
    return (data as any[]) || []
  }

  private async matchProduct(name: string, userId: string): Promise<{ product_id: string | null; category_id: string | null }> {
    const candidates = await productService.searchProductsWithPriority(name, userId)
    if (candidates && candidates.length > 0) {
      const p = candidates[0]
      return { product_id: p.id, category_id: p.category_id || null }
    }
    return { product_id: null, category_id: null }
  }

  async addItem(listId: string, name: string, quantity: number, userId: string): Promise<ShoppingListItem> {
    const { product_id, category_id } = await this.matchProduct(name, userId)
    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({ list_id: listId, user_id: userId, name, quantity, product_id, category_id } as any)
      .select('*')
      .single()
    if (error) throw error
    return data as ShoppingListItem
  }

  async updateItem(itemId: string, updates: Partial<Pick<ShoppingListItem,'name'|'quantity'|'purchased'|'category_id'|'notes'>>, userId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', itemId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async deleteItem(itemId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async reorderItems(listId: string, orderedIds: string[], userId: string): Promise<void> {
    const updates = orderedIds.map((id, idx) => ({ id, position: idx }))
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .upsert(updates as any, { onConflict: 'id' })
      .eq('list_id', listId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async getCategories(userId: string) {
    return categoryService.getAll(userId)
  }

  async getRecentItems(userId: string, limit: number = 10): Promise<Partial<ShoppingListItem>[]> {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('name, category_id, category:categories(id,name,icon,color)')
      .eq('user_id', userId)
      .neq('name', '')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    // Deduplicate by name, keeping the most recent
    const seen = new Set<string>()
    const unique: Partial<ShoppingListItem>[] = []
    for (const item of (data as any[]) || []) {
      if (!seen.has(item.name)) {
        seen.add(item.name)
        unique.push(item)
      }
    }
    return unique
  }

  async getRecentlyPurchasedItems(listId: string, userId: string, limit: number = 10): Promise<ShoppingListItem[]> {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*, category:categories(id,name,icon,color)')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .eq('purchased', true)
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data as any[]) || []
  }
}

export default new ShoppingListService()
