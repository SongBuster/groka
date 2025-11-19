import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { LogOut, Loader2 } from 'lucide-react'
import AuthForm from '../components/AuthForm'
import TicketUpload from '../components/TicketUpload'
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🛒 Groka</h1>
            <p className="text-gray-600">Tu lista de compra inteligente</p>
          </div>
          <AuthForm />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🛒 Groka</h1>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Subir nuevo ticket
            </h2>
            <TicketUpload onUploadComplete={loadTickets} />
          </div>

          {/* Tickets List */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Mis tickets
            </h2>
            {loadingTickets ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600">Aún no has subido ningún ticket</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {ticket.store_name || 'Tienda desconocida'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatDate(ticket.purchase_date)}
                        </p>
                        {ticket.ticket_number && (
                          <p className="text-xs text-gray-500">
                            #{ticket.ticket_number}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(ticket.total_amount)}
                        </p>
                        {ticket.parsed ? (
                          <span className="text-xs text-green-600">✓ Parseado</span>
                        ) : (
                          <span className="text-xs text-red-600">✗ Error</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
