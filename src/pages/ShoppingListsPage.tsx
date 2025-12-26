import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDialog } from '../hooks/useDialog'
import shoppingListService, { type ShoppingList } from '../services/shoppingListService'
import shoppingListShareService, { type ShoppingListShare } from '../services/shoppingListShareService'
import { Plus, Users, Trash2, X } from 'lucide-react'

export default function ShoppingListsPage() {
  const { user } = useAuthStore()
  const { alert, confirm, prompt, DialogComponent, PromptComponent } = useDialog()
  const [lists, setLists] = useState<(ShoppingList & { unpurchasedCount?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null)
  const [shares, setShares] = useState<ShoppingListShare[]>([])
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('edit')
  const [loadingShare, setLoadingShare] = useState(false)

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await shoppingListService.getLists(user.id)
      // Load unpurchased count for each list
      const listsWithCounts = await Promise.all(
        data.map(async (list) => {
          const count = await shoppingListService.getUnpurchasedItemCount(list.id, user.id)
          return { ...list, unpurchasedCount: count }
        })
      )
      setLists(listsWithCounts)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id])

  const handleNewListClick = async () => {
    const name = await prompt({
      title: '¿Cómo se llamará tu lista?',
      placeholder: 'Mi lista de compra',
      confirmText: 'Crear',
      cancelText: 'Cancelar'
    })
    if (!name?.trim() || !user?.id) return
    try {
      await shoppingListService.createList(name.trim(), user.id)
      await load()
    } catch (e) {
      console.error(e)
      alert({ title: 'Error', message: 'No se pudo crear la lista', type: 'error' })
    }
  }

  const deleteList = async (listId: string, name: string) => {
    const ok = await confirm({ title: 'Eliminar lista', message: `¿Eliminar "${name}"?`, type: 'warning', confirmText: 'Eliminar', cancelText: 'Cancelar' })
    if (!ok || !user?.id) return
    try {
      await shoppingListService.deleteList(listId, user.id)
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  const openShareModal = async (list: ShoppingList) => {
    setSelectedList(list)
    setShowShareModal(true)
    setShareEmail('')
    setSharePermission('edit')
    
    // Cargar compartidos existentes
    const listShares = await shoppingListShareService.getListShares(list.id)
    setShares(listShares)
  }

  const handleShareList = async () => {
    if (!selectedList || !user?.id || !shareEmail.trim()) {
      await alert({ title: 'Error', message: 'Por favor introduce un email', type: 'error' })
      return
    }

    setLoadingShare(true)
    try {
      const result = await shoppingListShareService.shareList(
        selectedList.id,
        shareEmail.trim(),
        sharePermission,
        user.id
      )

      if (result.success) {
        await alert({ title: 'Éxito', message: 'Lista compartida correctamente', type: 'success' })
        setShareEmail('')
        // Recargar compartidos
        const listShares = await shoppingListShareService.getListShares(selectedList.id)
        setShares(listShares)
      } else {
        await alert({ title: 'Error', message: result.error || 'Error al compartir', type: 'error' })
      }
    } catch (e) {
      console.error(e)
      await alert({ title: 'Error', message: 'Error al compartir la lista', type: 'error' })
    } finally {
      setLoadingShare(false)
    }
  }

  const handleUnshareList = async (shareId: string) => {
    if (!user?.id) return

    const ok = await confirm({ 
      title: 'Dejar de compartir', 
      message: '¿Dejar de compartir con este usuario?', 
      type: 'warning',
      confirmText: 'Sí, dejar de compartir',
      cancelText: 'Cancelar'
    })
    
    if (!ok) return

    try {
      const result = await shoppingListShareService.unshareList(shareId, user.id)
      
      if (result.success) {
        await alert({ title: 'Éxito', message: 'Compartido eliminado', type: 'success' })
        // Recargar compartidos
        if (selectedList) {
          const listShares = await shoppingListShareService.getListShares(selectedList.id)
          setShares(listShares)
        }
      } else {
        await alert({ title: 'Error', message: result.error || 'Error al eliminar', type: 'error' })
      }
    } catch (e) {
      console.error(e)
      await alert({ title: 'Error', message: 'Error al dejar de compartir', type: 'error' })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900">Mis listas</h1>
          <p className="text-secondary-600">Crea y gestiona tus listas de la compra</p>
        </div>
      </div>

      {loading ? (
        <div className="text-secondary-600">Cargando…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Existing lists */}
          {lists.map((l) => (
            <div key={l.id} className={`bg-white rounded-xl p-6 border-2 hover:shadow-lg transition-all ${
              l.is_shared ? 'border-blue-300 bg-blue-50/30' : 'border-secondary-200'
            }`}>
              <Link to={`/shopping-lists/${l.id}`} className="block">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-secondary-900 text-lg">{l.name}</h3>
                  {l.is_shared && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full whitespace-nowrap">
                      <Users className="w-3 h-3" />
                      Compartida
                    </span>
                  )}
                </div>
                
                {l.is_shared && l.shared_by_email && (
                  <p className="text-blue-700 text-xs font-medium mb-2">
                    Compartida por: {l.shared_by_email}
                    {l.permission === 'view' && ' (solo lectura)'}
                  </p>
                )}
                
                <div className="mt-3 space-y-1">
                  <p className="text-secondary-700 text-sm font-medium">{l.unpurchasedCount || 0} productos sin comprar</p>
                  <p className="text-secondary-600 text-xs">Actualizada: {new Date(l.updated_at).toLocaleString('es-ES')}</p>
                </div>
              </Link>
              
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-secondary-100">
                {l.is_owner && (
                  <button 
                    onClick={() => openShareModal(l)} 
                    className="flex-1 flex items-center justify-center gap-2 text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium transition"
                  >
                    <Users className="w-4 h-4" />
                    Compartir
                  </button>
                )}
                {l.is_owner && (
                  <button 
                    onClick={() => deleteList(l.id, l.name)} 
                    className="flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {l.is_shared && l.permission === 'view' && (
                  <div className="flex-1 text-center text-xs text-blue-600 font-medium py-2">
                    Solo lectura
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* New list placeholder - at the end */}
          <button
            onClick={handleNewListClick}
            className="bg-white rounded-xl p-6 border-2 border-dashed border-primary-300 hover:border-primary-500 hover:bg-primary-50 transition-all flex flex-col items-center justify-center gap-2 min-h-[160px]"
          >
            <Plus className="w-6 h-6 text-primary-600" />
            <div className="text-center">
              <h3 className="font-semibold text-primary-700 text-sm">Nueva lista</h3>
              <p className="text-xs text-primary-600">Pulsa para crear</p>
            </div>
          </button>
        </div>
      )}

      {/* Modal de compartir lista */}
      {showShareModal && selectedList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 pb-4 border-b border-secondary-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-secondary-900">Compartir: {selectedList.name}</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 hover:bg-secondary-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-secondary-600" />
                </button>
              </div>
              <p className="text-sm text-secondary-600">Invita a otros usuarios por email</p>
            </div>

            <div className="p-6">
              {/* Formulario para compartir */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-secondary-900 mb-2">Email del usuario</label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                />

                <label className="block text-sm font-medium text-secondary-900 mb-2">Permisos</label>
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                >
                  <option value="edit">Puede editar (añadir, modificar, eliminar)</option>
                  <option value="view">Solo ver (sin editar)</option>
                </select>

                <button
                  onClick={handleShareList}
                  disabled={loadingShare || !shareEmail.trim()}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingShare ? 'Compartiendo...' : 'Compartir lista'}
                </button>
              </div>

              {/* Lista de usuarios con acceso */}
              {shares.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-secondary-900 mb-3">Compartida con:</h4>
                  <div className="space-y-2">
                    {shares.map((share) => (
                      <div key={share.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-secondary-900">
                            {share.shared_with_email || share.shared_with_user_id}
                          </p>
                          <p className="text-xs text-secondary-600">
                            {share.permission === 'edit' ? 'Puede editar' : 'Solo ver'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnshareList(share.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                          title="Dejar de compartir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DialogComponent />
      <PromptComponent />
    </div>
  )
}
