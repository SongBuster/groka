import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useDialog } from '../hooks/useDialog'
import shoppingListService, { type ShoppingList, type ShoppingListItem } from '../services/shoppingListService'
import { Plus } from 'lucide-react'

export default function ShoppingListsPage() {
  const { user } = useAuthStore()
  const { alert, confirm, DialogComponent } = useDialog()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [recentItems, setRecentItems] = useState<Partial<ShoppingListItem>[]>([])

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [data, recent] = await Promise.all([
        shoppingListService.getLists(user.id),
        shoppingListService.getRecentItems(user.id)
      ])
      setLists(data)
      setRecentItems(recent)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id])

  const createList = async () => {
    if (!user?.id || !newName.trim()) return
    try {
      await shoppingListService.createList(newName.trim(), user.id)
      setNewName('')
      await load()
      await alert({ title: 'Lista creada', message: 'Tu lista está lista 😊', type: 'success' })
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
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la lista"
            className="px-3 py-2 border border-secondary-300 rounded-lg"
          />
          <button onClick={createList} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Nueva lista
          </button>
        </div>
      </div>

      {/* Recently used section */}
      {recentItems.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-secondary-900 mb-3">Utilizados recientemente</h2>
          <div className="flex flex-wrap gap-2">
            {recentItems.slice(0, 8).map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="px-4 py-2 bg-secondary-100 rounded-lg text-secondary-700 text-sm font-medium hover:bg-secondary-200 cursor-pointer transition"
                title={item.name}
              >
                {item.category?.icon} {item.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-secondary-600">Cargando…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((l) => (
            <a key={l.id} href={`/shopping-lists/${l.id}`} className="block bg-white rounded-xl p-6 border border-secondary-200 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-secondary-900 text-lg">{l.name}</h3>
                <button onClick={(e) => { e.preventDefault(); deleteList(l.id, l.name) }} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg">Eliminar</button>
              </div>
              <p className="text-secondary-600 text-sm mt-2">Actualizada: {new Date(l.updated_at).toLocaleString()}</p>
            </a>
          ))}
        </div>
      )}

      <DialogComponent />
    </div>
  )
}
