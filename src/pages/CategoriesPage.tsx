import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import categoryService from '../services/categoryService'
import type { Database } from '../types/database'

type Category = Database['public']['Tables']['categories']['Row']

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#22c55e',
    keywords: [] as string[],
  })
  const [keywordInput, setKeywordInput] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const data = await categoryService.getAll()
      setCategories(data)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '',
        color: category.color || '#22c55e',
        keywords: category.keywords || [],
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: '',
        description: '',
        icon: '',
        color: '#22c55e',
        keywords: [],
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setKeywordInput('')
  }

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim().toLowerCase())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim().toLowerCase()],
      })
      setKeywordInput('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword),
    })
  }

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, formData)
      } else {
        await categoryService.create(formData)
      }
      await loadCategories()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Error al guardar la categoría')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar la categoría "${name}"?`)) {
      try {
        await categoryService.delete(id)
        await loadCategories()
      } catch (error) {
        console.error('Error deleting category:', error)
        alert('Error al eliminar la categoría. Puede que tenga productos asociados.')
      }
    }
  }

  const emojiPresets = [
    // Frutas y Verduras
    '🥬', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑', '🥝', '🍅', '🥕', '🥔', '🥦', '🌽', '🫑', '🥒',
    // Carnes y Pescados
    '🥩', '🍗', '🍖', '🥓', '🍤', '🦐', '🦞', '🐟', '🐠', '🦀', '🦑',
    // Lácteos y Huevos
    '🥛', '🧀', '🧈', '🥚',
    // Pan y Bollería
    '🍞', '🥐', '🥖', '🥯', '🧁', '🎂', '🍰',
    // Bebidas
    '🥤', '☕', '🍵', '🧃', '🧋', '🍺', '🍻', '🍷', '🥂', '🍾', '🧊',
    // Despensa
    '🥫', '🌾', '🍚', '🍝', '🫘', '🫙',
    // Congelados
    '❄️', '🍦', '🧊',
    // Limpieza e Higiene
    '🧹', '🧽', '🧴', '🧼', '🧻', '🪥', '💊', '💉',
    // Snacks y Dulces
    '🍿', '🍫', '🍬', '🍭', '🍪', '🥨', '🍩', '🍮',
    // Bebé y Mascotas
    '🍼', '🐕', '🐈', '🐾',
    // Otros
    '📦', '🛒', '🏪', '🎁', '⭐', '✨', '🔥', '💚', '💙', '❤️'
  ]
  const colorPresets = ['#22c55e', '#ef4444', '#f59e0b', '#d97706', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899', '#f97316', '#6b7280', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899']

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
            Categorías
          </h1>
          <p className="text-secondary-600">
            Gestiona las categorías para organizar tus productos
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nueva Categoría</span>
        </button>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-secondary-600">Cargando categorías...</div>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">
            No hay categorías
          </h3>
          <p className="text-secondary-600 text-sm mb-6">
            Crea tu primera categoría para organizar tus productos
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
          >
            <Plus className="w-5 h-5" />
            Crear primera categoría
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-xl p-6 border border-secondary-200 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ backgroundColor: (category.color || '#6b7280') + '20' }}
                  >
                    {category.icon || '📦'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-secondary-900">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-secondary-600 mt-1">{category.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Keywords */}
              {category.keywords && category.keywords.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-secondary-700 mb-2">Palabras clave:</div>
                  <div className="flex flex-wrap gap-1">
                    {category.keywords.slice(0, 5).map((keyword, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-secondary-100 text-secondary-700 rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                    {category.keywords.length > 5 && (
                      <span className="text-xs px-2 py-1 text-secondary-500">
                        +{category.keywords.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-secondary-100">
                <button
                  onClick={() => handleOpenModal(category)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(category.id, category.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-secondary-900">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Frutas y Verduras"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Productos frescos"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Icono (emoji)
                </label>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🥬"
                    className="w-20 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl"
                    maxLength={2}
                  />
                  <div className="flex-1">
                    <span className="text-sm text-secondary-600">Escribe o pega cualquier emoji, o selecciona uno:</span>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      Tip: En Mac presiona <kbd className="px-1.5 py-0.5 bg-secondary-100 rounded text-xs">⌘ Ctrl Espacio</kbd> para el selector de emojis
                    </p>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto border border-secondary-200 rounded-lg p-2 bg-secondary-50">
                  <div className="flex flex-wrap gap-1">
                    {emojiPresets.map((emoji, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl hover:bg-white transition-colors ${
                          formData.icon === emoji ? 'bg-primary-100 ring-2 ring-primary-500' : 'bg-white'
                        }`}
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Color
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 rounded-lg border border-secondary-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="#22c55e"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-secondary-900' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Palabras clave (para auto-categorización)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                    placeholder="Escribe una palabra y presiona Enter"
                    className="flex-1 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddKeyword}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {formData.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="hover:bg-primary-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-secondary-600 mt-2">
                  Las palabras clave se usarán para categorizar automáticamente los productos cuando se detecten en su nombre.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-secondary-200">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
