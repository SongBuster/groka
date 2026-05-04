import { supabase } from '../lib/supabase'
import productService from './productService'
import categoryService from './categoryService'

export type ShoppingList = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  is_shared?: boolean
  shared_by_email?: string
  permission?: 'view' | 'edit'
  is_owner?: boolean
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
    // Cargar listas propias
    const { data: ownLists, error: ownError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    
    if (ownError) throw ownError
    
    // Cargar listas compartidas con el usuario
    const { data: sharedData, error: sharedError } = await supabase
      .from('shopping_list_shares')
      .select(`
        permission,
        shared_by_user_id,
        shopping_lists!inner (
          id,
          user_id,
          name,
          created_at,
          updated_at
        )
      `)
      .eq('shared_with_user_id', userId)
    
    if (sharedError) throw sharedError
    
    // Obtener emails de los dueños de listas compartidas
    const sharedListsWithEmails = await Promise.all(
      (sharedData || []).map(async (share: any) => {
        const { data: emailData } = await (supabase.rpc as any)('get_user_by_email_from_id', 
          { user_id: share.shared_by_user_id }
        ) as { data: { email: string }[] | null }
        
        return {
          ...share.shopping_lists,
          is_shared: true,
          shared_by_email: emailData?.[0]?.email || 'Usuario desconocido',
          permission: share.permission,
          is_owner: false
        }
      })
    )
    
    // Marcar listas propias
    const ownListsWithFlag = (ownLists || []).map(list => ({
      ...(list as any),
      is_shared: false,
      is_owner: true
    }))
    
    // Combinar y ordenar por fecha de actualización
    return [...ownListsWithFlag, ...sharedListsWithEmails]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }

  async getUnpurchasedItemCount(listId: string): Promise<number> {
    // No filtramos por user_id para contar items en listas compartidas
    const { count, error } = await supabase
      .from('shopping_list_items')
      .select('*', { count: 'exact' })
      .eq('list_id', listId)
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

  async getList(listId: string, userId: string): Promise<ShoppingList | null> {
    // No filtramos por user_id para permitir acceso a listas compartidas
    // Las políticas RLS se encargan de la seguridad
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('id', listId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // No encontrada o sin acceso
      throw error
    }
    
    // Verificar si es compartida
    const { data: shareData } = await supabase
      .from('shopping_list_shares')
      .select('permission, shared_by_user_id')
      .eq('list_id', listId)
      .eq('shared_with_user_id', userId)
      .maybeSingle()
    
    return {
      ...(data as any),
      is_shared: !!shareData,
      permission: (shareData as any)?.permission,
      is_owner: (data as any).user_id === userId
    } as ShoppingList
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async getItems(listId: string): Promise<ShoppingListItem[]> {
    // No filtramos por user_id para permitir ver items de listas compartidas
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select(`*, category:categories(id,name,icon,color)`)
      .eq('list_id', listId)
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
      .select('*, category:categories(id,name,icon,color)')
      .single()
    if (error) throw error
    return data as ShoppingListItem
  }

  async addItemWithProductId(listId: string, name: string, quantity: number, userId: string, productId: string, categoryId: string | null = null): Promise<ShoppingListItem> {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({ list_id: listId, user_id: userId, name, quantity, product_id: productId, category_id: categoryId } as any)
      .select('*, category:categories(id,name,icon,color)')
      .single()
    if (error) throw error
    return data as ShoppingListItem
  }

  async updateItem(itemId: string, updates: Partial<Pick<ShoppingListItem,'name'|'quantity'|'purchased'|'category_id'|'notes'>>): Promise<void> {
    // No filtramos por user_id - las políticas RLS controlan el acceso
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', itemId)
    if (error) throw error
  }

  async deleteItem(itemId: string): Promise<void> {
    // No filtramos por user_id - las políticas RLS controlan el acceso
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId)
    if (error) throw error
  }

  async reorderItems(listId: string, orderedIds: string[]): Promise<void> {
    // No filtramos por user_id - las políticas RLS controlan el acceso
    const updates = orderedIds.map((id, idx) => ({ id, position: idx }))
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .upsert(updates as any, { onConflict: 'id' })
      .eq('list_id', listId)
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

  async getRecentlyPurchasedItems(listId: string, limit: number = 10): Promise<ShoppingListItem[]> {
    // No filtramos por user_id - las políticas RLS controlan el acceso
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*, category:categories(id,name,icon,color)')
      .eq('list_id', listId)
      .eq('purchased', true)
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data as any[]) || []
  }
}

export default new ShoppingListService()
