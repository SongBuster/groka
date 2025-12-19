import { useEffect, useRef } from 'react'
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
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function AppContent() {
  const { user, loading, initialize } = useAuthStore()
  const navigate = useNavigate()
  const prevUser = useRef<typeof user>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

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
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="shopping-lists" element={<ShoppingListsPage />} />
        <Route path="shopping-lists/:id" element={<ShoppingListDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="parser-trainer" element={<ParserTrainerPage />} />
      </Route>
    </Routes>
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
