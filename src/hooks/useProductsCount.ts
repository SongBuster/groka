import { useState, useEffect } from 'react'
import productService from '../services/productService'
import { handleSupabaseError } from '../lib/sessionManager'
import { useAuthStore } from '../stores/authStore'

// Evento personalizado para actualizar el contador
export const PRODUCTS_UPDATED_EVENT = 'products-updated'

export function useProductsCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    const loadCount = async () => {
      try {
        if (!user?.id) return
        const products = await productService.getAll(user.id)
        // Contar productos pendientes + sin categoría
        const needsAttention = products.filter(
          p => p.review_status === 'pending' || p.review_status === 'uncategorized'
        ).length
        setCount(needsAttention)
      } catch (error) {
        console.error('Error loading products count:', error)
        handleSupabaseError(error)
        setCount(0)
      } finally {
        setLoading(false)
      }
    }

    loadCount()

    // Escuchar eventos personalizados para actualizar inmediatamente
    const handleProductsUpdate = () => {
      loadCount()
    }

    window.addEventListener(PRODUCTS_UPDATED_EVENT, handleProductsUpdate)

    // Recargar cada minuto por si hay cambios externos
    const interval = setInterval(loadCount, 60000)
    
    return () => {
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, handleProductsUpdate)
      clearInterval(interval)
    }
  }, [user?.id])

  return { count, loading }
}

// Helper para disparar el evento desde cualquier parte de la app
export function notifyProductsUpdated() {
  window.dispatchEvent(new CustomEvent(PRODUCTS_UPDATED_EVENT))
}
