import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, RefreshCcw } from 'lucide-react'
import categoryService from '../services/categoryService'
import catalogService from '../services/catalogService'
import { useDialog } from '../hooks/useDialog'
import type { Database } from '../types/database'
import { useAuthStore } from '../stores/authStore'

type Category = Database['public']['Tables']['categories']['Row']

export default function CategoriesPage() {
  const { alert, confirm, DialogComponent } = useDialog()
  const { user } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [replacingWithGlobal, setReplacingWithGlobal] = useState(false)
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
      if (!user?.id) return
      const data = await categoryService.getAll(user.id)
      setCategories(data)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
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
      await loadCategories()
      await alert({
        title: 'Catálogo reemplazado',
        message: 'Se ha reemplazado tu catálogo por el global.',
        type: 'success'
      })
    } catch (e) {
      console.error('Global replace failed', e)
      await alert({
        title: 'Error',
        message: 'No se pudo reemplazar tu catálogo. Inténtalo de nuevo.',
        type: 'error'
      })
    } finally {
      setReplacingWithGlobal(false)
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
    if (!keywordInput.trim()) return

    // Separar por comas, limpiar espacios y convertir a minúsculas
    const newKeywords = keywordInput
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k && !formData.keywords.includes(k))

    if (newKeywords.length > 0) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, ...newKeywords],
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

  const handleSave = async (closeModal: boolean = true) => {
    try {
      if (!user?.id) return
      if (editingCategory) {
        await categoryService.update(editingCategory.id, formData, user.id)
        await loadCategories()
        handleCloseModal()
      } else {
        await categoryService.create(formData, user.id)
        await loadCategories()
        if (closeModal) {
          handleCloseModal()
        } else {
          // Limpiar formulario pero mantener modal abierto para crear otra
          setFormData({
            name: '',
            description: '',
            icon: '',
            color: '#22c55e',
            keywords: [],
          })
          setKeywordInput('')
        }
      }
    } catch (error) {
      console.error('Error saving category:', error)
      alert({
        title: 'Error',
        message: 'No se pudo guardar la categoría. Inténtalo de nuevo.',
        type: 'error'
      })
    }
  }

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: 'Eliminar categoría',
      message: `¿Estás seguro de eliminar la categoría "${name}"?\n\nEsta acción no se puede deshacer.`,
      type: 'error',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    })

    if (!confirmed) return

    try {
      if (!user?.id) return
      await categoryService.delete(id, user.id)
      await loadCategories()
      await alert({
        title: 'Categoría eliminada',
        message: 'La categoría se ha eliminado correctamente',
        type: 'success'
      })
    } catch (error) {
      console.error('Error deleting category:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo eliminar la categoría. Puede que tenga productos asociados.',
        type: 'error'
      })
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
            Categorías
          </h1>
          <p className="text-secondary-600">
            Gestiona las categorías para organizar tus productos
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/products"
            className="flex items-center gap-2 px-4 py-2 text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <span className="text-sm font-medium">Productos</span>
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

      {/* Categories Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-secondary-600">Cargando categorías...</div>
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

          {/* Card to create new category - always at the end */}
          <button
            onClick={() => handleOpenModal()}
            className="bg-white rounded-xl p-6 border-2 border-dashed border-primary-300 hover:border-primary-500 hover:bg-primary-50 transition-all group"
          >
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 group-hover:bg-primary-200 flex items-center justify-center mb-4 transition-colors">
                <Plus className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="font-semibold text-primary-700 text-lg mb-2">
                Nueva Categoría
              </h3>
              <p className="text-sm text-secondary-600">
                Haz clic para crear una nueva categoría
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6">
            <div className="flex justify-between items-center mb-4">
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

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
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
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-secondary-900 placeholder:text-secondary-400 dark:bg-secondary-900 dark:text-secondary-100 dark:border-secondary-700"
                  required
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Icono (emoji)
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🥬"
                    className="w-16 px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl bg-white text-secondary-900 placeholder:text-secondary-400 dark:bg-secondary-900 dark:text-secondary-100 dark:border-secondary-700"
                    maxLength={2}
                  />
                  <span className="text-sm text-secondary-600">Escribe o selecciona:</span>
                </div>
                <div className="max-h-32 overflow-y-auto border border-secondary-200 rounded-lg p-1.5 bg-secondary-50">
                  <div className="flex flex-wrap gap-0.5">
                    {emojiPresets.map((emoji, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className={`w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-white transition-colors ${
                          formData.icon === emoji ? 'bg-primary-100 ring-1 ring-primary-500' : 'bg-white'
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
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-20 rounded-lg border border-secondary-300 cursor-pointer"
                    title="Haz clic para elegir un color"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => {
                        const value = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                          setFormData({ ...formData, color: value })
                        }
                      }}
                      className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono bg-white text-secondary-900 placeholder:text-secondary-400 dark:bg-secondary-900 dark:text-secondary-100 dark:border-secondary-700"
                      placeholder="#22c55e"
                    />
                    <p className="text-xs text-secondary-600 mt-1">
                      Haz clic en el cuadrado de color para abrir el selector
                    </p>
                  </div>
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
                    className="flex-1 px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-secondary-900 placeholder:text-secondary-400 dark:bg-secondary-900 dark:text-secondary-100 dark:border-secondary-700"
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
            <div className="flex gap-3 mt-4 pt-4 border-t border-secondary-200">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors"
              >
                Cancelar
              </button>
              {editingCategory ? (
                <button
                  onClick={() => handleSave(true)}
                  disabled={!formData.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  Guardar cambios
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={!formData.name.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    Guardar
                  </button>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={!formData.name.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-5 h-5" />
                    Guardar y nuevo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialog Component */}
      <DialogComponent />
    </div>
  )
}
