import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Loader2, Plus, ShoppingCart, Trash2, Edit2, Check, Calendar, ChevronRight } from 'lucide-react'
import shoppingListService from '../services/shoppingListService'
import supermarketService from '../services/supermarketService'
import { useDialog } from '../hooks/useDialog'
import CustomSelect from '../components/CustomSelect'
import type { Database } from '../types/database'

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row']
type Supermarket = Database['public']['Tables']['supermarkets']['Row']

export default function ShoppingListsPage() {
  const { user } = useAuthStore()
  const { alert, confirm, DialogComponent } = useDialog()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingList, setEditingList] = useState<ShoppingList | null>(null)
  const [filterSupermarket, setFilterSupermarket] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('active')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    supermarketId: '',
    description: ''
  })

  useEffect(() => {
    if (user) {
      loadLists()
      loadSupermarkets()
    }
  }, [user])

  const loadLists = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const data = await shoppingListService.getUserLists(user.id)
      setLists(data)
    } catch (error) {
      console.error('Error loading lists:', error)
      await alert({
        title: 'Error',
        message: 'No se pudieron cargar las listas',
        type: 'error'
      })
    } finally {
      setLoading(false)
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

  const handleCreateList = () => {
    setEditingList(null)
    setFormData({
      name: '',
      supermarketId: '',
      description: ''
    })
    setShowCreateModal(true)
  }

  const handleEditList = (list: ShoppingList) => {
    setEditingList(list)
    setFormData({
      name: list.name,
      supermarketId: list.supermarket_id || '',
      description: list.description || ''
    })
    setShowCreateModal(true)
  }

  const handleSaveList = async () => {
    if (!user) return

    if (!formData.name.trim()) {
      await alert({
        title: 'Campo requerido',
        message: 'Por favor, introduce un nombre para la lista',
        type: 'warning'
      })
      return
    }

    if (!formData.supermarketId) {
      await alert({
        title: 'Campo requerido',
        message: 'Por favor, selecciona un supermercado',
        type: 'warning'
      })
      return
    }

    try {
      if (editingList) {
        // Update existing list
        await shoppingListService.updateList(editingList.id, {
          name: formData.name,
          supermarket_id: formData.supermarketId,
          description: formData.description || null
        })
      } else {
        // Create new list
        await shoppingListService.createList(
          user.id,
          formData.name,
          formData.supermarketId,
          formData.description
        )
      }

      await loadLists()
      setShowCreateModal(false)
      setFormData({ name: '', supermarketId: '', description: '' })
    } catch (error) {
      console.error('Error saving list:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo guardar la lista',
        type: 'error'
      })
    }
  }

  const handleDeleteList = async (listId: string, listName: string) => {
    const confirmed = await confirm({
      title: '¿Eliminar lista?',
      message: `¿Estás seguro de que quieres eliminar la lista "${listName}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'error'
    })

    if (!confirmed) return

    try {
      await shoppingListService.deleteList(listId)
      await loadLists()
    } catch (error) {
      console.error('Error deleting list:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo eliminar la lista',
        type: 'error'
      })
    }
  }

  const handleCompleteList = async (listId: string, listName: string) => {
    const confirmed = await confirm({
      title: '¿Marcar como completada?',
      message: `¿Quieres marcar la lista "${listName}" como completada?`,
      confirmText: 'Completar',
      cancelText: 'Cancelar',
      type: 'warning'
    })

    if (!confirmed) return

    try {
      await shoppingListService.completeList(listId)
      await loadLists()
    } catch (error) {
      console.error('Error completing list:', error)
      await alert({
        title: 'Error',
        message: 'No se pudo completar la lista',
        type: 'error'
      })
    }
  }

  // Filter lists
  const filteredLists = lists.filter(list => {
    if (filterStatus === 'active' && !list.is_active) return false
    if (filterStatus === 'completed' && list.is_active) return false
    if (filterSupermarket && list.supermarket_id !== filterSupermarket) return false
    return true
  })


  const getSupermarket = (supermarketId: string | null) => {
    if (!supermarketId) return null
    return supermarkets.find(sm => sm.id === supermarketId)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <DialogComponent />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
            🛒 Listas de la Compra
          </h1>
          <p className="text-secondary-600">
            Organiza tus compras por supermercado
          </p>
        </div>
        <button
          onClick={handleCreateList}
          className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Nueva Lista
        </button>
      </div>

      {/* Filters - Temporarily hidden */}
      {false && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Estado
              </label>
              <CustomSelect
                options={[
                  { value: 'active', label: 'Activas' },
                  { value: 'completed', label: 'Completadas' },
                  { value: 'all', label: 'Todas' }
                ]}
                value={filterStatus}
                onChange={setFilterStatus}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Supermercado
              </label>
              <CustomSelect
                options={[
                  { value: '', label: 'Todos los supermercados' },
                  ...supermarkets.map(sm => ({
                    value: sm.id,
                    label: sm.name
                  }))
                ]}
                value={filterSupermarket}
                onChange={setFilterSupermarket}
                placeholder="Todos los supermercados"
              />
            </div>
          </div>
        </div>
      )}

      {/* Lists Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
          <p className="text-secondary-600">Cargando listas...</p>
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
          <div className="max-w-sm mx-auto px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
              <ShoppingCart className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              {lists.length === 0 ? 'No hay listas todavía' : 'No hay listas con estos filtros'}
            </h3>
            <p className="text-secondary-600 text-sm mb-6">
              {lists.length === 0 
                ? 'Crea tu primera lista de la compra para empezar a organizar tus compras'
                : 'Intenta ajustar los filtros para ver más resultados'}
            </p>
            {lists.length === 0 && (
              <button
                onClick={handleCreateList}
                className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crear Primera Lista
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLists.map((list) => {
            const supermarket = getSupermarket(list.supermarket_id)
            return (
              <div
                key={list.id}
                className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 hover:shadow-xl hover:border-primary-400 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex flex-col gap-4">
                  {/* Header with supermarket */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {supermarket && (
                        <div className="flex items-center gap-2 mb-2">
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
                      )}
                      <h3 className="font-bold text-secondary-900 text-lg truncate group-hover:text-primary-600 transition-colors">
                        {list.name}
                      </h3>
                      {list.description && (
                        <p className="text-sm text-secondary-500 mt-1 line-clamp-2">
                          {list.description}
                        </p>
                      )}
                    </div>
                    {list.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full flex-shrink-0">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary-600 bg-secondary-100 px-2 py-1 rounded-full flex-shrink-0">
                        <Check className="w-3 h-3" />
                        Completada
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-xs text-secondary-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(list.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-secondary-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // Navigate to list details (we'll implement this next)
                        window.location.href = `/lists/${list.id}`
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                    >
                      Ver lista
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditList(list)
                      }}
                      className="px-3 py-2 bg-secondary-50 text-secondary-700 rounded-lg hover:bg-secondary-100 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {list.is_active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCompleteList(list.id, list.name)
                        }}
                        className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        title="Completar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteList(list.id, list.name)
                      }}
                      className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-secondary-900 mb-6">
              {editingList ? 'Editar Lista' : 'Nueva Lista'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Compra semanal"
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>

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
                  value={formData.supermarketId}
                  onChange={(value) => setFormData({ ...formData, supermarketId: value })}
                  placeholder="Selecciona un supermercado"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Añade una descripción..."
                  rows={3}
                  className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveList}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                {editingList ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
