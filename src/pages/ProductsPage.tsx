import { useState, useEffect } from 'react'
import { Search, CheckCircle, AlertCircle, Clock, Edit2, Plus, Trash2, RefreshCcw } from 'lucide-react'
import productService, { type ProductWithCategory, type ProductStatsDetail } from '../services/productService'
import categoryService from '../services/categoryService'
import catalogService from '../services/catalogService'
import type { Database } from '../types/database'
import { useAuthStore } from '../stores/authStore'
import { useDialog } from '../hooks/useDialog'
import CustomSelect from '../components/CustomSelect'
import AliasManager from '../components/AliasManager'
import { notifyProductsUpdated } from '../hooks/useProductsCount'
import ProductDetailsModal from '../components/ProductDetailsModal'

type Category = Database['public']['Tables']['categories']['Row']
type ReviewStatus = 'pending' | 'uncategorized' | 'reviewed' | 'all'

export default function ProductsPage() {
  const { user } = useAuthStore()
  const { alert, confirm, DialogComponent } = useDialog()
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReviewStatus>('all')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [currentProduct, setCurrentProduct] = useState<ProductWithCategory | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isNewlyCreated, setIsNewlyCreated] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50
  const [viewMode, setViewMode] = useState<'paged' | 'category'>('paged')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [newProduct, setNewProduct] = useState({
    name: '',
    category_id: '',
  })
  const [categorySearch, setCategorySearch] = useState('')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [replacingWithGlobal, setReplacingWithGlobal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null)
  const [productStats, setProductStats] = useState<ProductStatsDetail | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, selectedCategory])

  useEffect(() => {
    if (viewMode === 'category') {
      setExpandedCategories(new Set())
    }
  }, [viewMode])


  const loadData = async () => {
    setLoading(true)
    try {
      if (!user?.id) return
      const [productsData, categoriesData] = await Promise.all([
        productService.getAll(user.id),
        categoryService.getAll(user.id)
      ])
      setProducts(productsData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // First-time prompt: if empty catalog, ask to import global once per user
  useEffect(() => {
    if (loading) return
    if (!user?.id) return
    const alreadyAsked = localStorage.getItem(`global-import-prompt-shown:${user.id}`) === '1'
    const pendingPostSignup = localStorage.getItem(`post-signup-import-prompt:${user.id}`) === '1'
    if (alreadyAsked || pendingPostSignup) return
    const isEmpty = products.length === 0 && categories.length === 0
    if (!isEmpty) return

    const ask = async () => {
      const accepted = await confirm({
        title: 'Importar catálogo global',
        message:
          'Tu catálogo está vacío. ¿Quieres importar el catálogo global ahora?\n\nEsto reemplazará tus productos y categorías actuales (si los hubiera) por el catálogo global. Los aliases no se incluyen.',
        type: 'warning',
        confirmText: 'Reemplazar con global',
        cancelText: 'Mantener vacío'
      })
      localStorage.setItem(`global-import-prompt-shown:${user.id}`, '1')
      if (!accepted) return
      try {
        setReplacingWithGlobal(true)
        await catalogService.replaceUserCatalogWithGlobal()
        await loadData()
        await alert({
          title: 'Catálogo importado',
          message: 'Se ha importado el catálogo global correctamente.',
          type: 'success'
        })
      } catch (e) {
        console.error('Global import failed', e)
        alert({
          title: 'Error',
          message: 'No se pudo importar el catálogo global. Inténtalo de nuevo más tarde.',
          type: 'error'
        })
      } finally {
        setReplacingWithGlobal(false)
      }
    }
    ask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, products.length, categories.length])

  const handleSaveProduct = async () => {
    if (isEditMode) {
      if (!currentProduct) return
      try {
        if (!user?.id) return
        await productService.update(
          currentProduct.id,
          {
            category_id: currentProduct.category_id,
          },
          user.id
        )
        await loadData()
        notifyProductsUpdated()
        closeModal()
      } catch (error) {
        console.error('Error updating product:', error)
      }
    } else {
      if (!newProduct.name.trim()) return
      try {
        if (!user?.id) return
        const createdProduct = await productService.create({
          name: newProduct.name.trim(),
          category_id: newProduct.category_id || null,
        }, user.id)
        // Switch to edit mode to allow adding aliases
        setIsEditMode(true)
        setIsNewlyCreated(true)
        setCurrentProduct(createdProduct as ProductWithCategory)
        setNewProduct({ name: '', category_id: '' })
        await loadData()
        notifyProductsUpdated()
      } catch (error) {
        console.error('Error creating product:', error)
        alert({
          title: 'Error',
          message: 'No se pudo crear el producto. Puede que ya exista.',
          type: 'error'
        })
      }
    }
  }

  const handleDeleteProduct = async () => {
    if (!currentProduct) return
    
    const confirmed = await confirm({
      title: 'Eliminar Producto',
      message: `¿Estás seguro de que deseas eliminar "${currentProduct.name}"?`,
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    })
    
    if (!confirmed) return

    try {
      if (!user?.id) return
      await productService.delete(currentProduct.id, user.id)
      await loadData()
      notifyProductsUpdated()
      closeModal()
      await alert({
        title: 'Producto Eliminado',
        message: 'El producto se ha eliminado correctamente',
        type: 'success'
      })
    } catch (error) {
      console.error('Error deleting product:', error)
      alert({
        title: 'Error',
        message: 'No se pudo eliminar el producto',
        type: 'error'
      })
    }
  }

  const openCreateModal = () => {
    setIsEditMode(false)
    setCurrentProduct(null)
    setNewProduct({ name: '', category_id: '' })
    setCategorySearch('')
    setShowModal(true)
  }

  const openEditModal = (product: ProductWithCategory) => {
    setIsEditMode(true)
    setCurrentProduct(product)
    setCategorySearch('')
    setShowModal(true)
  }

  const openDetailsModal = async (product: ProductWithCategory) => {
    setSelectedProduct(product)
    setShowDetailsModal(true)
    setProductStats(null)
    if (!user?.id) return
    setLoadingStats(true)
    try {
      const stats = await productService.getProductStats(product.id, user.id)
      setProductStats(stats)
    } catch (error) {
      console.error('Error loading product stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedProduct(null)
    setProductStats(null)
  }

  const handleReplaceWithGlobal = async () => {
    if (!user?.id) return
    const accepted = await confirm({
      title: 'Reemplazar por catálogo global',
      message:
        'Esta acción eliminará tus productos y categorías y los reemplazará por el catálogo global.\n\nNo se importan aliases. ¿Deseas continuar?',
      type: 'warning',
      confirmText: 'Reemplazar',
      cancelText: 'Cancelar'
    })
    if (!accepted) return
    try {
      setReplacingWithGlobal(true)
      await catalogService.replaceUserCatalogWithGlobal()
      await loadData()
      await alert({
        title: 'Catálogo reemplazado',
        message: 'Se ha reemplazado tu catálogo por el global.',
        type: 'success'
      })
    } catch (e) {
      console.error('Global replace failed', e)
      alert({
        title: 'Error',
        message: 'No se pudo reemplazar tu catálogo. Inténtalo de nuevo.',
        type: 'error'
      })
    } finally {
      setReplacingWithGlobal(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setIsEditMode(false)
    setIsNewlyCreated(false)
    setCurrentProduct(null)
    setNewProduct({ name: '', category_id: '' })
    setCategorySearch('')
  }

  const filteredProducts = products.filter(product => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = product.name.toLowerCase().includes(query)
      if (!matchesName) return false
    }

    // Filter by status
    if (filterStatus !== 'all' && product.review_status !== filterStatus) {
      return false
    }

    // Filter by category
    if (selectedCategory && product.category_id !== selectedCategory) {
      return false
    }

    return true
  })

  const stats = {
    total: products.length,
    pending: products.filter(p => p.review_status === 'pending').length,
    uncategorized: products.filter(p => p.review_status === 'uncategorized').length,
    reviewed: products.filter(p => p.review_status === 'reviewed').length,
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reviewed':
        return <CheckCircle className="w-4 h-4 text-primary-600" />
      case 'uncategorized':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-secondary-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'reviewed':
        return 'Revisado'
      case 'uncategorized':
        return 'Sin categoría'
      default:
        return 'Pendiente'
    }
  }

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize)

  const productsByCategory = filteredProducts.reduce((map, product) => {
    const name = product.category?.name || 'Sin categoría'
    if (!map.has(name)) map.set(name, [])
    map.get(name)!.push(product)
    return map
  }, new Map<string, ProductWithCategory[]>())

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
            Productos
          </h1>
          <p className="text-secondary-600">
            Gestiona tus productos y categorías
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
          <a
            href="/categories"
            className="flex items-center gap-2 px-4 py-2 text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <span className="text-sm font-medium">Categorías</span>
          </a>
          <button
            onClick={handleReplaceWithGlobal}
            disabled={replacingWithGlobal}
            className="flex items-center gap-2 px-4 py-2 text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Reemplaza tus datos por el catálogo global"
          >
            <RefreshCcw className="w-4 h-4" />
            <span className="text-sm font-medium">
              {replacingWithGlobal ? 'Reemplazando…' : 'Reemplazar catálogo global'}
            </span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Clickable Filters */}
      <div className="sm:hidden mb-6">
        <label className="block text-sm font-medium text-secondary-700 mb-1">Estado</label>
        <CustomSelect
          options={[
            { value: 'all', label: `Total productos (${stats.total})` },
            { value: 'reviewed', label: `Revisados (${stats.reviewed})` },
            { value: 'pending', label: `Pendientes (${stats.pending})` },
            { value: 'uncategorized', label: `Sin categoría (${stats.uncategorized})` }
          ]}
          value={filterStatus}
          onChange={(value) => setFilterStatus(value as ReviewStatus)}
        />
      </div>
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={`bg-white rounded-xl p-4 border transition-all text-left hover:shadow-md ${
            filterStatus === 'all'
              ? 'border-secondary-900 ring-2 ring-secondary-900'
              : 'border-secondary-200 hover:border-secondary-400'
          }`}
        >
          <div className="text-2xl font-bold text-secondary-900">{stats.total}</div>
          <div className="text-sm text-secondary-600">Total productos</div>
        </button>
        <button
          onClick={() => setFilterStatus('reviewed')}
          className={`bg-white rounded-xl p-4 border transition-all text-left hover:shadow-md ${
            filterStatus === 'reviewed'
              ? 'border-primary-600 ring-2 ring-primary-600'
              : 'border-primary-200 hover:border-primary-400'
          }`}
        >
          <div className="text-2xl font-bold text-primary-600">{stats.reviewed}</div>
          <div className="text-sm text-secondary-600">Revisados</div>
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`bg-white rounded-xl p-4 border transition-all text-left hover:shadow-md ${
            filterStatus === 'pending'
              ? 'border-secondary-600 ring-2 ring-secondary-600'
              : 'border-secondary-200 hover:border-secondary-400'
          }`}
        >
          <div className="text-2xl font-bold text-secondary-600">{stats.pending}</div>
          <div className="text-sm text-secondary-600">Pendientes</div>
        </button>
        <button
          onClick={() => setFilterStatus('uncategorized')}
          className={`bg-white rounded-xl p-4 border transition-all text-left hover:shadow-md ${
            filterStatus === 'uncategorized'
              ? 'border-red-600 ring-2 ring-red-600'
              : 'border-red-200 hover:border-red-400'
          }`}
        >
          <div className="text-2xl font-bold text-red-600">{stats.uncategorized}</div>
          <div className="text-sm text-secondary-600">Sin categoría</div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-secondary-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-secondary-900 placeholder:text-secondary-400"
              />
            </div>
          </div>

          {/* Category Filter */}
          <CustomSelect
            options={[
              { value: '', label: 'Todas las categorías' },
              ...categories.map(cat => ({
                value: cat.id,
                label: `${cat.icon} ${cat.name}`
              }))
            ]}
            value={selectedCategory || ''}
            onChange={(value) => setSelectedCategory(value || null)}
            placeholder="Todas las categorías"
            className="md:w-64"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('paged')}
              className={`px-3 py-2 rounded-lg text-sm border transition ${viewMode === 'paged'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-secondary-700 border-secondary-300 hover:bg-secondary-50'
              }`}
            >
              Paginada
            </button>
            <button
              onClick={() => setViewMode('category')}
              className={`px-3 py-2 rounded-lg text-sm border transition ${viewMode === 'category'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-secondary-700 border-secondary-300 hover:bg-secondary-50'
              }`}
            >
              Por categorías
            </button>
          </div>
        </div>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-secondary-600">Cargando productos...</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">
            No hay productos
          </h3>
          <p className="text-secondary-600 text-sm">
            {searchQuery || filterStatus !== 'all' || selectedCategory 
              ? 'No se encontraron productos con los filtros aplicados'
              : 'Los productos de tus tickets aparecerán aquí'}
          </p>
        </div>
      ) : viewMode === 'paged' ? (
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 text-sm text-secondary-600">
            <span>
              Mostrando {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredProducts.length)} de {filteredProducts.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 border border-secondary-300 rounded-lg hover:bg-secondary-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-xs text-secondary-500">{safePage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 border border-secondary-300 rounded-lg hover:bg-secondary-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                    Aliases
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-secondary-700 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {paginatedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-secondary-50 transition-colors cursor-pointer"
                    onClick={() => openDetailsModal(product)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(product.review_status)}
                        <span className="text-sm text-secondary-600">
                          {getStatusLabel(product.review_status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-secondary-900">
                        {product.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {product.aliases && product.aliases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.aliases.map((alias) => (
                            <span key={alias} className="inline-block px-2 py-1 bg-secondary-100 text-secondary-700 rounded text-xs">
                              {alias}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-secondary-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {product.category ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" 
                          style={{ 
                            backgroundColor: (product.category.color || '#6b7280') + '20', 
                            color: product.category.color || '#6b7280' 
                          }}
                        >
                          {product.category.icon} {product.category.name}
                        </span>
                      ) : (
                        <span className="text-sm text-secondary-400">Sin categoría</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(product)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCurrentProduct(product)
                            handleDeleteProduct()
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(productsByCategory.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([categoryName, items]) => (
              <div key={categoryName} className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
                <button
                  onClick={() => {
                    setExpandedCategories(prev => {
                      const next = new Set(prev)
                      if (next.has(categoryName)) next.delete(categoryName)
                      else next.add(categoryName)
                      return next
                    })
                  }}
                  className="w-full px-4 py-3 border-b border-secondary-200 text-sm font-semibold text-secondary-700 flex items-center justify-between hover:bg-secondary-50"
                >
                  <span>{categoryName} · {items.length}</span>
                  <span className="text-secondary-500">{expandedCategories.has(categoryName) ? '▾' : '▸'}</span>
                </button>
                {expandedCategories.has(categoryName) && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50 border-b border-secondary-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-secondary-700 uppercase tracking-wider">
                            Aliases
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-secondary-700 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-200">
                        {items.map((product) => (
                          <tr
                            key={product.id}
                            className="hover:bg-secondary-50 transition-colors cursor-pointer"
                            onClick={() => openDetailsModal(product)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(product.review_status)}
                                <span className="text-sm text-secondary-600">
                                  {getStatusLabel(product.review_status)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-secondary-900">
                                {product.name}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {product.aliases && product.aliases.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {product.aliases.map((alias) => (
                                    <span key={alias} className="inline-block px-2 py-1 bg-secondary-100 text-secondary-700 rounded text-xs">
                                      {alias}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-secondary-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditModal(product)
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Editar
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCurrentProduct(product)
                                    handleDeleteProduct()
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <ProductDetailsModal
        isOpen={showDetailsModal}
        product={selectedProduct}
        stats={productStats}
        loading={loadingStats}
        onClose={closeDetailsModal}
        onEdit={selectedProduct ? () => {
          closeDetailsModal()
          openEditModal(selectedProduct)
        } : undefined}
        onDelete={selectedProduct ? async () => {
          setCurrentProduct(selectedProduct)
          await handleDeleteProduct()
          closeDetailsModal()
        } : undefined}
      />

      {/* Edit Modal */}
      {/* Unified Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-secondary-900 mb-4">
              {isNewlyCreated ? 'Producto Creado' : isEditMode ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
            
            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  {isEditMode ? 'Nombre original' : 'Nombre del producto *'}
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={currentProduct?.name || ''}
                    disabled
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-600"
                  />
                ) : (
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Ej: Cerveza 0,0 Tostada Pack-6"
                    className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                  />
                )}
              </div>

              {/* Category Field */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Categoría
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value)
                      setShowCategoryDropdown(true)
                    }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                    placeholder={
                      isEditMode
                        ? currentProduct?.category ? `${currentProduct.category.icon} ${currentProduct.category.name}` : 'Escribe para buscar...'
                        : newProduct.category_id ? categories.find(c => c.id === newProduct.category_id)?.name || 'Escribe para buscar...' : 'Escribe para buscar...'
                    }
                    className="w-full px-4 py-2 border-2 border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white text-secondary-900 placeholder:text-secondary-400"
                  />
                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                      <div
                        className="px-4 py-3 hover:bg-secondary-50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (isEditMode) {
                            setCurrentProduct({ ...currentProduct, category_id: null, category: null } as ProductWithCategory)
                          } else {
                            setNewProduct({ ...newProduct, category_id: '' })
                          }
                          setCategorySearch('')
                          setShowCategoryDropdown(false)
                        }}
                      >
                        <span className="inline-block px-3 py-1 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: '#9ca3af' }}>
                          Sin categoría
                        </span>
                      </div>
                      {categories
                        .filter(cat => 
                          categorySearch === '' || 
                          cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(cat => (
                          <div
                            key={cat.id}
                            className="px-4 py-3 hover:bg-secondary-50 cursor-pointer transition-colors"
                            onClick={() => {
                              if (isEditMode) {
                                setCurrentProduct({ ...currentProduct, category_id: cat.id, category: cat } as ProductWithCategory)
                              } else {
                                setNewProduct({ ...newProduct, category_id: cat.id })
                              }
                              setCategorySearch('')
                              setShowCategoryDropdown(false)
                            }}
                          >
                            <span className="inline-block px-3 py-1 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: cat.color || '#6b7280' }}>
                              {cat.icon} {cat.name}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {!isEditMode && (
                  <p className="text-xs text-secondary-600 mt-1">
                    Si no seleccionas una categoría, se intentará asignar automáticamente según el nombre
                  </p>
                )}
              </div>

              {/* Alias Manager - show in edit mode or newly created */}
              {isEditMode && currentProduct && (
                <>
                  {isNewlyCreated && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                      <p className="text-sm text-blue-700">✓ Producto creado correctamente. Ahora puedes añadir aliases.</p>
                    </div>
                  )}
                  <AliasManager
                    productId={currentProduct.id}
                    aliases={currentProduct.aliases}
                    onUpdated={() => loadData()}
                  />
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors"
              >
                Cancelar
              </button>
              {isEditMode && (
                <button
                  onClick={handleDeleteProduct}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={isNewlyCreated ? closeModal : handleSaveProduct}
                disabled={!isEditMode && !newProduct.name.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isNewlyCreated ? 'Listo' : isEditMode ? 'Guardar' : 'Crear producto'}
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

