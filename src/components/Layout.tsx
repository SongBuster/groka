import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useProductsCount } from '../hooks/useProductsCount'
import SessionExpiredHandler from './SessionExpiredHandler'
import { LogOut, Receipt, Package, ShoppingCart } from 'lucide-react'
import { VERSION_INFO } from '../version'
import { useEffect } from 'react'
import { useDialog } from '../hooks/useDialog'
import catalogService from '../services/catalogService'

export default function Layout() {
  const { user, signOut } = useAuthStore()
  const location = useLocation()
  const { count: productsNeedingAttention } = useProductsCount()
  const { alert, confirm, DialogComponent } = useDialog()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const navigation = [
    { name: 'Tickets', path: '/tickets', icon: Receipt },
    { name: 'Productos', path: '/products', icon: Package },
    { name: 'Listas', path: '/shopping-lists', icon: ShoppingCart },
  ]

  const isActive = (path: string) => location.pathname === path

  // Post-signup prompt to import global catalog once
  useEffect(() => {
    if (!user?.id) return
    const key = `post-signup-import-prompt:${user.id}`
    const shouldPrompt = localStorage.getItem(key) === '1'
    if (!shouldPrompt) return

    const alreadyAskedKey = `global-import-prompt-shown:${user.id}`
    const alreadyAsked = localStorage.getItem(alreadyAskedKey) === '1'

    const run = async () => {
      const accepted = await confirm({
        title: 'Importar catálogo global',
        message:
          '¿Quieres importar ahora el catálogo global recomendado?\n\nEsto reemplazará tus productos y categorías actuales (si los hubiera). Los aliases no se incluyen.',
        type: 'warning',
        confirmText: 'Importar ahora',
        cancelText: 'No, gracias'
      })
      try {
        localStorage.setItem(alreadyAskedKey, '1')
        localStorage.removeItem(key)
      } catch {}
      if (!accepted) return
      try {
        await catalogService.replaceUserCatalogWithGlobal()
        await alert({
          title: 'Catálogo importado',
          message: 'Se ha importado el catálogo global correctamente.',
          type: 'success'
        })
      } catch (e) {
        console.error('Global import failed', e)
        await alert({
          title: 'Error',
          message: 'No se pudo importar el catálogo global. Inténtalo de nuevo más tarde.',
          type: 'error'
        })
      }
    }

    // If they were already asked by another page, just clear the flag.
    if (alreadyAsked) {
      try { localStorage.removeItem(key) } catch {}
      return
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white border-b border-primary-200 sticky top-0 z-10 backdrop-blur-sm bg-white/95 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link to="/tickets" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
        <div className="grid grid-cols-3 gap-1 px-2 py-2">
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

      {/* Dialog host */}
      <DialogComponent />
    </div>
  )
}
