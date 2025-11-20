import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Loader2, Receipt, Plus, Trash2, Save, X, Edit2 } from 'lucide-react'
import ticketService from '../services/ticketService'
import { formatCurrency, formatDateTime } from '../lib/formatters'
import { useDialog } from '../hooks/useDialog'
import type { Database } from '../types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface ManualProduct {
  id: string
  productId: string | null // ID del producto en la BD
  name: string
  productType: 'unit' | 'weight'
  quantity: number // unidades o kg
  unitPrice: number // precio por unidad o por kg
  total: number
  showDropdown: boolean
}

export default function TicketsPage() {
  const { user } = useAuthStore()
  const { alert, confirm, DialogComponent } = useDialog()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [manualTicket, setManualTicket] = useState({
    storeName: '',
    ticketNumber: '',
    purchaseDate: new Date().toISOString().slice(0, 16), // formato: YYYY-MM-DDTHH:mm
    products: [] as ManualProduct[]
  })
  const [availableProducts, setAvailableProducts] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadTickets()
    }
  }, [user])

  useEffect(() => {
    if (showManualModal) {
      loadAllProducts()
    }
  }, [showManualModal])

  const loadAllProducts = async () => {
    try {
      const productService = (await import('../services/productService')).default
      const products = await productService.getAll()
      setAvailableProducts(products)
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadTickets = async () => {
    if (!user) return
    
    setLoadingTickets(true)
    try {
      const data = await ticketService.getUserTickets(user.id)
      setTickets(data)
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleAddProduct = () => {
    const newProduct: ManualProduct = {
      id: Date.now().toString(),
      productId: null,
      name: '',
      productType: 'unit',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      showDropdown: false
    }
    setManualTicket({
      ...manualTicket,
      products: [...manualTicket.products, newProduct]
    })
  }

  const handleSearchProduct = async (query: string) => {
    if (query.length < 2) {
      return
    }

    try {
      const productService = (await import('../services/productService')).default
      const results = await productService.searchProducts(query)
      setAvailableProducts(results)
    } catch (error) {
      console.error('Error searching products:', error)
    }
  }

  const handleSelectProduct = (productId: string, selectedProduct: any) => {
    setManualTicket({
      ...manualTicket,
      products: manualTicket.products.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            productId: selectedProduct.id,
            name: selectedProduct.name,
            showDropdown: false
          }
        }
        return p
      })
    })
  }

  const handleCreateNewProduct = (productId: string, productName: string) => {
    setManualTicket({
      ...manualTicket,
      products: manualTicket.products.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            productId: null, // Se creará al guardar
            name: productName,
            showDropdown: false
          }
        }
        return p
      })
    })
  }

  const handleRemoveProduct = (productId: string) => {
    setManualTicket({
      ...manualTicket,
      products: manualTicket.products.filter(p => p.id !== productId)
    })
  }

  const handleUpdateProduct = (productId: string, field: keyof ManualProduct, value: any) => {
    setManualTicket(prev => ({
      ...prev,
      products: prev.products.map(p => {
        if (p.id === productId) {
          const updated = { ...p, [field]: value }
          // Recalcular total si cambia cantidad o precio
          if (field === 'quantity' || field === 'unitPrice') {
            updated.total = updated.quantity * updated.unitPrice
          }
          return updated
        }
        return p
      })
    }))
  }

  const handleSaveManualTicket = async () => {
    if (!user) return
    
    // Validaciones
    if (!manualTicket.storeName.trim()) {
      alert({
        title: 'Campo requerido',
        message: 'Por favor, introduce el nombre de la tienda',
        type: 'warning'
      })
      return
    }
    
    if (manualTicket.products.length === 0) {
      alert({
        title: 'Sin productos',
        message: 'Añade al menos un producto al ticket',
        type: 'warning'
      })
      return
    }
    
    const invalidProducts = manualTicket.products.filter(p => !p.name.trim())
    if (invalidProducts.length > 0) {
      alert({
        title: 'Productos incompletos',
        message: 'Todos los productos deben tener un nombre',
        type: 'warning'
      })
      return
    }
    
    try {
      setLoadingTickets(true)
      
      if (editingTicket) {
        // Editar ticket existente
        await ticketService.updateTicket(
          editingTicket.id,
          manualTicket.storeName,
          manualTicket.purchaseDate,
          manualTicket.ticketNumber || null,
          manualTicket.products.map(p => ({
            product_id: p.productId,
            name: p.name.toUpperCase(),
            product_type: p.productType,
            quantity: p.quantity,
            unit_price: p.unitPrice,
            total: p.total
          }))
        )
      } else {
        // Crear nuevo ticket
        await ticketService.createManualTicket(
          user.id,
          manualTicket.storeName,
          manualTicket.purchaseDate,
          manualTicket.ticketNumber || null,
          manualTicket.products.map(p => ({
            product_id: p.productId,
            name: p.name.toUpperCase(),
            product_type: p.productType,
            quantity: p.quantity,
            unit_price: p.unitPrice,
            total: p.total
          }))
        )
      }
      
      // Recargar tickets
      await loadTickets()
      
      // Cerrar modal y limpiar formulario
      handleCloseModal()
      
      alert({
        title: editingTicket ? 'Ticket actualizado' : 'Ticket creado',
        message: editingTicket 
          ? 'El ticket se ha actualizado correctamente'
          : 'El ticket se ha creado correctamente',
        type: 'success'
      })
    } catch (error) {
      console.error('Error saving manual ticket:', error)
      alert({
        title: 'Error',
        message: 'No se pudo guardar el ticket. Inténtalo de nuevo.',
        type: 'error'
      })
    } finally {
      setLoadingTickets(false)
    }
  }

  const calculateTotal = () => {
    return manualTicket.products.reduce((sum, p) => sum + p.total, 0)
  }

  const handleEditTicket = async (ticket: Ticket) => {
    try {
      setLoadingTickets(true)
      // Cargar los items del ticket
      const { items } = await ticketService.getTicketWithItems(ticket.id)
      
      // Convertir a formato ManualProduct
      const products: ManualProduct[] = items.map(item => ({
        id: item.id,
        productId: item.product_id,
        name: item.name,
        productType: 'unit', // Por ahora asumimos unidades
        quantity: item.quantity,
        unitPrice: item.unit_price || 0,
        total: item.total_price,
        showDropdown: false
      }))

      // Convertir fecha a formato datetime-local
      const purchaseDate = ticket.purchase_date 
        ? new Date(ticket.purchase_date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16)

      setEditingTicket(ticket)
      setManualTicket({
        storeName: ticket.store_name || '',
        ticketNumber: ticket.ticket_number || '',
        purchaseDate,
        products
      })
      setShowManualModal(true)
    } catch (error) {
      console.error('Error loading ticket:', error)
      alert({
        title: 'Error',
        message: 'No se pudo cargar el ticket. Inténtalo de nuevo.',
        type: 'error'
      })
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleDeleteTicket = (ticketId: string, storeName: string | null) => {
    confirm({
      title: 'Eliminar ticket',
      message: `¿Estás seguro de eliminar el ticket${storeName ? ` de "${storeName}"` : ''}?\n\nEsta acción no se puede deshacer.`,
      type: 'error',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          setLoadingTickets(true)
          await ticketService.deleteTicket(ticketId)
          await loadTickets()
          alert({
            title: 'Ticket eliminado',
            message: 'El ticket se ha eliminado correctamente',
            type: 'success'
          })
        } catch (error) {
          console.error('Error deleting ticket:', error)
          alert({
            title: 'Error',
            message: 'No se pudo eliminar el ticket. Inténtalo de nuevo.',
            type: 'error'
          })
        } finally {
          setLoadingTickets(false)
        }
      }
    })
  }

  const handleCloseModal = () => {
    setShowManualModal(false)
    setEditingTicket(null)
    setManualTicket({
      storeName: '',
      ticketNumber: '',
      purchaseDate: new Date().toISOString().slice(0, 16),
      products: []
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
          Mis Tickets
        </h1>
        <p className="text-secondary-600">
          Gestiona todos tus tickets de compra
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 font-medium">
          📄 Subir PDF
        </button>
        <button className="px-6 py-3 bg-white text-secondary-700 border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors font-medium">
          📸 Tomar foto
        </button>
        <button 
          onClick={() => setShowManualModal(true)}
          className="px-6 py-3 bg-white text-secondary-700 border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
        >
          ✍️ Entrada manual
        </button>
      </div>

      {/* Tickets List */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900">
            Historial
          </h2>
          {tickets.length > 0 && (
            <span className="text-sm text-secondary-700 bg-primary-100 px-3 py-1 rounded-full font-medium">
              {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            </span>
          )}
        </div>
        
        {loadingTickets ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
            <p className="text-secondary-600">Cargando tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
            <div className="max-w-sm mx-auto px-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
                <Receipt className="w-10 h-10 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                No hay tickets todavía
              </h3>
              <p className="text-secondary-600 text-sm mb-6">
                Comienza subiendo tu primer ticket
              </p>
              <button className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 font-medium">
                Subir mi primer ticket
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white p-5 sm:p-6 rounded-xl shadow-md border border-secondary-200 hover:shadow-xl hover:border-primary-400 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-secondary-900 text-base sm:text-lg truncate group-hover:text-primary-600 transition-colors">
                        {ticket.store_name || 'Tienda desconocida'}
                      </h3>
                      <p className="text-sm text-secondary-500 mt-1">
                        {formatDateTime(ticket.purchase_date)}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 ml-2">
                      {ticket.parsed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-primary-600 rounded-full"></span>
                          Parseado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-secondary-100"></div>

                  {ticket.ticket_number && (
                    <p className="text-xs text-secondary-500">
                      Ticket #{ticket.ticket_number}
                    </p>
                  )}

                  <div className="flex justify-between items-center gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditTicket(ticket)
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                        title="Editar ticket"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTicket(ticket.id, ticket.store_name)
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        title="Borrar ticket"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Borrar</span>
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">
                        {formatCurrency(ticket.total_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Ticket Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-8 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-secondary-900">
                {editingTicket ? '✏️ Editar Ticket' : '✍️ Nuevo Ticket Manual'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Store and Date Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Tienda *
                  </label>
                  <input
                    type="text"
                    value={manualTicket.storeName}
                    onChange={(e) => setManualTicket({ ...manualTicket, storeName: e.target.value })}
                    placeholder="Ej: Mercadona Centro"
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Fecha y hora *
                  </label>
                  <input
                    type="datetime-local"
                    value={manualTicket.purchaseDate}
                    onChange={(e) => setManualTicket({ ...manualTicket, purchaseDate: e.target.value })}
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Nº Ticket (opcional)
                </label>
                <input
                  type="text"
                  value={manualTicket.ticketNumber}
                  onChange={(e) => setManualTicket({ ...manualTicket, ticketNumber: e.target.value })}
                  placeholder="Ej: 12345"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Products Section */}
              <div>
                <h4 className="text-lg font-semibold text-secondary-900 mb-4">
                  Productos
                </h4>

                <div className="space-y-4">
                    {manualTicket.products.map((product, index) => (
                      <div key={product.id} className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded font-bold text-sm flex-shrink-0">
                            {index + 1}
                          </div>
                          
                          {/* Product Search/Select */}
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              Producto *
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={product.name}
                                onChange={(e) => {
                                  const newValue = e.target.value.toUpperCase()
                                  setManualTicket(prev => ({
                                    ...prev,
                                    products: prev.products.map(p => 
                                      p.id === product.id 
                                        ? { ...p, name: newValue, showDropdown: newValue.length >= 2 }
                                        : p
                                    )
                                  }))
                                  if (newValue.length >= 2) {
                                    handleSearchProduct(newValue)
                                  }
                                }}
                                onFocus={() => {
                                  if (product.name.length >= 2) {
                                    setManualTicket(prev => ({
                                      ...prev,
                                      products: prev.products.map(p => 
                                        p.id === product.id ? { ...p, showDropdown: true } : p
                                      )
                                    }))
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setManualTicket(prev => ({
                                      ...prev,
                                      products: prev.products.map(p => 
                                        p.id === product.id ? { ...p, showDropdown: false } : p
                                      )
                                    }))
                                  }, 200)
                                }}
                                placeholder="Buscar o crear producto..."
                                className="w-full px-3 py-2 border-2 border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm uppercase"
                              />
                              {product.showDropdown && (product.name || '').length >= 2 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                                  {availableProducts.filter(p => 
                                    p.name.toLowerCase().includes((product.name || '').toLowerCase())
                                  ).length > 0 ? (
                                    availableProducts
                                      .filter(p => p.name.toLowerCase().includes((product.name || '').toLowerCase()))
                                      .slice(0, 10)
                                      .map(p => (
                                        <div
                                          key={p.id}
                                          className="px-3 py-2 hover:bg-secondary-50 cursor-pointer text-sm"
                                          onClick={() => handleSelectProduct(product.id, p)}
                                        >
                                          <div className="font-medium text-secondary-900">{p.name}</div>
                                          {p.category && (
                                            <div className="text-xs text-secondary-600">
                                              {p.category.icon} {p.category.name}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                  ) : (
                                    <div
                                      className="px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm"
                                      onClick={() => handleCreateNewProduct(product.id, product.name || '')}
                                    >
                                      <div className="font-medium text-primary-600">
                                        ➕ Crear "{product.name}"
                                      </div>
                                      <div className="text-xs text-secondary-600">
                                        Se creará y auto-categorizará
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {product.name && !product.productId && (
                              <p className="text-xs text-amber-600 mt-1">⚠️ Producto nuevo - se creará automáticamente</p>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleRemoveProduct(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Product Type and Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pl-11">
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              Tipo
                            </label>
                            <select
                              value={product.productType}
                              onChange={(e) => handleUpdateProduct(product.id, 'productType', e.target.value)}
                              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            >
                              <option value="unit">Por unidades</option>
                              <option value="weight">Por peso</option>
                            </select>
                          </div>
                          
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              {product.productType === 'unit' ? 'Unidades' : 'Peso (kg)'}
                            </label>
                            <input
                              type="number"
                              value={product.quantity}
                              onChange={(e) => handleUpdateProduct(product.id, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder={product.productType === 'unit' ? 'Ej: 2' : 'Ej: 0.5'}
                              min="0"
                              step={product.productType === 'unit' ? '1' : '0.001'}
                              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            />
                          </div>
                          
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              {product.productType === 'unit' ? 'Precio/ud' : 'Precio/kg'}
                            </label>
                            <input
                              type="number"
                              value={product.unitPrice}
                              onChange={(e) => handleUpdateProduct(product.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            />
                          </div>
                          
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-medium text-secondary-700 mb-1">
                              Total
                            </label>
                            <div className="flex items-center px-3 py-2 bg-white border border-secondary-300 rounded-lg text-sm font-semibold text-secondary-900">
                              {formatCurrency(product.total)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Add Product Button */}
                  <button
                    onClick={handleAddProduct}
                    className="w-full py-3 border-2 border-dashed border-primary-300 text-primary-600 rounded-lg hover:bg-primary-50 hover:border-primary-400 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Añadir producto
                  </button>
                </div>
              </div>

              {/* Total */}
              {manualTicket.products.length > 0 && (
                <div className="flex justify-between items-center p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                  <span className="text-lg font-semibold text-secondary-900">
                    Total:
                  </span>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-secondary-200">
              <button
                onClick={() => setShowManualModal(false)}
                className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveManualTicket}
                disabled={!manualTicket.storeName.trim() || manualTicket.products.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save className="w-5 h-5" />
                Guardar ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Component */}
      <DialogComponent />
    </div>
  )
}
