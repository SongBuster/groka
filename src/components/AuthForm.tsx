import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Mail, Lock, Loader2, ShoppingCart, BarChart3, Users } from 'lucide-react'

export default function AuthForm() {
  const { signIn, signUp } = useAuthStore()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isSignUp) {
        await signUp(email, password)
        setSuccess('¡Cuenta creada! Ahora puedes iniciar sesión.')
      } else {
        await signIn(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'Error al autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Grid responsive: 1 col en móvil, 2 en tablet/desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        {/* Left Side - Hero Section */}
        <div className="hidden lg:block space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-bold text-gray-900 leading-tight">
              Gestiona tus compras de forma inteligente
            </h1>
            <p className="text-lg text-gray-600">
              Organiza tus tickets, analiza tus gastos y crea listas compartidas con tu familia.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Listas inteligentes</h3>
                <p className="text-sm text-gray-600">Crea y gestiona tus listas de compra desde cualquier dispositivo</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Análisis de gastos</h3>
                <p className="text-sm text-gray-600">Visualiza tus patrones de compra y controla tu presupuesto</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Comparte con tu familia</h3>
                <p className="text-sm text-gray-600">Colabora en tiempo real con las personas que quieras</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
            {/* Mobile Header - solo visible en móvil */}
            <div className="lg:hidden text-center mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                🛒 Groka
              </h1>
              <p className="text-gray-600">Tu lista de compra inteligente</p>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {isSignUp ? '¡Únete a Groka!' : 'Bienvenido de nuevo'}
              </h2>
              <p className="text-gray-600">
                {isSignUp 
                  ? 'Crea tu cuenta y empieza a organizar tus compras' 
                  : 'Inicia sesión para continuar'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {isSignUp && (
                  <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <span>{isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setSuccess(null)
                }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                {isSignUp 
                  ? '¿Ya tienes cuenta? Inicia sesión' 
                  : '¿No tienes cuenta? Regístrate gratis'}
              </button>
            </div>

            {/* Features for mobile - solo visible en móvil */}
            <div className="lg:hidden mt-8 pt-6 border-t border-gray-200 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <ShoppingCart className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span>Listas de compra inteligentes</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <BarChart3 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>Análisis de gastos</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span>Comparte con tu familia</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
