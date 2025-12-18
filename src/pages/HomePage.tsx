import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { LogOut, Loader2 } from 'lucide-react'
import AuthForm from '../components/AuthForm'
import ticketService from '../services/ticketService'
import { formatCurrency, formatDate } from '../lib/formatters'
import type { Database } from '../types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']

export default function HomePage() {
  const { user, loading, signOut, initialize } = useAuthStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (user) {
      loadTickets()
    }
  }, [user])

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

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full">
          {/* Logo/Header for desktop - centered */}
          <div className="hidden lg:block text-center mb-12">
            <img 
              src="/icons/icon-192x192.png" 
              alt="Groka" 
              className="w-20 h-20 mx-auto mb-4 rounded-lg shadow-lg"
            />
            <h1 className="text-5xl xl:text-6xl font-bold text-primary-700 mb-3">
              Groka
            </h1>
            <p className="text-xl text-secondary-600">Tu lista de compra inteligente</p>
          </div>
          
          <AuthForm />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white border-b border-primary-200 sticky top-0 z-10 backdrop-blur-sm bg-white/95 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <img 
                src="/icons/icon-192x192.png" 
                alt="Groka" 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg shadow-lg"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-primary-700">Groka</h1>
                <p className="text-xs sm:text-sm text-secondary-600 hidden sm:block">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-secondary-700 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-secondary-900 mb-2">
            Bienvenido de nuevo 👋
          </h2>
          <p className="text-secondary-600 text-sm sm:text-base">
            Gestiona tus tickets y listas de compra
          </p>
        </div>

        {/* Removed upload section temporarily */}
        
        {/* Tickets List */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl sm:text-2xl font-semibold text-secondary-900">
              Mis tickets
            </h3>
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
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-300">
              <div className="max-w-sm mx-auto px-4">
                <div className="text-6xl mb-4">📝</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay tickets todavía
                </h4>
                <p className="text-gray-600 text-sm">
                  Los tickets que subas aparecerán aquí
                </p>
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
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-secondary-900 text-base sm:text-lg truncate group-hover:text-primary-600 transition-colors">
                          {ticket.store_name || 'Tienda desconocida'}
                        </h3>
                        <p className="text-sm text-secondary-500 mt-1">
                          {formatDate(ticket.purchase_date)}
                        </p>
                      </div>
                      
                      {/* Status Badge */}
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

                    {/* Divider */}
                    <div className="border-t border-gray-100"></div>

                    {/* Footer */}
                    <div className="flex justify-between items-end">
                      <div>
                        {ticket.ticket_number && (
                          <p className="text-xs text-secondary-500 mb-1">
                            Ticket #{ticket.ticket_number}
                          </p>
                        )}
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
      </main>
    </div>
  )
}
