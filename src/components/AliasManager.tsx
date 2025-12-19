import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import productService from '../services/productService'
import { useAuthStore } from '../stores/authStore'

interface AliasManagerProps {
  productId: string
  aliases: string[] | null
  onUpdated: () => void
}

export default function AliasManager({ productId, aliases: initialAliases, onUpdated }: AliasManagerProps) {
  const { user } = useAuthStore()
  const [aliases, setAliases] = useState<string[]>(initialAliases || [])
  const [newAlias, setNewAlias] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return

    setLoading(true)
    setError(null)
    try {
      if (!user?.id) return
      await productService.addAlias(productId, newAlias.trim(), user.id)
      setAliases([...aliases, newAlias.trim()])
      setNewAlias('')
      onUpdated()
    } catch (err) {
      setError('Error añadiendo alias')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAlias = async (aliasToRemove: string) => {
    setLoading(true)
    setError(null)
    try {
      if (!user?.id) return
      await productService.removeAlias(productId, aliasToRemove, user.id)
      setAliases(aliases.filter(a => a !== aliasToRemove))
      onUpdated()
    } catch (err) {
      setError('Error removiendo alias')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-secondary-700">
        Aliases (nombres alternativos)
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Current Aliases */}
      {aliases.length > 0 && (
        <div className="space-y-2">
          {aliases.map((alias) => (
            <div
              key={alias}
              className="flex items-center justify-between px-3 py-2 bg-secondary-50 rounded-lg group"
            >
              <span className="text-sm text-secondary-700">{alias}</span>
              <button
                onClick={() => handleRemoveAlias(alias)}
                disabled={loading}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Alias */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleAddAlias()
          }}
          placeholder="Añadir nuevo alias..."
          className="flex-1 px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          onClick={handleAddAlias}
          disabled={!newAlias.trim() || loading}
          className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Añadir</span>
        </button>
      </div>

      <p className="text-xs text-secondary-500">
        Los aliases ayudan a encontrar el producto al buscar en la lista de compra
      </p>
    </div>
  )
}
