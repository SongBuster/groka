import { useState, useCallback, useRef } from 'react'
import { Dialog } from '../components/Dialog'

interface DialogOptions {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
  cancelText?: string
}

export function useDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    confirmText: string
    cancelText: string
    showCancel: boolean
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    showCancel: false
  })

  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const closeDialog = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
    // If it's a confirm dialog and user closes without confirming, resolve with false
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
  }, [])

  const handleConfirm = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(true)
      resolverRef.current = null
    }
  }, [])

  const alert = useCallback((options: DialogOptions): Promise<void> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        showCancel: false
      })
      resolverRef.current = () => {
        resolve()
      }
    })
  }, [])

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title,
        message: options.message,
        type: options.type || 'warning',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        showCancel: true
      })
      resolverRef.current = resolve
    })
  }, [])

  const DialogComponent = useCallback(() => (
    <Dialog
      isOpen={dialogState.isOpen}
      onClose={closeDialog}
      title={dialogState.title}
      message={dialogState.message}
      type={dialogState.type}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      onConfirm={handleConfirm}
      showCancel={dialogState.showCancel}
    />
  ), [dialogState, closeDialog, handleConfirm])

  return {
    alert,
    confirm,
    DialogComponent
  }
}
