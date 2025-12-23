import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDialog } from '../hooks/useDialog'
import shoppingListService, { type ShoppingList } from '../services/shoppingListService'
import { Plus } from 'lucide-react'

export default function ShoppingListsPage() {
  const { user } = useAuthStore()
  const { alert, confirm, prompt, DialogComponent, PromptComponent } = useDialog()
  const [lists, setLists] = useState<(ShoppingList & { unpurchasedCount?: number })[]>([])
  const [loading, setLoading] = useState(true)

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
            <Link key={l.id} to={`/shopping-lists/${l.id}`} className="block bg-white rounded-xl p-6 border border-secondary-200 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-secondary-900 text-lg">{l.name}</h3>
                <button onClick={(e) => { e.preventDefault(); deleteList(l.id, l.name) }} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg">Eliminar</button>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-secondary-700 text-sm font-medium">{l.unpurchasedCount || 0} productos sin comprar</p>
                <p className="text-secondary-600 text-xs">Actualizada: {new Date(l.updated_at).toLocaleString('es-ES')}</p>
              </div>
            </Link>
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

      <DialogComponent />
      <PromptComponent />
    </div>
  )
}
