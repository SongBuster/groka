import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import shoppingListService, { type ShoppingListItem } from '../services/shoppingListService'
import productService, { type ProductWithCategory } from '../services/productService'
import { useDialog } from '../hooks/useDialog'
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react'

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
  const [recentlyPurchased, setRecentlyPurchased] = useState<ShoppingListItem[]>([])
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)
  const [editCategory, setEditCategory] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [suggestions, setSuggestions] = useState<ProductWithCategory[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!user?.id || !id) return
    setLoading(true)
    try {
      const [data, cats, purchased] = await Promise.all([
        shoppingListService.getItems(id, user.id),
        shoppingListService.getCategories(user.id),
        shoppingListService.getRecentlyPurchasedItems(id, user.id)
      ])
      setItems(data)
      setCategories(cats)
      setRecentlyPurchased(purchased)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id, id])

  // Search products when input changes
  useEffect(() => {
    const searchProducts = async () => {
      if (!user?.id || input.trim().length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      try {
        const results = await productService.searchProducts(input.trim(), user.id)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setSelectedIndex(-1)
      } catch (e) {
        console.error('Error searching products:', e)
        setSuggestions([])
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [input, user?.id])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      setSuggestions([])
      setShowSuggestions(false)
      await load()
    } catch (e) {
      console.error(e)
      alert({ title: 'Error', message: 'No se pudo añadir el producto', type: 'error' })
    }
  }

  const selectSuggestion = (product: ProductWithCategory) => {
    setInput(product.name)
    setShowSuggestions(false)
    setSuggestions([])
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        addItem()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex])
        } else {
          addItem()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
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

  const markPurchased = async (item: ShoppingListItem) => {
    if (!user?.id) return
    try {
      if (item.purchased) return
      await shoppingListService.updateItem(item.id, { purchased: true }, user.id)
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

  const openEditModal = (item: ShoppingListItem) => {
    setEditingItem(item)
    setEditQuantity(item.quantity)
    setEditCategory(item.category_id || null)
    setEditNotes(item.notes || '')
  }

  const saveEdit = async () => {
    if (!editingItem || !user?.id) return
    try {
      await shoppingListService.updateItem(
        editingItem.id,
        {
          quantity: editQuantity,
          category_id: editCategory || null,
          notes: editNotes || null
        },
        user.id
      )
      setEditingItem(null)
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  const markUnpurchased = async (item: ShoppingListItem) => {
    if (!user?.id) return
    try {
      if (!item.purchased) return
      await shoppingListService.updateItem(
        item.id,
        { purchased: false, quantity: 1, notes: null },
        user.id
      )
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
          {/* Items by category (only unpurchased) */}
          {Object.entries(grouped).map(([key, g]) => {
            const unpurchasedItems = g.items.filter((it) => !it.purchased)
            if (unpurchasedItems.length === 0) return null
            const isCollapsed = !!collapsed[key]
            const CountIcon = isCollapsed ? ChevronRight : ChevronDown
            return (
              <div key={key}>
                <button
                  className="w-full text-left mb-2 flex items-center gap-2"
                  onClick={() => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <CountIcon className="w-4 h-4 text-secondary-700" />
                  <span className="text-lg font-semibold text-secondary-900">
                    {g.icon} {g.name} ({unpurchasedItems.length})
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {unpurchasedItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, item.id)}
                    onClick={() => markPurchased(item)}
                    className={`flex items-center justify-between rounded-xl p-2 border cursor-move transition ${draggedId === item.id ? 'opacity-50 bg-secondary-50' : ''} bg-red-100 border-red-300 hover:bg-red-200`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-secondary-900">{item.name}</div>
                        <div className="text-sm text-secondary-600">Cantidad: {item.quantity}</div>
                        {item.notes && (
                          <div className="text-xs text-secondary-500 italic truncate">{item.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(item) }} 
                        className="p-2 text-secondary-700 hover:bg-secondary-200 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteItem(item) }} 
                        className="p-2 text-red-700 hover:bg-red-100 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Recently purchased section below all categories */}
          {recentlyPurchased.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 mb-3">Utilizados recientemente</h2>
              <div className="space-y-3">
                {recentlyPurchased.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markUnpurchased(item)}
                    className="flex items-center justify-between rounded-xl p-2 border cursor-pointer transition bg-green-100 border-green-300 hover:bg-green-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-secondary-900">{item.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(item) }} 
                        className="p-2 text-secondary-700 hover:bg-secondary-200 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteItem(item) }} 
                        className="p-2 text-red-700 hover:bg-red-100 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6 pb-4">
              <h3 className="text-xl font-bold text-secondary-900 mb-4">Editar {editingItem.name}</h3>
              
              {/* Quantity */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-900 mb-2">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Category */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-900 mb-2">Categoría</label>
                <select 
                  value={editCategory || ''} 
                  onChange={(e) => setEditCategory(e.target.value || null)} 
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-900 mb-2">Nota (ej: que no estén maduros)</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Añade una nota..."
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 px-4 py-2.5 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add bar - Desktop */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 bg-white border-t border-secondary-200 p-3 z-20">
        <div className="max-w-3xl mx-auto relative">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => input.trim().length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Necesito…"
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-30"
                >
                  {suggestions.map((product, idx) => (
                    <button
                      key={product.id}
                      onClick={() => selectSuggestion(product)}
                      className={`w-full text-left px-4 py-2 hover:bg-secondary-100 transition ${
                        idx === selectedIndex ? 'bg-primary-50' : ''
                      } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === suggestions.length - 1 ? 'rounded-b-lg' : ''} border-b border-secondary-100 last:border-b-0`}
                    >
                      <div className="font-medium text-secondary-900">{product.name}</div>
                      {product.category && (
                        <div className="text-xs text-secondary-600">
                          {product.category.icon} {product.category.name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="number"
              value={quantity}
              min={1}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-secondary-300 rounded-lg text-secondary-900"
            />
            <button onClick={addItem} className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 hover:bg-primary-700">
              <Plus className="w-5 h-5" /> Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Add bar - Mobile */}
      <div className="md:hidden fixed bottom-20 left-0 right-0 bg-white border-t border-secondary-200 p-3 z-20">
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => input.trim().length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Necesito…"
                className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-30"
                >
                  {suggestions.map((product, idx) => (
                    <button
                      key={product.id}
                      onClick={() => selectSuggestion(product)}
                      className={`w-full text-left px-3 py-2 hover:bg-secondary-100 transition ${
                        idx === selectedIndex ? 'bg-primary-50' : ''
                      } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === suggestions.length - 1 ? 'rounded-b-lg' : ''} border-b border-secondary-100 last:border-b-0`}
                    >
                      <div className="font-medium text-secondary-900 text-sm">{product.name}</div>
                      {product.category && (
                        <div className="text-xs text-secondary-600">
                          {product.category.icon} {product.category.name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="number"
              value={quantity}
              min={1}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-2 border border-secondary-300 rounded-lg text-secondary-900 text-sm"
            />
            <button onClick={addItem} className="px-3 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-1 hover:bg-primary-700 whitespace-nowrap">
              <Plus className="w-5 h-5" /> Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for mobile add bar + nav */}
      <div className="md:hidden h-40"></div>

      <DialogComponent />
    </div>
  )
}
