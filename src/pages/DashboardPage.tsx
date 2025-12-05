import { ShoppingCart, Package, Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ tickets: 0, products: 0, lists: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    const loadStats = async () => {
      try {
        // Get ticket count for user
        const { count: ticketCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        // Get all products count (products are global)
        const { count: productCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })

        // Get active shopping lists for user (using owner_id and is_active)
        const { data: lists } = await supabase
          .from('shopping_lists')
          .select('id')
          .eq('owner_id', user.id)
          .eq('is_active', true)

        setStats({
          tickets: ticketCount || 0,
          products: productCount || 0,
          lists: lists?.length || 0
        })
      } catch (error) {
        console.error('Error loading dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [user?.id])

  const sections = [
    {
      id: 'tickets',
      title: 'Tickets',
      description: 'Sube y gestiona tus tickets de compra',
      icon: Receipt,
      color: 'primary',
      path: '/tickets',
      features: ['Subir PDF o foto', 'Entrada manual', 'Historial completo']
    },
    {
      id: 'products',
      title: 'Productos',
      description: 'Organiza tus productos y categorías',
      icon: Package,
      color: 'blue',
      path: '/products',
      features: ['Gestionar productos', 'Crear categorías', 'Análisis de precios']
    },
    {
      id: 'lists',
      title: 'Listas de la Compra',
      description: 'Crea y comparte listas con tu familia',
      icon: ShoppingCart,
      color: 'green',
      path: '/lists',
      features: ['Crear listas', 'Compartir', 'Colaborar en tiempo real']
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-500 rounded-2xl mb-6 shadow-lg shadow-primary-500/30">
            <span className="text-4xl">🛒</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-secondary-900 mb-4">
            Bienvenido a Groka
          </h1>
          <p className="text-lg sm:text-xl text-secondary-600 max-w-2xl mx-auto">
            Tu asistente inteligente para gestionar compras, productos y listas compartidas
          </p>
        </div>

        {/* Main Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.id}
                to={section.path}
                className="group bg-white rounded-2xl shadow-md border border-secondary-200 hover:shadow-2xl hover:border-primary-400 transition-all duration-300 overflow-hidden"
              >
                <div className="p-6 sm:p-8">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-xl mb-6 group-hover:bg-primary-500 group-hover:scale-110 transition-all duration-300 shadow-sm">
                    <Icon className="w-8 h-8 text-primary-600 group-hover:text-white transition-colors" />
                  </div>

                  {/* Title & Description */}
                  <h2 className="text-2xl font-bold text-secondary-900 mb-3 group-hover:text-primary-600 transition-colors">
                    {section.title}
                  </h2>
                  <p className="text-secondary-600 mb-6">
                    {section.description}
                  </p>

                  {/* Features List */}
                  <ul className="space-y-2">
                    {section.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-secondary-700">
                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Hover Effect Bottom Bar */}
                <div className="h-2 bg-gradient-to-r from-primary-500 to-primary-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              </Link>
            )
          })}
        </div>

        {/* Quick Stats or Info */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-primary-100">
            <div className="text-3xl font-bold text-primary-600 mb-1">
              {loading ? '-' : stats.tickets}
            </div>
            <div className="text-sm text-secondary-600">Tickets guardados</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-primary-100">
            <div className="text-3xl font-bold text-primary-600 mb-1">
              {loading ? '-' : stats.products}
            </div>
            <div className="text-sm text-secondary-600">Productos registrados</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-primary-100">
            <div className="text-3xl font-bold text-primary-600 mb-1">
              {loading ? '-' : stats.lists}
            </div>
            <div className="text-sm text-secondary-600">Listas activas</div>
          </div>
        </div>
      </div>
    </div>
  )
}
