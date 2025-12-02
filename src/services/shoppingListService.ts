import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row']
type ShoppingListInsert = Database['public']['Tables']['shopping_lists']['Insert']
type ShoppingListItem = Database['public']['Tables']['shopping_list_items']['Row']
type ShoppingListItemInsert = Database['public']['Tables']['shopping_list_items']['Insert']

export class ShoppingListService {
  /**
   * Get all shopping lists for a user
   */
  async getUserLists(userId: string): Promise<ShoppingList[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get active shopping lists
   */
  async getActiveLists(userId: string): Promise<ShoppingList[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get a single list with its items
   */
  async getListWithItems(listId: string): Promise<{
    list: ShoppingList
    items: ShoppingListItem[]
  }> {
    // Get list
    const { data: list, error: listError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('id', listId)
      .single()

    if (listError) throw listError
    if (!list) throw new Error('List not found')

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (itemsError) throw itemsError

    return {
      list,
      items: items || []
    }
  }

  /**
   * Create a new shopping list
   */
  async createList(
    userId: string,
    name: string,
    supermarketId: string,
    description?: string
  ): Promise<ShoppingList> {
    const listData: ShoppingListInsert = {
      owner_id: userId,
      name,
      supermarket_id: supermarketId,
      description: description || null,
      is_active: true
    }

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert(listData as any)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to create list')

    return data
  }

  /**
   * Update a shopping list
   */
  async updateList(
    listId: string,
    updates: {
      name?: string
      description?: string | null
      supermarket_id?: string
      is_active?: boolean
    }
  ): Promise<void> {
    const { error } = await (supabase as any)
      .from('shopping_lists')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', listId)

    if (error) throw error
  }

  /**
   * Delete a shopping list
   */
  async deleteList(listId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', listId)

    if (error) throw error
  }

  /**
   * Mark a list as completed
   */
  async completeList(listId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('shopping_lists')
      .update({
        is_active: false,
        completed_at: new Date().toISOString()
      } as any)
      .eq('id', listId)

    if (error) throw error
  }

  /**
   * Add item to shopping list
   */
  async addItem(
    listId: string,
    name: string,
    quantity: number = 1,
    productId?: string,
    notes?: string
  ): Promise<ShoppingListItem> {
    const itemData: ShoppingListItemInsert = {
      list_id: listId,
      product_id: productId || null,
      name,
      quantity,
      notes: notes || null,
      checked: false
    }

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert(itemData as any)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to add item')

    return data
  }

  /**
   * Update item in shopping list
   */
  async updateItem(
    itemId: string,
    updates: {
      name?: string
      quantity?: number
      notes?: string | null
      checked?: boolean
    }
  ): Promise<void> {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString()
    }

    if (updates.checked !== undefined) {
      updateData.checked_at = updates.checked ? new Date().toISOString() : null
    }

    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .update(updateData)
      .eq('id', itemId)

    if (error) throw error
  }

  /**
   * Delete item from shopping list
   */
  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId)

    if (error) throw error
  }

  /**
   * Get statistics for a list
   */
  async getListStats(listId: string): Promise<{
    totalItems: number
    checkedItems: number
    progress: number
  }> {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('checked')
      .eq('list_id', listId)

    if (error) throw error

    const rows = (data as any[]) || []
    const totalItems = rows.length
    const checkedItems = rows.filter(item => item.checked).length || 0
    const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0

    return {
      totalItems,
      checkedItems,
      progress
    }
  }
}

export default new ShoppingListService()
