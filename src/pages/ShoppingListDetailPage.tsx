import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import shoppingListService, { type ShoppingListItem } from '../services/shoppingListService'
import { useDialog } from '../hooks/useDialog'
import { CheckCircle, Circle, Plus, Trash2 } from 'lucide-react'

export default function ShoppingListDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const { alert, confirm, DialogComponent } = useDialog()
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [categories, setCategories] = useState<any[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const load = async () => {
    if (!user?.id || !id) return
    setLoading(true)
    try {
      const [data, cats] = await Promise.all([
        shoppingListService.getItems(id, user.id),
        shoppingListService.getCategories(user.id)
      ])
      setItems(data)
      setCategories(cats)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id, id])

  const grouped = useMemo(() => {
    const groups: Record<string, { name: string; color: string | null; icon: string | null; items: ShoppingListItem[] }> = {}
    for (const it of items) {
      const key = it.category_id || 'none'
      const meta = it.category || null
      if (!groups[key]) {
        groups[key] = { name: meta?.name || 'Sin categoría', color: meta?.color || null, icon: meta?.icon || null, items: [] }
      }
      groups[key].items.push(it)
    }
    return groups
  }, [items])

  const addItem = async () => {
    if (!user?.id || !id || !input.trim()) return
    try {
      await shoppingListService.addItem(id, input.trim(), quantity || 1, user.id)
      setInput('')
      setQuantity(1)
      await load()
    } catch (e) {
      console.error(e)
      alert({ title: 'Error', message: 'No se pudo añadir el producto', type: 'error' })
    }
  }

  const togglePurchased = async (item: ShoppingListItem) => {
    if (!user?.id) return
    try {
      await shoppingListService.updateItem(item.id, { purchased: !item.purchased }, user.id)
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  const setCategory = async (item: ShoppingListItem, categoryId: string | null) => {
    if (!user?.id) return
    try {
      await shoppingListService.updateItem(item.id, { category_id: categoryId || null }, user.id)
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  const deleteItem = async (item: ShoppingListItem) => {
    const ok = await confirm({ title: 'Eliminar', message: `¿Eliminar "${item.name}"?`, type: 'warning', confirmText: 'Eliminar', cancelText: 'Cancelar' })
    if (!ok || !user?.id) return
    try {
      await shoppingListService.deleteItem(item.id, user.id)
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedId(itemId)
    e.dataTransfer!.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetItemId || !user?.id || !id) return
    setDraggedId(null)

    const draggedIndex = items.findIndex(i => i.id === draggedId)
    const targetIndex = items.findIndex(i => i.id === targetItemId)
    if (draggedIndex === -1 || targetIndex === -1) return

    const newItems = [...items]
    const [removed] = newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, removed)

    try {
      const orderedIds = newItems.map(i => i.id)
      await shoppingListService.reorderItems(id, orderedIds, user.id)
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/shopping-lists" className="text-secondary-700 hover:bg-secondary-100 px-3 py-2 rounded-lg">← Listas</Link>
        <h1 className="text-2xl font-bold text-secondary-900">Lista</h1>
        <div></div>
      </div>

      {loading ? (
        <div className="text-secondary-600">Cargando…</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, g]) => (
            <div key={key}>
              <h2 className="text-xl font-semibold text-secondary-900 mb-2 flex items-center gap-2">
                <span>{g.icon} {g.name}</span>
              </h2>
              <div className="space-y-3">
                {g.items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, item.id)}
                    className={`flex items-center justify-between rounded-xl p-4 border cursor-move transition ${draggedId === item.id ? 'opacity-50 bg-secondary-50' : ''} ${item.purchased ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      {item.purchased ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium text-secondary-900">{item.name}</div>
                        <div className="text-sm text-secondary-600">Cantidad: {item.quantity}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => togglePurchased(item)} className="px-3 py-1 text-sm rounded-lg hover:bg-secondary-100">{item.purchased ? 'Desmarcar' : 'Comprado'}</button>
                      <div className="relative">
                        <select value={item.category_id || ''} onChange={(e) => setCategory(item, e.target.value || null)} className="px-2 py-1 border rounded-lg text-sm">
                          <option value="">Sin categoría</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => deleteItem(item)} className="px-3 py-1 text-sm text-red-700 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-secondary-200 p-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Necesito…"
            className="flex-1 px-4 py-2 border border-secondary-300 rounded-lg"
          />
          <input
            type="number"
            value={quantity}
            min={1}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 border border-secondary-300 rounded-lg"
          />
          <button onClick={addItem} className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2">
            <Plus className="w-5 h-5" /> Añadir
          </button>
        </div>
      </div>

      <DialogComponent />
    </div>
  )
}
