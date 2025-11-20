import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Loader2, Receipt } from 'lucide-react'
import ticketService from '../services/ticketService'
import { formatCurrency, formatDate } from '../lib/formatters'
import type { Database } from '../types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']

export default function TicketsPage() {
  const { user } = useAuthStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
          Mis Tickets
        </h1>
        <p className="text-secondary-600">
          Gestiona todos tus tickets de compra
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 font-medium">
          📄 Subir PDF
        </button>
        <button className="px-6 py-3 bg-white text-secondary-700 border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors font-medium">
          📸 Tomar foto
        </button>
        <button className="px-6 py-3 bg-white text-secondary-700 border border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors font-medium">
          ✍️ Entrada manual
        </button>
      </div>

      {/* Tickets List */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-secondary-900">
            Historial
          </h2>
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
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
            <div className="max-w-sm mx-auto px-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
                <Receipt className="w-10 h-10 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                No hay tickets todavía
              </h3>
              <p className="text-secondary-600 text-sm mb-6">
                Comienza subiendo tu primer ticket
              </p>
              <button className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 font-medium">
                Subir mi primer ticket
              </button>
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
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-secondary-900 text-base sm:text-lg truncate group-hover:text-primary-600 transition-colors">
                        {ticket.store_name || 'Tienda desconocida'}
                      </h3>
                      <p className="text-sm text-secondary-500 mt-1">
                        {formatDate(ticket.purchase_date)}
                      </p>
                    </div>
                    
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

                  <div className="border-t border-secondary-100"></div>

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
    </div>
  )
}
