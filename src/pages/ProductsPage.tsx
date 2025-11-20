import { useState, useEffect } from 'react'
import { Search, CheckCircle, AlertCircle, Clock, Edit2, Plus } from 'lucide-react'
import productService, { type ProductWithCategory } from '../services/productService'
import categoryService from '../services/categoryService'
import type { Database } from '../types/database'
import { useAuthStore } from '../stores/authStore'

type Category = Database['public']['Tables']['categories']['Row']
type ReviewStatus = 'pending' | 'uncategorized' | 'reviewed' | 'all'

export default function ProductsPage() {
  const { user } = useAuthStore()
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReviewStatus>('all')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '',
    alias: '',
    category_id: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productsData, categoriesData] = await Promise.all([
        productService.getAll(),
        categoryService.getAll()
      ])
      setProducts(productsData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return

    try {
      await productService.update(
        editingProduct.id,
        {
          alias: editingProduct.alias,
          category_id: editingProduct.category_id,
        },
        user?.id
      )
      await loadData()
      setShowEditModal(false)
      setEditingProduct(null)
    } catch (error) {
      console.error('Error updating product:', error)
    }
  }

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) return

    try {
      await productService.create({
        name: newProduct.name.trim(),
        alias: newProduct.alias.trim() || null,
        category_id: newProduct.category_id || null,
      })
      await loadData()
      setShowCreateModal(false)
      setNewProduct({ name: '', alias: '', category_id: '' })
    } catch (error) {
      console.error('Error creating product:', error)
      alert('Error al crear el producto. Puede que ya exista.')
    }
  }

  const filteredProducts = products.filter(product => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = product.name.toLowerCase().includes(query)
      const matchesAlias = product.alias?.toLowerCase().includes(query)
      if (!matchesName && !matchesAlias) return false
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
            onClick={() => setShowCreateModal(true)}
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
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-secondary-200">
          <div className="text-2xl font-bold text-secondary-900">{stats.total}</div>
          <div className="text-sm text-secondary-600">Total productos</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-primary-200">
          <div className="text-2xl font-bold text-primary-600">{stats.reviewed}</div>
          <div className="text-sm text-secondary-600">Revisados</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-secondary-200">
          <div className="text-2xl font-bold text-secondary-600">{stats.pending}</div>
          <div className="text-sm text-secondary-600">Pendientes</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-600">{stats.uncategorized}</div>
          <div className="text-sm text-secondary-600">Sin categoría</div>
        </div>
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
                className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReviewStatus)}
            className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="reviewed">Revisados</option>
            <option value="pending">Pendientes</option>
            <option value="uncategorized">Sin categoría</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
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
      ) : (
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
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
                    Alias
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
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-secondary-50 transition-colors">
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
                      <div className="text-sm text-secondary-600">
                        {product.alias || '-'}
                      </div>
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
                      <button
                        onClick={() => {
                          setEditingProduct(product)
                          setShowEditModal(true)
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-secondary-900 mb-4">
              Editar Producto
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Nombre original
                </label>
                <input
                  type="text"
                  value={editingProduct.name}
                  disabled
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg bg-secondary-50 text-secondary-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Alias (nombre para listas)
                </label>
                <input
                  type="text"
                  value={editingProduct.alias || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, alias: e.target.value })}
                  placeholder="Ej: Cerveza 0 Tostada"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Categoría
                </label>
                <select
                  value={editingProduct.category_id || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value || null })}
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingProduct(null)
                }}
                className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-secondary-900 mb-4">
              Nuevo Producto
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Ej: Cerveza 0,0 Tostada Pack-6"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Alias (nombre para listas)
                </label>
                <input
                  type="text"
                  value={newProduct.alias}
                  onChange={(e) => setNewProduct({ ...newProduct, alias: e.target.value })}
                  placeholder="Ej: Cerveza 0 Tostada"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-secondary-600 mt-1">
                  Este será el nombre que aparecerá en las listas de la compra
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Categoría
                </label>
                <select
                  value={newProduct.category_id}
                  onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Sin categoría (se asignará automáticamente)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-secondary-600 mt-1">
                  Si no seleccionas una categoría, se intentará asignar automáticamente según el nombre
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewProduct({ name: '', alias: '', category_id: '' })
                }}
                className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProduct}
                disabled={!newProduct.name.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
