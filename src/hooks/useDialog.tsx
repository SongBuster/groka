import { useState, useCallback } from 'react'
import { Dialog } from '../components/Dialog'

interface DialogOptions {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
  cancelText?: string
}

interface ConfirmOptions extends DialogOptions {
  onConfirm: () => void | Promise<void>
}

export function useDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    confirmText: string
    cancelText: string
    onConfirm?: () => void | Promise<void>
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

  const closeDialog = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const alert = useCallback((options: DialogOptions) => {
    setDialogState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      confirmText: options.confirmText || 'Aceptar',
      cancelText: options.cancelText || 'Cancelar',
      showCancel: false
    })
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialogState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'warning',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      onConfirm: options.onConfirm,
      showCancel: true
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
      onConfirm={dialogState.onConfirm}
      showCancel={dialogState.showCancel}
    />
  ), [dialogState, closeDialog])

  return {
    alert,
    confirm,
    DialogComponent
  }
}
