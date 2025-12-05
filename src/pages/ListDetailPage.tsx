import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  ArrowLeft,
  Plus,
  ShoppingCart,
  Check,
  X,
  Edit2,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import shoppingListService from '../services/shoppingListService'
import productService from '../services/productService'
import type { ProductWithCategory } from '../services/productService'
import { useDialog } from '../hooks/useDialog'
import type { Database } from '../types/database'

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row']
type ShoppingListItem = Database['public']['Tables']['shopping_list_items']['Row'] & {
  product?: ProductWithCategory
}

type GroupedItems = {
  categoryId: string | null
  categoryName: string
  items: ShoppingListItem[]
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { alert, confirm, DialogComponent } = useDialog()

  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isShoppingMode, setIsShoppingMode] = useState(false)

  // Add product state
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductWithCategory[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [newProductQuantity, setNewProductQuantity] = useState(1)

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)
  const [editWeight, setEditWeight] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState<number | null>(null)

  useEffect(() => {
    if (id && user) {
      loadList()
      loadItems()
    }
  }, [id, user])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchProducts()
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(handler)
  }, [searchQuery])

  const loadList = async () => {
    if (!id) return

    try {
      const data = await shoppingListService.getListById(id)
      setList(data)
    } catch (error) {
      console.error('Error loading list:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo cargar la lista',
        type: 'error',
      })
      navigate('/lists')
    }
  }

  const loadItems = async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await shoppingListService.getListItems(id)
      setItems(data)
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchProducts = async () => {
    setSearchLoading(true)
    try {
      const results = await productService.searchProductsWithPriority(searchQuery)
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddProduct = async (product?: ProductWithCategory, customName?: string) => {
    if (!id || !user) return

    try {
      let productId: string | null = null
      let name: string = customName || ''
      let estimatedPrice: number | null = null

      if (product) {
        // Product from database
        productId = product.id
        name = product.name

        // Get last price if available
        const lastPrice = await productService.getLastPrice(product.id)
        estimatedPrice = lastPrice
      } else if (customName) {
        // New product not in database - will be created
        const newProduct = await productService.create({
          name: customName.trim(),
          review_status: 'uncategorized',
        })
        productId = newProduct.id
        name = newProduct.name
      }

      await shoppingListService.addItem(id, {
        product_id: productId,
        name,
        quantity: newProductQuantity,
        estimated_price: estimatedPrice,
      })

      await loadItems()
      setShowAddProduct(false)
      setSearchQuery('')
      setSearchResults([])
      setNewProductQuantity(1)
    } catch (error) {
      console.error('Error adding product:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo añadir el producto',
        type: 'error',
      })
    }
  }

  const handleToggleChecked = async (item: ShoppingListItem, checked: boolean) => {
    if (!user) return

    try {
      await shoppingListService.updateItem(item.id, {
        checked,
        checked_at: checked ? new Date().toISOString() : null,
        checked_by: checked ? user.id : null,
      })
      await loadItems()
    } catch (error) {
      console.error('Error updating item:', error)
    }
  }

  const handleOpenEditModal = (item: ShoppingListItem) => {
    setEditingItem(item)
    setEditQuantity(item.quantity)
    setEditWeight(item.weight)
    setEditPrice(item.actual_price)
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    try {
      await shoppingListService.updateItem(editingItem.id, {
        quantity: editQuantity,
        weight: editWeight,
        actual_price: editPrice,
      })
      await loadItems()
      setEditingItem(null)
    } catch (error) {
      console.error('Error updating item:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo actualizar el producto',
        type: 'error',
      })
    }
  }

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    const confirmed = await confirm({
      title: '¿Eliminar producto?',
      message: `¿Estás seguro de que quieres eliminar "${itemName}" de la lista?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'error',
    })

    if (!confirmed) return

    try {
      await shoppingListService.removeItem(itemId)
      await loadItems()
    } catch (error) {
      console.error('Error deleting item:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo eliminar el producto',
        type: 'error',
      })
    }
  }

  // Group items by category and sort
  const groupedItems = useMemo((): GroupedItems[] => {
    const groups = new Map<string | null, GroupedItems>()

    items.forEach((item) => {
      const categoryId = item.product?.category?.id || null
      const categoryName = item.product?.category?.name || 'Sin categoría'

      if (!groups.has(categoryId)) {
        groups.set(categoryId, {
          categoryId,
          categoryName,
          items: [],
        })
      }

      groups.get(categoryId)!.items.push(item)
    })

    // Sort items within each category alphabetically
    groups.forEach((group) => {
      group.items.sort((a, b) => a.name.localeCompare(b.name))
    })

    // Convert to array and sort categories
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.categoryName === 'Sin categoría') return 1
      if (b.categoryName === 'Sin categoría') return -1
      return a.categoryName.localeCompare(b.categoryName)
    })

    return sortedGroups
  }, [items])

  // Split items into checked and unchecked for shopping mode
  const uncheckedItems = useMemo(() => items.filter((i) => !i.checked), [items])
  const checkedItems = useMemo(() => items.filter((i) => i.checked), [items])

  // Calculate total spent
  const totalSpent = useMemo(() => {
    return checkedItems.reduce((sum, item) => {
      const price = item.actual_price || item.estimated_price || 0
      return sum + price * item.quantity
    }, 0)
  }, [checkedItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="p-8 text-center">
        <p className="text-secondary-600">Lista no encontrada</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary-50 pb-20">
      <DialogComponent />

      {/* Header */}
      <div className="bg-white border-b border-secondary-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/lists')}
              className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver</span>
            </button>

            <button
              onClick={() => setIsShoppingMode(!isShoppingMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isShoppingMode
                  ? 'bg-secondary-100 text-secondary-700'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              {isShoppingMode ? 'Editar lista' : 'Ir a comprar'}
            </button>
          </div>

          <h1 className="text-2xl font-bold text-secondary-900">{list.name}</h1>
          {list.description && (
            <p className="text-secondary-600 mt-1">{list.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Edit Mode */}
        {!isShoppingMode && (
          <>
            {/* Add Product Section */}
            <div className="bg-white rounded-lg border border-secondary-200 p-4 mb-6">
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary-600" />
                  </div>
                  <span className="font-medium text-secondary-900">Añadir producto</span>
                </div>
                {showAddProduct ? (
                  <ChevronUp className="w-5 h-5 text-secondary-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-secondary-400" />
                )}
              </button>

              {showAddProduct && (
                <div className="mt-4 space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar producto o escribir nombre nuevo..."
                      className="flex-1 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      autoFocus
                    />
                    <input
                      type="number"
                      min="1"
                      value={newProductQuantity}
                      onChange={(e) => setNewProductQuantity(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center"
                      placeholder="Cant."
                    />
                  </div>

                  {/* Search Results */}
                  {searchLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleAddProduct(product)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary-50 rounded-lg transition-colors text-left"
                        >
                          <div>
                            <div className="font-medium text-secondary-900">{product.name}</div>
                          </div>
                          {product.category && (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700">
                              {product.category.name}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Add as new product */}
                  {searchQuery.trim().length >= 2 && !searchLoading && (
                    <button
                      onClick={() => handleAddProduct(undefined, searchQuery)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors text-left"
                    >
                      <Plus className="w-5 h-5 text-primary-600" />
                      <div>
                        <div className="font-medium text-primary-900">
                          Añadir "{searchQuery}"
                        </div>
                        <div className="text-sm text-primary-600">
                          Producto nuevo (sin categoría)
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Items List */}
            {groupedItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto text-secondary-300 mb-4" />
                <p className="text-secondary-600">No hay productos en la lista</p>
                <p className="text-sm text-secondary-500 mt-2">
                  Añade productos para empezar
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedItems.map((group) => (
                  <div key={group.categoryId || 'uncategorized'}>
                    <h3 className="font-semibold text-secondary-700 mb-3 px-2">
                      {group.categoryName}
                    </h3>
                    <div className="bg-white rounded-lg border border-secondary-200 divide-y divide-secondary-100">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-secondary-50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-secondary-900">
                              {item.quantity > 1 && (
                                <span className="text-primary-600 mr-2">{item.quantity}</span>
                              )}
                              {item.name}
                            </div>
                            {item.estimated_price && (
                              <div className="text-sm text-secondary-500">
                                ~{item.estimated_price.toFixed(2)}€/ud
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
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
          </>
        )}

        {/* Shopping Mode */}
        {isShoppingMode && (
          <div className="space-y-6">
            {/* Total Badge */}
            {checkedItems.length > 0 && (
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm opacity-90">Total gastado</div>
                    <div className="text-3xl font-bold">{totalSpent.toFixed(2)}€</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-90">Comprados</div>
                    <div className="text-2xl font-bold">
                      {checkedItems.length}/{items.length}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Unchecked Items (Por Comprar) */}
            {uncheckedItems.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-secondary-900 mb-3 px-2">
                  Por comprar ({uncheckedItems.length})
                </h2>
                <div className="bg-white rounded-lg border border-secondary-200 divide-y divide-secondary-100">
                  {uncheckedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => handleToggleChecked(item, true)}
                        className="flex-1 text-left hover:bg-secondary-50 -mx-4 px-4 py-2 transition-colors"
                      >
                        <div className="font-medium text-secondary-900">
                          {item.quantity > 1 && (
                            <span className="text-primary-600 mr-2">{item.quantity}</span>
                          )}
                          {item.name}
                        </div>
                        {item.estimated_price && (
                          <div className="text-sm text-secondary-500">
                            ~{(item.estimated_price * item.quantity).toFixed(2)}€
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checked Items (Ya Comprados) */}
            {checkedItems.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-secondary-900 mb-3 px-2">
                  Ya comprados ({checkedItems.length})
                </h2>
                <div className="bg-white rounded-lg border border-secondary-200 divide-y divide-secondary-100 opacity-75">
                  {checkedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => handleToggleChecked(item, false)}
                        className="flex items-center gap-3 flex-1 text-left hover:bg-secondary-50 -mx-4 px-4 py-2 transition-colors"
                      >
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-secondary-700 line-through">
                            {item.quantity > 1 && (
                              <span className="text-secondary-500 mr-2">{item.quantity}</span>
                            )}
                            {item.name}
                          </div>
                          {(item.actual_price || item.estimated_price) && (
                            <div className="text-sm text-secondary-500">
                              {((item.actual_price || item.estimated_price || 0) * item.quantity).toFixed(
                                2
                              )}
                              €
                            </div>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto text-secondary-300 mb-4" />
                <p className="text-secondary-600">No hay productos en la lista</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-secondary-900">Editar producto</h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Producto
                  </label>
                  <div className="px-4 py-3 bg-secondary-50 rounded-lg text-secondary-900 font-medium">
                    {editingItem.name}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Cantidad (unidades)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Peso (kg) - Opcional
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={editWeight || ''}
                    onChange={(e) =>
                      setEditWeight(e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="Ej: 0.5"
                    className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Precio real (€) - Opcional
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrice || ''}
                    onChange={(e) =>
                      setEditPrice(e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="Ej: 2.50"
                    className="w-full px-4 py-3 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {editingItem.estimated_price && (
                    <p className="text-sm text-secondary-500 mt-1">
                      Precio estimado: {editingItem.estimated_price.toFixed(2)}€/ud
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
