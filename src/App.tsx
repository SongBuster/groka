import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import AuthForm from './components/AuthForm'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import TicketsPage from './pages/TicketsPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import ParserTrainerPage from './pages/ParserTrainerPage'
import { Loader2 } from 'lucide-react'

function AppContent() {
  const { user, loading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
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
