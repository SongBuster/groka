import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDialog } from './useDialog'
import { onSessionExpired } from '../lib/sessionManager'

let isAlertShown = false

export function useSessionExpiredDetector() {
  const navigate = useNavigate()
  const { signOut } = useAuthStore()
  const { alert } = useDialog()

  useEffect(() => {
    const handleSessionExpired = async () => {
      // Evitar mostrar múltiples alertas
      if (isAlertShown) return
      isAlertShown = true

      await alert({
        title: '⏱️ Sesión expirada',
        message: 'Tu sesión ha caducado por inactividad. Por favor, vuelve a iniciar sesión.',
        type: 'warning',
        confirmText: 'Ir al login'
      })

      // Limpiar sesión y redirigir
      await signOut()
      navigate('/login')
      
      // Resetear flag después de un tiempo
      setTimeout(() => {
        isAlertShown = false
      }, 1000)
    }

    // Registrar el callback
    onSessionExpired(handleSessionExpired)
  }, [navigate, signOut, alert])
}
