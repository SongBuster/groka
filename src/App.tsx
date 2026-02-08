import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import AuthForm from './components/AuthForm'
import Layout from './components/Layout'
import TicketsPage from './pages/TicketsPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import ParserTrainerPage from './pages/ParserTrainerPage'
import ShoppingListsPage from './pages/ShoppingListsPage'
import ShoppingListDetailPage from './pages/ShoppingListDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppHelpModal from './components/AppHelpModal'

function AppContent() {
  const { user, loading, initialize } = useAuthStore()
  const navigate = useNavigate()
  const prevUser = useRef<typeof user>(null)
  const [showGuestHelp, setShowGuestHelp] = useState(false)
  const [showUserHelp, setShowUserHelp] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (loading) return
    if (!user) {
      const guestKey = 'help-guest-dismissed'
      const dismissed = localStorage.getItem(guestKey) === '1'
      setShowGuestHelp(!dismissed)
      setShowUserHelp(false)
      return
    }

    const userKey = `help-onboarding-shown:${user.id}`
    const seen = localStorage.getItem(userKey) === '1'
    setShowUserHelp(!seen)
    setShowGuestHelp(false)
  }, [user, loading])

  // After successful login (or on reload with existing session), redirect to tickets once
  useEffect(() => {
    if (loading) return
    if (user && !prevUser.current) {
      navigate('/tickets', { replace: true })
    }
    prevUser.current = user
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full">
          <div className="hidden lg:block text-center mb-12">
            <h1 className="text-5xl xl:text-6xl font-bold text-primary-700 mb-3">
              🛒 Groka
            </h1>
            <p className="text-xl text-secondary-600">Tu lista de compra inteligente</p>
          </div>
          <AuthForm />
        </div>

        <AppHelpModal
          open={showGuestHelp}
          title="¿Qué puedes hacer con Groka?"
          description="Una app para organizar compras y entender tus hábitos."
          bullets={[
            'Sube tickets PDF y guarda un historial de compras.',
            'Crea listas de compra inteligentes basadas en tu historial.',
            'Gestiona productos y categorías con aliases.',
            'Consulta precios y frecuencia de compra por producto.'
          ]}
          primaryLabel="Entendido"
          onClose={() => {
            try { localStorage.setItem('help-guest-dismissed', '1') } catch {}
            setShowGuestHelp(false)
          }}
        />
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/tickets" replace />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="shopping-lists" element={<ShoppingListsPage />} />
          <Route path="shopping-lists/:id" element={<ShoppingListDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="parser-trainer" element={<ParserTrainerPage />} />
        </Route>
      </Routes>

      <AppHelpModal
        open={showUserHelp}
        title="¡Bienvenido a Groka!"
        description="Guía rápida para empezar con tu cuenta."
        bullets={[
          'Sube tu primer ticket en la pestaña Tickets.',
          'Revisa Productos y añade aliases para mejorar sugerencias.',
          'Crea una lista en Listas y marca lo comprado.',
          'Consulta precios y estadísticas en cada producto.'
        ]}
        primaryLabel="Empezar"
        onClose={() => {
          if (user?.id) {
            try { localStorage.setItem(`help-onboarding-shown:${user.id}`, '1') } catch {}
          }
          setShowUserHelp(false)
        }}
      />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
