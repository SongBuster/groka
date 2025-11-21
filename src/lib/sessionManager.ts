/**
 * Session Manager - Detecta y maneja sesiones expiradas
 */

type SessionExpiredCallback = () => void

let sessionExpiredCallback: SessionExpiredCallback | null = null

/**
 * Registra un callback para cuando la sesión expire
 */
export function onSessionExpired(callback: SessionExpiredCallback) {
  sessionExpiredCallback = callback
}

/**
 * Detecta si un error de Supabase es por JWT expirado
 */
export function isJWTExpiredError(error: any): boolean {
  if (!error) return false
  
  // Error de Supabase cuando JWT expira
  if (error.code === 'PGRST301' || error.code === 'PGRST302' || error.code === 'PGRST303') {
    return true
  }
  
  // Mensaje de JWT expirado
  if (error.message?.toLowerCase().includes('jwt expired')) {
    return true
  }
  
  return false
}

/**
 * Maneja un error, detectando si es por sesión expirada
 */
export function handleSupabaseError(error: any) {
  if (isJWTExpiredError(error)) {
    console.warn('🔒 JWT expired - session invalid')
    if (sessionExpiredCallback) {
      sessionExpiredCallback()
    }
  }
}
