import { supabase } from '../lib/supabase'

export type ShoppingListShare = {
  id: string
  list_id: string
  shared_with_user_id: string
  shared_by_user_id: string
  permission: 'view' | 'edit'
  created_at: string
  updated_at: string
  shared_with_email?: string
  shared_with_name?: string
}

class ShoppingListShareService {
  /**
   * Compartir una lista con un usuario por email
   */
  async shareList(listId: string, email: string, permission: 'view' | 'edit', currentUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Buscar el usuario por email usando la función RPC
      const { data: users, error: rpcError } = await (supabase.rpc as any)('get_user_by_email', { user_email: email }) as { data: { id: string; email: string }[] | null; error: any }
      
      if (rpcError || !users || users.length === 0) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      const targetUserId = users[0].id

      // No puedes compartir contigo mismo
      if (targetUserId === currentUserId) {
        return { success: false, error: 'No puedes compartir una lista contigo mismo' }
      }

      // Verificar que el usuario actual es el dueño de la lista
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select('user_id')
        .eq('id', listId)
        .single()

      if (listError || !list || (list as any).user_id !== currentUserId) {
        return { success: false, error: 'No tienes permiso para compartir esta lista' }
      }

      // Crear el compartido
      const { error: shareError } = await supabase
        .from('shopping_list_shares')
        .insert({
          list_id: listId,
          shared_with_user_id: targetUserId,
          shared_by_user_id: currentUserId,
          permission
        } as any)

      if (shareError) {
        if (shareError.code === '23505') { // Unique constraint violation
          return { success: false, error: 'Esta lista ya está compartida con este usuario' }
        }
        throw shareError
      }

      return { success: true }
    } catch (error) {
      console.error('Error sharing list:', error)
      return { success: false, error: 'Error al compartir la lista' }
    }
  }

  /**
   * Obtener usuarios con los que se ha compartido una lista
   */
  async getListShares(listId: string): Promise<ShoppingListShare[]> {
    try {
      const { data, error } = await supabase
        .from('shopping_list_shares')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const shares = (data as any[]) || []
      
      // Obtener emails de los usuarios compartidos
      const sharesWithEmails = await Promise.all(
        shares.map(async (share) => {
          const { data: userData } = await (supabase.rpc as any)('get_user_by_email_from_id', { user_id: share.shared_with_user_id }) as { data: { id: string; email: string }[] | null }
          
          return {
            id: share.id,
            list_id: share.list_id,
            shared_with_user_id: share.shared_with_user_id,
            shared_by_user_id: share.shared_by_user_id,
            permission: share.permission,
            created_at: share.created_at,
            updated_at: share.updated_at,
            shared_with_email: userData?.[0]?.email || `Usuario ${share.shared_with_user_id.substring(0, 8)}...`
          }
        })
      )

      return sharesWithEmails
    } catch (error) {
      console.error('Error fetching list shares:', error)
      return []
    }
  }

  /**
   * Eliminar un compartido (dejar de compartir con un usuario)
   */
  async unshareList(shareId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verificar que el usuario actual es el dueño de la lista
      const { data: share } = await supabase
        .from('shopping_list_shares')
        .select('list_id')
        .eq('id', shareId)
        .single()

      if (!share) {
        return { success: false, error: 'Compartido no encontrado' }
      }

      const { data: list } = await supabase
        .from('shopping_lists')
        .select('user_id')
        .eq('id', (share as any).list_id)
        .single()

      if (!list || (list as any).user_id !== currentUserId) {
        return { success: false, error: 'No tienes permiso para modificar esta lista' }
      }

      const { error } = await supabase
        .from('shopping_list_shares')
        .delete()
        .eq('id', shareId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error unsharing list:', error)
      return { success: false, error: 'Error al dejar de compartir' }
    }
  }

  /**
   * Actualizar permisos de un compartido
   */
  async updateSharePermission(shareId: string, permission: 'view' | 'edit'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await (supabase
        .from('shopping_list_shares') as any)
        .update({ permission })
        .eq('id', shareId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error updating share permission:', error)
      return { success: false, error: 'Error al actualizar permisos' }
    }
  }

  /**
   * Verificar si un usuario tiene acceso a una lista
   */
  async hasAccess(listId: string, userId: string): Promise<{ hasAccess: boolean; permission?: 'view' | 'edit'; isOwner: boolean }> {
    // Verificar si es el dueño
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('user_id')
      .eq('id', listId)
      .single()

    if (list && (list as any).user_id === userId) {
      return { hasAccess: true, permission: 'edit', isOwner: true }
    }

    // Verificar si tiene acceso compartido
    const { data: share } = await supabase
      .from('shopping_list_shares')
      .select('permission')
      .eq('list_id', listId)
      .eq('shared_with_user_id', userId)
      .single()

    if (share) {
      return { hasAccess: true, permission: (share as any).permission, isOwner: false }
    }

    return { hasAccess: false, isOwner: false }
  }
}

export default new ShoppingListShareService()
