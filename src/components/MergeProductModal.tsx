import { useState, useEffect } from 'react'
import { X, Link2, Search } from 'lucide-react'
import productService, { type ProductWithCategory } from '../services/productService'
import { useAuthStore } from '../stores/authStore'

interface MergeProductModalProps {
  product: ProductWithCategory
  onClose: () => void
  onMerge: () => void
}

export default function MergeProductModal({ product, onClose, onMerge }: MergeProductModalProps) {
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductWithCategory[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null)
  const [newAlias, setNewAlias] = useState(product.name)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchProducts()
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const searchProducts = async () => {
    setLoading(true)
    try {
      if (!user?.id) return
      const results = await productService.searchProductsWithPriority(searchQuery, user.id)
      // Filter out the current product
      setSearchResults(results.filter(p => p.id !== product.id))
    } catch (err) {
      setError('Error buscando productos')
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async () => {
    if (!selectedProduct || !newAlias.trim()) return

    setLoading(true)
    try {
      // Add the current product name as an alias to the selected product
      if (!user?.id) return
      await productService.addAlias(selectedProduct.id, newAlias.trim(), user.id)
      onMerge()
    } catch (err) {
      setError('Error al asignar el alias')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-primary-600" />
              <h3 className="text-xl font-bold text-secondary-900">Asignar a producto existente</h3>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-secondary-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Product Info */}
          <div className="bg-secondary-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-secondary-600 mb-1">Producto a asignar:</div>
            <div className="font-semibold text-secondary-900">{product.name}</div>
            {product.category && (
              <div className="text-xs text-secondary-500 mt-1">{product.category.name}</div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Search Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Buscar producto existente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o alias..."
                className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Resultados ({searchResults.length})
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      setSelectedProduct(result)
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedProduct?.id === result.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-secondary-200 hover:border-secondary-300'
                    }`}
                  >
                    <div className="font-medium text-secondary-900">{result.name}</div>
                    {result.aliases && result.aliases.length > 0 && (
                      <div className="text-xs text-secondary-500 mt-1">
                        Aliases: {result.aliases.join(', ')}
                      </div>
                    )}
                    {result.category && (
                      <div className="text-xs text-primary-600 mt-1">{result.category.name}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Product Display */}
          {selectedProduct && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Asignado a:
              </label>
              <div className="bg-primary-50 border-2 border-primary-500 rounded-lg p-4">
                <div className="font-semibold text-primary-900">{selectedProduct.name}</div>
                <div className="text-xs text-primary-700 mt-2">
                  Se añadirá "{newAlias}" como alias a este producto
                </div>
              </div>
            </div>
          )}

          {/* New Alias Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Alias a añadir
            </label>
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Nombre del alias"
              className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-secondary-500 mt-1">
              Este nombre será utilizado para futuras búsquedas
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleMerge}
              disabled={!selectedProduct || !newAlias.trim() || loading}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Asignando...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Asignar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
