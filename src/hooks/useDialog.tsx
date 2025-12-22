import { useState, useCallback, useRef } from 'react'
import { Dialog } from '../components/Dialog'

interface DialogOptions {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
  cancelText?: string
}

interface PromptOptions {
  title: string
  placeholder?: string
  defaultValue?: string
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

  const [promptState, setPromptState] = useState<{
    isOpen: boolean
    title: string
    placeholder: string
    value: string
    confirmText: string
    cancelText: string
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    value: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar'
  })

  const resolverRef = useRef<((value: boolean | string | null) => void) | null>(null)

  const closeDialog = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
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

  const closePrompt = useCallback(() => {
    setPromptState(prev => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(null)
      resolverRef.current = null
    }
  }, [])

  const handlePromptConfirm = useCallback(() => {
    setPromptState(prev => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(promptState.value)
      resolverRef.current = null
    }
  }, [promptState.value])

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
      resolverRef.current = resolve as (value: boolean | string | null) => void
    })
  }, [])

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        title: options.title,
        placeholder: options.placeholder || '',
        value: options.defaultValue || '',
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar'
      })
      resolverRef.current = resolve as (value: boolean | string | null) => void
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

  const PromptComponent = useCallback(() => (
    promptState.isOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div
          className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 pb-4">
            <h3 className="text-xl font-bold text-secondary-900 mb-4">
              {promptState.title}
            </h3>
            <input
              type="text"
              value={promptState.value}
              onChange={(e) => setPromptState(prev => ({ ...prev, value: e.target.value }))}
              placeholder={promptState.placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePromptConfirm()
                } else if (e.key === 'Escape') {
                  closePrompt()
                }
              }}
              className="w-full px-4 py-2 border border-secondary-300 rounded-lg text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-2">
            <button
              onClick={closePrompt}
              className="flex-1 px-4 py-2.5 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition-colors font-medium"
            >
              {promptState.cancelText}
            </button>
            <button
              onClick={handlePromptConfirm}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              {promptState.confirmText}
            </button>
          </div>
        </div>
      </div>
    )
  ), [promptState, handlePromptConfirm, closePrompt])

  return {
    alert,
    confirm,
    prompt,
    DialogComponent,
    PromptComponent
  }
}
