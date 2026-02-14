import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import shoppingListService, { type ShoppingListItem } from '../services/shoppingListService'
import productService, { type ProductWithCategory } from '../services/productService'
import smartSuggestionsService, { type ProductSuggestion } from '../services/smartSuggestionsService'
import suggestionPreferencesService from '../services/suggestionPreferencesService'
import { useDialog } from '../hooks/useDialog'
import CustomSelect from '../components/CustomSelect'
import NumericKeyboardModal from '../components/NumericKeyboardModal'
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Sparkles, X, Menu, CheckCheck, XCircle, Trash, Download, RefreshCcw } from 'lucide-react'

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
  const [smartSuggestions, setSmartSuggestions] = useState<ProductSuggestion[]>([])
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false)
  const [loadingSmartSuggestions, setLoadingSmartSuggestions] = useState(false)
  const [showQuantityKeyboard, setShowQuantityKeyboard] = useState(false)
  const scrollPositionRef = useRef<number>(0)
  const [listName, setListName] = useState('')
  const [selectedSuggestion, setSelectedSuggestion] = useState<ProductSuggestion | null>(null)
  const [showSuggestionDetail, setShowSuggestionDetail] = useState(false)
  const [showListMenu, setShowListMenu] = useState(false)
  const listMenuRef = useRef<HTMLDivElement>(null)

  const load = async (preserveScroll = false) => {
    if (!user?.id || !id) return
    
    // Guardar posición de scroll si se solicita
    if (preserveScroll) {
      scrollPositionRef.current = window.scrollY
    }
    
    setLoading(true)
    try {
      const [data, cats, purchased, list] = await Promise.all([
        shoppingListService.getItems(id),
        shoppingListService.getCategories(user.id),
        shoppingListService.getRecentlyPurchasedItems(id, 25),
        shoppingListService.getList(id, user.id)
      ])
      setItems(data)
      setCategories(cats)
      setRecentlyPurchased(purchased)
      if (list) setListName(list.name)
      
      // Si hay más de 25 comprados recientemente, eliminar completamente los más antiguos
      if (purchased.length >= 25) {
        const { data: allPurchased } = await supabase
          .from('shopping_list_items')
          .select('id, updated_at')
          .eq('list_id', id)
          .eq('purchased', true)
          .order('updated_at', { ascending: false })
        
        if (allPurchased && allPurchased.length > 25) {
          const toDelete = allPurchased.slice(25).map((item: any) => item.id)
          for (const itemId of toDelete) {
            await shoppingListService.deleteItem(itemId)
          }
        }
      }
      
      // Restaurar posición de scroll si se guardó
      if (preserveScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPositionRef.current)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadSmartSuggestions = async () => {
    if (!user?.id || !id) return
    setLoadingSmartSuggestions(true)
    try {
      const suggestions = await smartSuggestionsService.getTopSuggestions(user.id, id, 15)
      setSmartSuggestions(suggestions)
    } catch (e) {
      console.error('Error loading smart suggestions:', e)
    } finally {
      setLoadingSmartSuggestions(false)
    }
  }

  useEffect(() => { 
    load()
    loadSmartSuggestions()
  }, [user?.id, id])

  // Cerrar menú de lista al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(event.target as Node)) {
        setShowListMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search products when input changes
  useEffect(() => {
    const searchProducts = async () => {
      if (!user?.id || input.trim().length < 3) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      try {
        const query = input.trim().toLowerCase()
        
        // Buscar en el catálogo de productos
        const catalogResults = await productService.searchProducts(input.trim(), user.id)
        
        // Buscar también en productos utilizados recientemente
        const recentMatches = recentlyPurchased
          .filter(item => item.name.toLowerCase().includes(query))
          .map(item => ({
            id: item.product_id || item.id,
            user_id: user.id,
            name: item.name,
            aliases: null,
            category_id: item.category_id,
            review_status: 'reviewed' as const,
            last_reviewed_at: null,
            last_reviewed_by: null,
            created_at: item.created_at,
            updated_at: item.updated_at,
            category: item.category
          } as ProductWithCategory))
        
        // Combinar resultados, evitando duplicados (priorizar catálogo)
        const catalogNames = new Set(catalogResults.map(r => r.name.toLowerCase()))
        const uniqueRecent = recentMatches.filter(r => !catalogNames.has(r.name.toLowerCase()))
        
        const allResults = [...catalogResults, ...uniqueRecent]
        
        setSuggestions(allResults)
        setShowSuggestions(allResults.length > 0)
        setSelectedIndex(-1)
      } catch (e) {
        console.error('Error searching products:', e)
        setSuggestions([])
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [input, user?.id, recentlyPurchased])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        // Solo cerrar si el click no está en un botón de sugerencia
        const target = e.target as HTMLElement
        if (!target.closest('button[type="button"]')) {
          setShowSuggestions(false)
        }
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
      // Verificar si el producto ya existe en la lista (como comprado)
      const normalizedInput = input.trim().toLowerCase()
      const existingItem = [...items, ...recentlyPurchased].find(
        item => item.name.toLowerCase() === normalizedInput
      )
      
      if (existingItem && existingItem.purchased) {
        // Si ya existe como comprado, marcarlo como no comprado
        await shoppingListService.updateItem(
          existingItem.id,
          { purchased: false, quantity: quantity || 1 }
        )
      } else if (!existingItem) {
        // Si no existe, crear uno nuevo
        await shoppingListService.addItem(id, input.trim(), quantity || 1, user.id)
      }
      // Si existe pero no está comprado, no hacer nada (evitar duplicados)
      
      setInput('')
      setQuantity(1)
      setSuggestions([])
      setShowSuggestions(false)
      // Recargar ambas listas en paralelo
      await Promise.all([load(), loadSmartSuggestions()])
    } catch (e) {
      console.error(e)
      alert({ title: 'Error', message: 'No se pudo añadir el producto', type: 'error' })
    }
  }

  const addSmartSuggestion = async (suggestion: ProductSuggestion) => {
    if (!user?.id || !id) return
    
    // Eliminar optimistamente de las sugerencias
    setSmartSuggestions(prev => prev.filter(s => s.product_id !== suggestion.product_id))
    
    try {
      // Pasar el product_id directamente desde la sugerencia
      await shoppingListService.addItemWithProductId(
        id,
        suggestion.product_name,
        1,
        user.id,
        suggestion.product_id,
        suggestion.category_id
      )
      // Recargar ambas listas en paralelo
      await Promise.all([load(), loadSmartSuggestions()])
    } catch (e) {
      console.error(e)
      alert({ title: 'Error', message: 'No se pudo añadir el producto', type: 'error' })
      // Si falla, recargar las sugerencias originales
      await loadSmartSuggestions()
    }
  }

  const selectSuggestion = async (product: ProductWithCategory) => {
    if (!user?.id || !id) return
    setShowSuggestions(false)
    setSuggestions([])
    setSelectedIndex(-1)
    setInput('')
    try {
      await shoppingListService.addItem(id, product.name, quantity || 1, user.id)
      setQuantity(1)
      await Promise.all([load(), loadSmartSuggestions()])
    } catch (e) {
      console.error(e)
      alert({ title: 'Error', message: 'No se pudo añadir el producto', type: 'error' })
    }
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

  const markPurchased = async (item: ShoppingListItem) => {
    if (!user?.id) return
    try {
      if (item.purchased) return
      await shoppingListService.updateItem(item.id, { purchased: true })
      await Promise.all([load(true), loadSmartSuggestions()])
    } catch (e) {
      console.error(e)
    }
  }

  const deleteItem = async (item: ShoppingListItem) => {
    const ok = await confirm({ title: 'Eliminar', message: `¿Eliminar "${item.name}"?`, type: 'warning', confirmText: 'Eliminar', cancelText: 'Cancelar' })
    if (!ok || !user?.id) return
    try {
      await shoppingListService.deleteItem(item.id)
      await Promise.all([load(true), loadSmartSuggestions()])
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
      await shoppingListService.reorderItems(id, orderedIds)
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
        }
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
        { purchased: false, quantity: 1, notes: null }
      )
      await Promise.all([load(), loadSmartSuggestions()])
    } catch (e) {
      console.error(e)
    }
  }

  // Funciones del menú de lista
  const markAllAsPurchased = async () => {
    if (!user?.id) return
    const ok = await confirm({ 
      title: 'Marcar todos como comprados', 
      message: '¿Marcar todos los productos como comprados?', 
      type: 'info',
      confirmText: 'Sí, marcar todos',
      cancelText: 'Cancelar'
    })
    if (!ok) return
    
    setShowListMenu(false)
    try {
      const unpurchasedItems = items.filter(item => !item.purchased)
      for (const item of unpurchasedItems) {
        await shoppingListService.updateItem(item.id, { purchased: true })
      }
      await Promise.all([load(true), loadSmartSuggestions()])
      await alert({ title: 'Éxito', message: `${unpurchasedItems.length} productos marcados como comprados`, type: 'success' })
    } catch (e) {
      console.error(e)
      await alert({ title: 'Error', message: 'No se pudieron marcar los productos', type: 'error' })
    }
  }

  const markAllAsUnpurchased = async () => {
    if (!user?.id) return
    const ok = await confirm({ 
      title: 'Marcar todos como no comprados', 
      message: '¿Marcar todos los productos como no comprados?', 
      type: 'info',
      confirmText: 'Sí, marcar todos',
      cancelText: 'Cancelar'
    })
    if (!ok) return
    
    setShowListMenu(false)
    try {
      const purchasedItems = items.filter(item => item.purchased)
      for (const item of purchasedItems) {
        await shoppingListService.updateItem(item.id, { purchased: false, quantity: 1 })
      }
      await Promise.all([load(true), loadSmartSuggestions()])
      await alert({ title: 'Éxito', message: `${purchasedItems.length} productos marcados como no comprados`, type: 'success' })
    } catch (e) {
      console.error(e)
      await alert({ title: 'Error', message: 'No se pudieron marcar los productos', type: 'error' })
    }
  }

  const deleteAllItems = async () => {
    if (!user?.id) return
    const ok = await confirm({ 
      title: 'Eliminar todos los productos', 
      message: '¿Estás seguro? Esta acción no se puede deshacer.', 
      type: 'warning',
      confirmText: 'Sí, eliminar todos',
      cancelText: 'Cancelar'
    })
    if (!ok) return
    
    setShowListMenu(false)
    try {
      for (const item of items) {
        await shoppingListService.deleteItem(item.id)
      }
      await Promise.all([load(), loadSmartSuggestions()])
      await alert({ title: 'Éxito', message: 'Todos los productos eliminados', type: 'success' })
    } catch (e) {
      console.error(e)
      await alert({ title: 'Error', message: 'No se pudieron eliminar los productos', type: 'error' })
    }
  }

  const clearPurchasedItems = async () => {
    if (!user?.id) return
    const purchasedItems = items.filter(item => item.purchased)
    if (purchasedItems.length === 0) {
      await alert({ title: 'Sin productos', message: 'No hay productos comprados para eliminar', type: 'info' })
      return
    }
    
    const ok = await confirm({ 
      title: 'Limpiar productos comprados', 
      message: `¿Eliminar ${purchasedItems.length} productos comprados?`, 
      type: 'info',
      confirmText: 'Sí, limpiar',
      cancelText: 'Cancelar'
    })
    if (!ok) return
    
    setShowListMenu(false)
    try {
      for (const item of purchasedItems) {
        await shoppingListService.deleteItem(item.id)
      }
      await load(true)
      await alert({ title: 'Éxito', message: `${purchasedItems.length} productos eliminados`, type: 'success' })
    } catch (e) {
      console.error(e)
      await alert({ title: 'Error', message: 'No se pudieron eliminar los productos', type: 'error' })
    }
  }

  const exportList = () => {
    setShowListMenu(false)
    const text = items
      .filter(item => !item.purchased)
      .map(item => `${item.name} (${item.quantity})${item.notes ? ` - ${item.notes}` : ''}`)
      .join('\n')
    
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${listName || 'lista'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/shopping-lists" className="text-secondary-700 hover:bg-secondary-100 px-3 py-2 rounded-lg">← Listas</Link>
        <h1 className="text-2xl font-bold text-secondary-900">{listName || 'Lista'}</h1>
        <div></div>
      </div>

      {loading ? (
        <div className="text-secondary-600">Cargando…</div>
      ) : (
        <div className="space-y-6">
          {/* Menu de acciones de lista */}
          {items.length > 0 && (
            <div className="relative" ref={listMenuRef}>
              <button
                onClick={() => setShowListMenu(!showListMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-lg transition"
                title="Opciones de lista"
              >
                <Menu className="w-5 h-5" />
                <span className="text-sm font-medium">Opciones</span>
              </button>

              {showListMenu && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-secondary-200 py-2 z-50">
                  <button
                    onClick={markAllAsPurchased}
                    className="w-full px-4 py-2 text-left hover:bg-secondary-50 flex items-center gap-3 transition"
                  >
                    <CheckCheck className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-secondary-900">Marcar todos como comprados</span>
                  </button>
                  
                  <button
                    onClick={markAllAsUnpurchased}
                    className="w-full px-4 py-2 text-left hover:bg-secondary-50 flex items-center gap-3 transition"
                  >
                    <XCircle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm text-secondary-900">Marcar todos como no comprados</span>
                  </button>
                  
                  <div className="border-t border-secondary-200 my-2"></div>
                  
                  <button
                    onClick={clearPurchasedItems}
                    className="w-full px-4 py-2 text-left hover:bg-secondary-50 flex items-center gap-3 transition"
                  >
                    <Trash className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-secondary-900">Limpiar productos comprados</span>
                  </button>
                  
                  <button
                    onClick={exportList}
                    className="w-full px-4 py-2 text-left hover:bg-secondary-50 flex items-center gap-3 transition"
                  >
                    <Download className="w-5 h-5 text-purple-600" />
                    <span className="text-sm text-secondary-900">Exportar lista a archivo</span>
                  </button>
                  
                  <div className="border-t border-secondary-200 my-2"></div>
                  
                  <button
                    onClick={deleteAllItems}
                    className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-3 transition"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-600 font-medium">Eliminar todos los productos</span>
                  </button>
                </div>
              )}
            </div>
          )}

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
                  <span className="text-sm text-base font-semibold text-secondary-900">
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

          {/* Smart Suggestions Section */}
          {smartSuggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  className="text-left flex items-center gap-2"
                  onClick={() => setShowSmartSuggestions(!showSmartSuggestions)}
                >
                  {showSmartSuggestions ? <ChevronDown className="w-4 h-4 text-primary-600" /> : <ChevronRight className="w-4 h-4 text-primary-600" />}
                  <Sparkles className="w-5 h-5 text-primary-600" />
                  <span className="text-lg font-semibold text-primary-700">
                    Sugerencias inteligentes ({smartSuggestions.length})
                  </span>
                </button>
                <button
                  onClick={async () => {
                    setShowSmartSuggestions(true)
                    await loadSmartSuggestions()
                  }}
                  disabled={loadingSmartSuggestions}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Recargar sugerencias"
                >
                  <RefreshCcw className={`w-4 h-4 ${loadingSmartSuggestions ? 'animate-spin' : ''}`} />
                  {loadingSmartSuggestions ? 'Recargando…' : 'Recargar'}
                </button>
              </div>
              {showSmartSuggestions && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-secondary-600 mb-3 px-1">
                    Basadas en tu historial de compras
                  </p>
                  {smartSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.product_id}
                      onClick={() => addSmartSuggestion(suggestion)}
                      className="flex items-center justify-between rounded-xl p-3 border transition bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200 hover:from-primary-100 hover:to-purple-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-secondary-900 flex items-center gap-2 mb-1">
                            {suggestion.product_name}
                            {/* Badge de urgencia basado en score */}
                            {suggestion.urgency_score >= 0.8 ? (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded-full font-bold">
                                🔴 Muy urgente
                              </span>
                            ) : suggestion.urgency_score >= 0.6 ? (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-full font-bold">
                                🟠 Urgente
                              </span>
                            ) : suggestion.urgency_score >= 0.4 ? (
                              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full font-bold">
                                🟡 Medio
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 border border-green-300 rounded-full font-bold">
                                🟢 Bajo
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-secondary-600">
                            {suggestion.category_icon && `${suggestion.category_icon} `}
                            Compras cada {suggestion.average_days_between_purchases} días • 
                            Última compra hace {suggestion.days_since_last_purchase} días
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedSuggestion(suggestion); setShowSuggestionDetail(true) }}
                          className="p-2 text-secondary-700 hover:bg-secondary-200 rounded-lg transition"
                          title="Ver detalles"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loadingSmartSuggestions && (
            <div className="text-secondary-600 text-sm text-center py-2">
              <Sparkles className="w-4 h-4 inline animate-pulse" /> Analizando patrones de compra...
            </div>
          )}

          {/* Recently purchased section below all categories */}
          {recentlyPurchased.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 mb-3">Comprados recientemente</h2>
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

      {/* Suggestion Detail Modal */}
      {showSuggestionDetail && selectedSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-secondary-900">{selectedSuggestion.product_name}</h3>
                  {selectedSuggestion.category_name && (
                    <p className="text-sm text-secondary-600 mt-1">
                      {selectedSuggestion.category_icon} {selectedSuggestion.category_name}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowSuggestionDetail(false)}
                  className="p-2 hover:bg-secondary-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-secondary-600" />
                </button>
              </div>

              <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-secondary-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-600" />
                  ¿Por qué se sugiere este producto?
                </h4>
                <div className="space-y-2 text-sm text-secondary-700">
                  <p>📊 Has comprado este producto <strong>{selectedSuggestion.purchase_count} veces</strong></p>
                  <p>📅 Lo compras cada <strong>{selectedSuggestion.average_days_between_purchases} días</strong> en promedio</p>
                  <p>🕐 Última compra hace <strong>{selectedSuggestion.days_since_last_purchase} días</strong></p>
                  <p>📆 Fecha de última compra: <strong>{new Date(selectedSuggestion.last_purchase_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
                  
                  {selectedSuggestion.days_overdue !== undefined && (
                    <p>⏱️ Retraso: <strong>{selectedSuggestion.days_overdue > 0 ? `+${selectedSuggestion.days_overdue}` : selectedSuggestion.days_overdue} días</strong>
                      {selectedSuggestion.days_overdue > 30 ? ' (¡Muy atrasado!)' : selectedSuggestion.days_overdue > 10 ? ' (Atrasado)' : selectedSuggestion.days_overdue > 0 ? ' (Algo retrasado)' : ''}
                    </p>
                  )}
                  
                  {selectedSuggestion.confidence !== undefined && (
                    <p>🎯 Confianza: <strong>{(selectedSuggestion.confidence * 100).toFixed(0)}%</strong>
                      {selectedSuggestion.confidence > 0.8 ? ' (Alta)' : selectedSuggestion.confidence > 0.6 ? ' (Media)' : ' (Baja)'}
                    </p>
                  )}
                  
                  <p>📈 Score de necesidad: <strong>{selectedSuggestion.urgency_score.toFixed(2)}</strong>
                    {selectedSuggestion.urgency_score >= 0.8 ? ' (¡Muy urgente!)' : selectedSuggestion.urgency_score >= 0.6 ? ' (Urgente)' : selectedSuggestion.urgency_score >= 0.4 ? ' (Recomendado)' : ' (Próximamente)'}
                  </p>
                  
                  {selectedSuggestion.reason && (
                    <div className="mt-3 pt-3 border-t border-primary-200">
                      <p className="text-xs text-secondary-600 italic">{selectedSuggestion.reason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    await addSmartSuggestion(selectedSuggestion)
                    setShowSuggestionDetail(false)
                  }}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Añadir a mi lista
                </button>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-secondary-700 mb-2">Ocultar sugerencia durante:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        if (!user?.id || !selectedSuggestion) return
                        try {
                          await suggestionPreferencesService.hideTemporary(selectedSuggestion.product_id, 15, user.id)
                          setShowSuggestionDetail(false)
                          await loadSmartSuggestions()
                          await alert({ title: 'Éxito', message: 'Sugerencia oculta por 15 días', type: 'success' })
                        } catch (e) {
                          console.error(e)
                          await alert({ title: 'Error', message: 'No se pudo ocultar la sugerencia', type: 'error' })
                        }
                      }}
                      className="px-3 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition text-sm"
                    >
                      15 días
                    </button>
                    <button
                      onClick={async () => {
                        if (!user?.id || !selectedSuggestion) return
                        try {
                          await suggestionPreferencesService.hideTemporary(selectedSuggestion.product_id, 30, user.id)
                          setShowSuggestionDetail(false)
                          await loadSmartSuggestions()
                          await alert({ title: 'Éxito', message: 'Sugerencia oculta por 1 mes', type: 'success' })
                        } catch (e) {
                          console.error(e)
                          await alert({ title: 'Error', message: 'No se pudo ocultar la sugerencia', type: 'error' })
                        }
                      }}
                      className="px-3 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition text-sm"
                    >
                      1 mes
                    </button>
                    <button
                      onClick={async () => {
                        if (!user?.id || !selectedSuggestion) return
                        try {
                          await suggestionPreferencesService.hideTemporary(selectedSuggestion.product_id, 90, user.id)
                          setShowSuggestionDetail(false)
                          await loadSmartSuggestions()
                          await alert({ title: 'Éxito', message: 'Sugerencia oculta por 3 meses', type: 'success' })
                        } catch (e) {
                          console.error(e)
                          await alert({ title: 'Error', message: 'No se pudo ocultar la sugerencia', type: 'error' })
                        }
                      }}
                      className="px-3 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition text-sm"
                    >
                      3 meses
                    </button>
                    <button
                      onClick={async () => {
                        if (!user?.id || !selectedSuggestion) return
                        try {
                          await suggestionPreferencesService.hideTemporary(selectedSuggestion.product_id, 365, user.id)
                          setShowSuggestionDetail(false)
                          await loadSmartSuggestions()
                          await alert({ title: 'Éxito', message: 'Sugerencia oculta por 1 año', type: 'success' })
                        } catch (e) {
                          console.error(e)
                          await alert({ title: 'Error', message: 'No se pudo ocultar la sugerencia', type: 'error' })
                        }
                      }}
                      className="px-3 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition text-sm"
                    >
                      1 año
                    </button>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const ok = await confirm({ 
                      title: 'Eliminar sugerencia', 
                      message: `¿Dejar de sugerir "${selectedSuggestion.product_name}" permanentemente?`, 
                      type: 'warning', 
                      confirmText: 'Eliminar', 
                      cancelText: 'Cancelar' 
                    })
                    if (ok && user?.id && selectedSuggestion) {
                      try {
                        await suggestionPreferencesService.hidePermanent(selectedSuggestion.product_id, user.id)
                        setShowSuggestionDetail(false)
                        await loadSmartSuggestions()
                        await alert({ title: 'Éxito', message: 'Sugerencia eliminada permanentemente', type: 'success' })
                      } catch (e) {
                        console.error(e)
                        await alert({ title: 'Error', message: 'No se pudo eliminar la sugerencia', type: 'error' })
                      }
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-medium"
                >
                  <Trash2 className="w-4 h-4 inline mr-2" />
                  Eliminar sugerencia permanentemente
                </button>
              </div>
            </div>
          </div>
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
                <button
                  onClick={() => setShowQuantityKeyboard(true)}
                  className="w-full px-4 py-2 border border-primary-300 bg-primary-50 rounded-lg text-primary-700 font-semibold hover:bg-primary-100 transition text-left"
                >
                  {editQuantity}
                </button>
              </div>

              {/* Category */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-secondary-900 mb-2">Categoría</label>
                <CustomSelect
                  options={[
                    { value: '', label: 'Sin categoría' },
                    ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))
                  ]}
                  value={editCategory || ''}
                  onChange={(value) => setEditCategory(value || null)}
                  placeholder="Sin categoría"
                />
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
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        selectSuggestion(product)
                      }}
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
            <button
              onClick={() => setShowQuantityKeyboard(true)}
              className="w-16 px-3 py-2 border border-primary-300 bg-primary-50 rounded-lg text-primary-700 font-semibold hover:bg-primary-100 transition"
            >
              {quantity}
            </button>
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
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        selectSuggestion(product)
                      }}
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
            <button
              onClick={() => setShowQuantityKeyboard(true)}
              className="w-14 px-2 py-2 border border-primary-300 bg-primary-50 rounded-lg text-primary-700 font-semibold text-sm hover:bg-primary-100 transition"
            >
              {quantity}
            </button>
            <button onClick={addItem} className="px-3 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-1 hover:bg-primary-700 whitespace-nowrap">
              <Plus className="w-5 h-5" /> Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for mobile add bar + nav */}
      <div className="md:hidden h-40"></div>

      {/* Spacer for desktop add bar */}
      <div className="hidden md:block h-24"></div>

      {/* Numeric Keyboard Modal */}
      <NumericKeyboardModal
        isOpen={showQuantityKeyboard}
        value={editingItem ? editQuantity : quantity}
        onClose={() => setShowQuantityKeyboard(false)}
        onConfirm={(value) => {
          if (editingItem) {
            setEditQuantity(value)
          } else {
            setQuantity(value)
          }
        }}
        title="Cantidad"
        minValue={1}
        maxValue={999}
      />

      <DialogComponent />
    </div>
  )
}
