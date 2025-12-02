import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Loader2, Receipt, Plus, Trash2, Save, X, Edit2, Filter, ChevronDown } from 'lucide-react'
import ticketService from '../services/ticketService'
import supermarketService from '../services/supermarketService'
import { formatCurrency, formatDateTime } from '../lib/formatters'
import { useDialog } from '../hooks/useDialog'
import CustomSelect from '../components/CustomSelect'
import { notifyProductsUpdated } from '../hooks/useProductsCount'
import { handleSupabaseError } from '../lib/sessionManager'
import type { Database } from '../types/database'

type Supermarket = Database['public']['Tables']['supermarkets']['Row']

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
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [manualTicket, setManualTicket] = useState({
    storeName: '',
    supermarketId: '',
    ticketNumber: '',
    purchaseDate: new Date().toISOString().slice(0, 16), // formato: YYYY-MM-DDTHH:mm
    products: [] as ManualProduct[]
  })
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [uploadingPDF, setUploadingPDF] = useState(false)
  const [savingTicket, setSavingTicket] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null) // Guardar el archivo PDF original
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Estados de filtros
  const [showFilters, setShowFilters] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState<string>('last-month')
  const [filterStore, setFilterStore] = useState<string>('')
  const [filterSupermarket, setFilterSupermarket] = useState<string>('')
  const [filterMinAmount, setFilterMinAmount] = useState<string>('')
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>('')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  useEffect(() => {
    if (user) {
      loadTickets()
      loadSupermarkets()
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
      handleSupabaseError(error)
    } finally {
      setLoadingTickets(false)
    }
  }

  const loadSupermarkets = async () => {
    try {
      const data = await supermarketService.getAll()
      setSupermarkets(data)
    } catch (error) {
      console.error('Error loading supermarkets:', error)
    }
  }

  // Lógica de filtrado
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets]

    // Filtro por período
    const now = new Date()
    let startDate: Date | null = null
    
    switch (filterPeriod) {
      case 'last-week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case 'last-6-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        break
      case 'last-year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      case 'custom':
        if (customStartDate) {
          startDate = new Date(customStartDate)
        }
        break
      case 'all':
        startDate = null
        break
    }

    if (startDate) {
      filtered = filtered.filter(ticket => {
        if (!ticket.purchase_date) return false
        const ticketDate = new Date(ticket.purchase_date)
        return ticketDate >= startDate!
      })
    }

    // Filtro por fecha de fin (solo para período personalizado)
    if (filterPeriod === 'custom' && customEndDate) {
      const endDate = new Date(customEndDate)
      endDate.setHours(23, 59, 59, 999) // Final del día
      filtered = filtered.filter(ticket => {
        if (!ticket.purchase_date) return false
        const ticketDate = new Date(ticket.purchase_date)
        return ticketDate <= endDate
      })
    }

    // Filtro por tienda
    if (filterStore) {
      filtered = filtered.filter(ticket =>
        ticket.store_name?.toLowerCase().includes(filterStore.toLowerCase())
      )
    }

    // Filtro por supermercado
    if (filterSupermarket) {
      filtered = filtered.filter(ticket => ticket.supermarket_id === filterSupermarket)
    }    // Filtro por importe mínimo
    if (filterMinAmount) {
      const minAmount = parseFloat(filterMinAmount)
      if (!isNaN(minAmount)) {
        filtered = filtered.filter(ticket => (ticket.total_amount ?? 0) >= minAmount)
      }
    }

    // Filtro por importe máximo
    if (filterMaxAmount) {
      const maxAmount = parseFloat(filterMaxAmount)
      if (!isNaN(maxAmount)) {
        filtered = filtered.filter(ticket => (ticket.total_amount ?? 0) <= maxAmount)
      }
    }

    // Ordenar por fecha (más recientes primero)
    return filtered.sort((a, b) => {
      const dateA = a.purchase_date ? new Date(a.purchase_date).getTime() : 0
      const dateB = b.purchase_date ? new Date(b.purchase_date).getTime() : 0
      return dateB - dateA
    })
  }, [tickets, filterPeriod, filterStore, filterSupermarket, filterMinAmount, filterMaxAmount, customStartDate, customEndDate])

  // Obtener lista única de tiendas
  const availableStores = useMemo(() => {
    const stores = new Set(tickets.map(t => t.store_name).filter(Boolean) as string[])
    return Array.from(stores).sort()
  }, [tickets])

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

  const handleSelectProduct = async (productId: string, selectedProduct: any) => {
    // Obtener el último precio y cantidad del producto
    const lastInfo = await ticketService.getLastProductInfo(selectedProduct.id)
    
    setManualTicket({
      ...manualTicket,
      products: manualTicket.products.map(p => {
        if (p.id === productId) {
          const updatedProduct = {
            ...p,
            productId: selectedProduct.id,
            name: selectedProduct.name,
            showDropdown: false
          }
          
          // Si encontramos info previa, usarla
          if (lastInfo !== null) {
            updatedProduct.unitPrice = lastInfo.unitPrice
            
            // Detectar el tipo de producto por la cantidad
            // Si la cantidad es decimal (ej: 0.5, 1.234), probablemente es peso
            // Si es entero (1, 2, 3), probablemente es unidad
            const isWeight = lastInfo.quantity % 1 !== 0
            updatedProduct.productType = isWeight ? 'weight' : 'unit'
            
            // Mantener la cantidad del usuario o poner 1 por defecto
            updatedProduct.total = updatedProduct.quantity * lastInfo.unitPrice
          }
          
          return updatedProduct
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
    if (!manualTicket.supermarketId) {
      alert({
        title: 'Campo requerido',
        message: 'Por favor, selecciona un supermercado',
        type: 'warning'
      })
      return
    }

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
      setSavingTicket(true)
      
      if (editingTicket) {
        // Editar ticket existente
        await ticketService.updateTicket(
          editingTicket.id,
          manualTicket.supermarketId,
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
      } else if (pdfFile) {
        // Crear ticket desde PDF - uploadAndParseTicket ya crea el ticket completo
        // pero con los datos parseados, ahora lo actualizamos con los datos revisados por el usuario
        const createdTicket = await ticketService.uploadAndParseTicket(pdfFile, user.id)
        
        // Actualizar con los datos editados/revisados por el usuario
        await ticketService.updateTicket(
          createdTicket.id,
          manualTicket.supermarketId,
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
        // Crear ticket manual (sin PDF)
        await ticketService.createManualTicket(
          user.id,
          manualTicket.supermarketId,
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
      
      // Notificar que se han actualizado productos (pueden haberse creado nuevos)
      notifyProductsUpdated()
      
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
      setSavingTicket(false)
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
        supermarketId: ticket.supermarket_id || '',
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

  const handleDeleteTicket = async (ticketId: string, storeName: string | null) => {
    const confirmed = await confirm({
      title: 'Eliminar ticket',
      message: `¿Estás seguro de eliminar el ticket${storeName ? ` de "${storeName}"` : ''}?\n\nEsta acción no se puede deshacer.`,
      type: 'error',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    })

    if (!confirmed) return

    try {
      setLoadingTickets(true)
      await ticketService.deleteTicket(ticketId)
      await loadTickets()
      await alert({
        title: 'Ticket eliminado',
        message: 'El ticket se ha eliminado correctamente',
        type: 'success'
      })
    } catch (error) {
      console.error('Error deleting ticket:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo eliminar el ticket. Inténtalo de nuevo.',
        type: 'error'
      })
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleCloseModal = () => {
    setShowManualModal(false)
    setEditingTicket(null)
    setPdfFile(null) // Limpiar el archivo PDF
    setManualTicket({
      storeName: '',
      supermarketId: '',
      ticketNumber: '',
      purchaseDate: new Date().toISOString().slice(0, 16),
      products: []
    })
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  const handleUploadPDF = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await processFile(file)
    }
    // Limpiar el input para permitir subir el mismo archivo de nuevo
    event.target.value = ''
  }

  const processFile = async (file: File) => {
    if (!user) return

    // Validar que sea un PDF
    if (file.type !== 'application/pdf') {
      alert({
        title: 'Archivo inválido',
        message: 'Por favor, selecciona un archivo PDF',
        type: 'error'
      })
      return
    }

    try {
      setUploadingPDF(true)

      // Parsear el PDF
      const pdfParser = (await import('../services/pdfParser')).default
      const parsedData = await pdfParser.parseTicketFromFile(file)

      console.log('📄 PDF parseado:', parsedData)

      // Cargar todos los productos para buscar coincidencias
      const productService = (await import('../services/productService')).default
      const allProducts = await productService.getAll()

      // Convertir productos parseados a formato ManualProduct
      const products: ManualProduct[] = parsedData.products.map((p, index) => {
        const productName = p.item_name.toUpperCase()
        // Intentar encontrar el producto en la BD
        const existingProduct = allProducts.find(
          prod => prod.name.toUpperCase() === productName
        )

        return {
          id: `${Date.now()}_${index}`,
          productId: existingProduct?.id || null,
          name: productName,
          productType: p.weight_kg ? 'weight' : 'unit',
          quantity: p.weight_kg || p.quantity,
          unitPrice: p.price_per_kg || p.unit_price || 0,
          total: p.total,
          showDropdown: false
        }
      })

      // Convertir fecha a formato datetime-local
      const purchaseDateTime = parsedData.date && parsedData.time
        ? `${parsedData.date}T${parsedData.time}`
        : new Date().toISOString().slice(0, 16)

      // Verificar si ya existe un ticket con la misma fecha/hora y número
      const duplicateTicket = tickets.find(ticket => {
        // Comparar fecha y hora (ignorar segundos)
        const existingDateTime = ticket.purchase_date 
          ? new Date(ticket.purchase_date).toISOString().slice(0, 16)
          : null
        const parsedDateTime = purchaseDateTime.slice(0, 16)
        
        const sameDateTime = existingDateTime === parsedDateTime
        const sameTicketNumber = parsedData.invoiceNumber && 
          ticket.ticket_number === parsedData.invoiceNumber
        
        // Considerar duplicado si coincide fecha/hora o número de ticket
        return sameDateTime || sameTicketNumber
      })

      // Función para continuar con el proceso de parseado
      const proceedWithParsing = () => {
        // Guardar el archivo PDF para subirlo después
        setPdfFile(file)
        
        // Llenar el formulario con los datos parseados
        setManualTicket({
          storeName: parsedData.store || '',
          supermarketId: parsedData.supermarketId || '',
          ticketNumber: parsedData.invoiceNumber || '',
          purchaseDate: purchaseDateTime,
          products: products
        })

        // Abrir el modal para revisar/editar
        setShowManualModal(true)

        alert({
          title: 'PDF parseado',
          message: `Se han extraído ${products.length} productos. Revisa los datos antes de guardar.`,
          type: 'success'
        })
      }

      if (duplicateTicket) {
        const proceed = await confirm({
          title: '⚠️ Ticket duplicado',
          message: `Ya existe un ticket con ${
            duplicateTicket.ticket_number === parsedData.invoiceNumber 
              ? `el número ${parsedData.invoiceNumber}` 
              : 'la misma fecha y hora'
          } en la base de datos.\n\n¿Deseas continuar y crear uno nuevo de todas formas?`,
          type: 'warning',
          confirmText: 'Continuar',
          cancelText: 'Cancelar'
        })
        if (!proceed) return
        proceedWithParsing()
      }

      // Si no hay duplicado, proceder directamente
      proceedWithParsing()
    } catch (error) {
      console.error('Error al procesar PDF:', error)
      alert({
        title: 'Error al procesar PDF',
        message: 'No se pudo leer el ticket. Intenta con entrada manual o verifica el archivo.',
        type: 'error'
      })
    } finally {
      setUploadingPDF(false)
    }
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

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-8 relative transition-all duration-200 ${
          isDragging ? 'scale-[1.02]' : ''
        }`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 bg-primary-500/10 backdrop-blur-sm border-4 border-dashed border-primary-500 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-3">📄</div>
              <p className="text-xl font-bold text-primary-700">Suelta el PDF aquí</p>
              <p className="text-sm text-secondary-600 mt-1">Se procesará automáticamente</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <input
            type="file"
            id="pdf-upload"
            accept="application/pdf"
            onChange={handleUploadPDF}
            className="hidden"
          />
          <button 
            onClick={() => document.getElementById('pdf-upload')?.click()}
            disabled={uploadingPDF}
            className="px-6 py-3 bg-white text-secondary-700 border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploadingPDF ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                Procesando...
              </>
            ) : (
              <>
                📄 Subir PDF
                <span className="hidden sm:inline text-xs text-secondary-500 ml-1">o arrastra aquí</span>
              </>
            )}
          </button>
          <button 
            onClick={() => setShowManualModal(true)}
            className="px-6 py-3 bg-white text-secondary-700 border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
          >
            ✍️ Entrada manual
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-secondary-200">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full mb-4 hover:bg-secondary-50 -m-4 p-4 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-secondary-600" />
            <h3 className="font-semibold text-secondary-900">Filtros</h3>
            {filteredTickets.length !== tickets.length && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {filteredTickets.length} de {tickets.length}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-secondary-600 transition-transform ${
              showFilters ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Período
            </label>
            <CustomSelect
              options={[
                { value: 'last-week', label: 'Última semana' },
                { value: 'last-month', label: 'Último mes' },
                { value: 'last-3-months', label: 'Últimos 3 meses' },
                { value: 'last-6-months', label: 'Últimos 6 meses' },
                { value: 'last-year', label: 'Último año' },
                { value: 'custom', label: 'Personalizado' },
                { value: 'all', label: 'Todos' },
              ]}
              value={filterPeriod}
              onChange={setFilterPeriod}
            />
          </div>

          {/* Supermercado */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Supermercado
            </label>
            <CustomSelect
              options={[
                { value: '', label: 'Todos' },
                ...supermarkets.map(sm => ({
                  value: sm.id,
                  label: sm.name
                }))
              ]}
              value={filterSupermarket}
              onChange={setFilterSupermarket}
              placeholder="Todos"
            />
          </div>

          {/* Tienda */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Tienda
            </label>
            <CustomSelect
              options={[
                { value: '', label: 'Todas' },
                ...availableStores.map(store => ({
                  value: store,
                  label: store
                }))
              ]}
              value={filterStore}
              onChange={setFilterStore}
              placeholder="Todas"
            />
          </div>

          {/* Importe mínimo */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Importe mínimo
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00 €"
              value={filterMinAmount}
              onChange={(e) => setFilterMinAmount(e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Importe máximo */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Importe máximo
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00 €"
              value={filterMaxAmount}
              onChange={(e) => setFilterMaxAmount(e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Fechas personalizadas (solo visible cuando se selecciona "Personalizado") */}
        {filterPeriod === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-secondary-200">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Fecha desde
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Fecha hasta
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

            {/* Contador de resultados filtrados */}
            {tickets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-secondary-200">
                <p className="text-sm text-secondary-600">
                  Mostrando <span className="font-semibold text-primary-600">{filteredTickets.length}</span> de <span className="font-semibold">{tickets.length}</span> tickets
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900">
            Historial
          </h2>
          {tickets.length > 0 && (
            <span className="text-sm text-secondary-700 bg-primary-100 px-3 py-1 rounded-full font-medium">
              {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
              {filteredTickets.length !== tickets.length && (
                <span className="text-xs text-secondary-600 ml-1">(filtrado)</span>
              )}
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
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
            <div className="max-w-sm mx-auto px-4">
              <Filter className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                No hay tickets que coincidan
              </h3>
              <p className="text-secondary-600 text-sm mb-6">
                Intenta ajustar los filtros para ver más resultados
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white p-5 sm:p-6 rounded-xl shadow-md border border-secondary-200 hover:shadow-xl hover:border-primary-400 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      {ticket.supermarket_id && (() => {
                        const supermarket = supermarkets.find(sm => sm.id === ticket.supermarket_id)
                        return supermarket && (
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                              style={{
                                backgroundColor: supermarket.color ? `${supermarket.color}15` : '#f3f4f6',
                                color: supermarket.color || '#374151'
                              }}
                            >
                              {supermarket.name}
                            </span>
                          </div>
                        )
                      })()}
                      <h3 className="font-semibold text-secondary-900 text-base sm:text-lg truncate group-hover:text-primary-600 transition-colors">
                        {ticket.store_name || 'Tienda desconocida'}
                      </h3>
                      <p className="text-sm text-secondary-500 mt-1">
                        {formatDateTime(ticket.purchase_date)}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 ml-2">
                      {ticket.source_type === 'manual' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                          Manual
                        </span>
                      ) : ticket.source_type === 'pdf' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-primary-600 rounded-full"></span>
                          PDF
                        </span>
                      ) : ticket.parsed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-primary-600 rounded-full"></span>
                          PDF
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
                disabled={savingTicket}
                className="p-2 hover:bg-secondary-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Supermarket Selection */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Supermercado *
                </label>
                <CustomSelect
                  options={[
                    { value: '', label: 'Selecciona un supermercado' },
                    ...supermarkets.map(sm => ({
                      value: sm.id,
                      label: sm.name
                    }))
                  ]}
                  value={manualTicket.supermarketId}
                  onChange={(value) => setManualTicket({ ...manualTicket, supermarketId: value })}
                  placeholder="Selecciona un supermercado"
                />
              </div>

              {/* Store and Date Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Tienda *
                  </label>
                  <input
                    type="text"
                    value={manualTicket.storeName}
                    onChange={(e) => {
                      setManualTicket({ ...manualTicket, storeName: e.target.value })
                      setShowStoreDropdown(e.target.value.length >= 1)
                    }}
                    onFocus={() => setShowStoreDropdown(manualTicket.storeName.length >= 1)}
                    onBlur={() => setTimeout(() => setShowStoreDropdown(false), 200)}
                    placeholder="Ej: Mercadona Centro"
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {showStoreDropdown && availableStores.filter(store => 
                    store.toLowerCase().includes(manualTicket.storeName.toLowerCase())
                  ).length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                      {availableStores
                        .filter(store => store.toLowerCase().includes(manualTicket.storeName.toLowerCase()))
                        .slice(0, 10)
                        .map(store => (
                          <div
                            key={store}
                            className="px-4 py-2 hover:bg-secondary-50 cursor-pointer text-sm"
                            onClick={() => {
                              setManualTicket({ ...manualTicket, storeName: store })
                              setShowStoreDropdown(false)
                            }}
                          >
                            <div className="font-medium text-secondary-900">{store}</div>
                          </div>
                        ))}
                    </div>
                  )}
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
                            <CustomSelect
                              options={[
                                { value: 'unit', label: 'Por unidades' },
                                { value: 'weight', label: 'Por peso' }
                              ]}
                              value={product.productType}
                              onChange={(value) => handleUpdateProduct(product.id, 'productType', value)}
                            />
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
                disabled={savingTicket}
                className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveManualTicket}
                disabled={savingTicket || !manualTicket.storeName.trim() || manualTicket.products.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {savingTicket ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar ticket
                  </>
                )}
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
