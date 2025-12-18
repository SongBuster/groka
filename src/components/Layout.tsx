import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useProductsCount } from '../hooks/useProductsCount'
import SessionExpiredHandler from './SessionExpiredHandler'
import { LogOut, Home, Receipt, Package } from 'lucide-react'
import { VERSION_INFO } from '../version'

export default function Layout() {
  const { user, signOut } = useAuthStore()
  const location = useLocation()
  const { count: productsNeedingAttention } = useProductsCount()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const navigation = [
    { name: 'Inicio', path: '/dashboard', icon: Home },
    { name: 'Tickets', path: '/tickets', icon: Receipt },
    { name: 'Productos', path: '/products', icon: Package },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white border-b border-primary-200 sticky top-0 z-10 backdrop-blur-sm bg-white/95 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img 
                src="/icons/icon-192x192.png" 
                alt="Groka" 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg shadow-lg"
              />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-primary-700">Groka</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-secondary-600 truncate max-w-[150px] sm:max-w-none">{user?.email}</p>
                  <span
                    title={`Version ${VERSION_INFO.version}`}
                    className="text-[10px] text-secondary-500 bg-white/60 border border-primary-100 px-2 py-0.5 rounded-full shadow-sm hidden sm:inline"
                  >
                    {VERSION_INFO.version}
                  </span>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const showBadge = item.path === '/products' && productsNeedingAttention > 0
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium relative ${
                      isActive(item.path)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-secondary-700 hover:bg-primary-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-600 text-white text-xs font-bold rounded-full">
                        {productsNeedingAttention}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Dev Tools */}
            {import.meta.env.DEV && (
              <Link
                to="/parser-trainer"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-sm"
                title="Parser Trainer (Dev)"
              >
                🔬
              </Link>
            )}

            {/* Sign Out Button */}
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
      <main>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-primary-200 shadow-lg z-10">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const showBadge = item.path === '/products' && productsNeedingAttention > 0
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors relative ${
                  isActive(item.path)
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-600 hover:bg-primary-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
                {showBadge && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full">
                    {productsNeedingAttention}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Spacer for mobile navigation */}
      <div className="md:hidden h-20"></div>
      
      {/* Session expired handler */}
      <SessionExpiredHandler />
    </div>
  )
}
