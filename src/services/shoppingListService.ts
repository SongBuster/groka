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
   * Get a single list by ID
   */
  async getListById(listId: string): Promise<ShoppingList> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('id', listId)
      .single()

    if (error) throw error
    if (!data) throw new Error('List not found')

    return data
  }

  /**
   * Get items from a list with product details
   */
  async getListItems(listId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select(`
        *,
        product:products(
          id,
          name,
          aliases,
          category:categories(id, name, icon, color)
        )
      `)
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  /**
   * Add item to shopping list
   */
  async addItem(
    listId: string,
    itemData: {
      product_id?: string | null
      name: string
      quantity?: number
      weight?: number | null
      estimated_price?: number | null
      notes?: string | null
    }
  ): Promise<ShoppingListItem> {
    const insertData: ShoppingListItemInsert = {
      list_id: listId,
      product_id: itemData.product_id || null,
      name: itemData.name,
      quantity: itemData.quantity || 1,
      weight: itemData.weight || null,
      estimated_price: itemData.estimated_price || null,
      notes: itemData.notes || null,
      checked: false
    }

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert(insertData as any)
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
      weight?: number | null
      actual_price?: number | null
      notes?: string | null
      checked?: boolean
      checked_at?: string | null
      checked_by?: string | null
    }
  ): Promise<void> {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString()
    }

    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .update(updateData)
      .eq('id', itemId)

    if (error) throw error
  }

  /**
   * Remove item from shopping list
   */
  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId)

    if (error) throw error
  }

  /**
   * Delete item from shopping list (alias for removeItem)
   */
  async deleteItem(itemId: string): Promise<void> {
    return this.removeItem(itemId)
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

  /**
   * Update estimated prices for shopping list items based on latest ticket prices
   */
  async updatePricesFromTickets(listId: string, userId: string): Promise<void> {
    try {
      // Get all items in the shopping list
      const { data: listItems, error: itemsError } = await supabase
        .from('shopping_list_items')
        .select('id, product_id, name, estimated_price')
        .eq('list_id', listId)

      if (itemsError) throw itemsError

      if (!listItems || listItems.length === 0) return

      // Get all tickets for this user
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id')
        .eq('user_id', userId)

      if (ticketsError) throw ticketsError

      if (!tickets || tickets.length === 0) return

      const ticketIds = (tickets as any[]).map(t => t.id)

      // For each list item, find the latest price from ticket items
      for (const item of (listItems as any[])) {
        // Skip if already has an estimated price
        if (item.estimated_price) continue

        let latestPrice: number | null = null

        // Search by product_id if available
        if (item.product_id) {
          const { data: ticketItems } = await supabase
            .from('ticket_items')
            .select('unit_price, created_at')
            .eq('product_id', item.product_id)
            .in('ticket_id', ticketIds)
            .order('created_at', { ascending: false })
            .limit(1)

          if (ticketItems && (ticketItems as any[]).length > 0 && (ticketItems as any[])[0].unit_price) {
            latestPrice = (ticketItems as any[])[0].unit_price
          }
        }

        // If not found by product_id, search by name (case-insensitive)
        if (!latestPrice) {
          const { data: ticketItems } = await supabase
            .from('ticket_items')
            .select('unit_price, created_at')
            .ilike('name', `%${item.name}%`)
            .in('ticket_id', ticketIds)
            .order('created_at', { ascending: false })
            .limit(1)

          if (ticketItems && (ticketItems as any[]).length > 0 && (ticketItems as any[])[0].unit_price) {
            latestPrice = (ticketItems as any[])[0].unit_price
          }
        }

        // Update the item if we found a price
        if (latestPrice) {
          const { error: updateError } = await (supabase as any)
            .from('shopping_list_items')
            .update({ estimated_price: latestPrice })
            .eq('id', item.id)

          if (updateError) {
            console.error(`Failed to update price for item ${item.id}:`, updateError)
          }
        }
      }
    } catch (error) {
      console.error('Error updating prices from tickets:', error)
      throw error
    }
  }
}

export default new ShoppingListService()
