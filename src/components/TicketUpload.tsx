import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Upload, Loader2 } from 'lucide-react'
import ticketService from '../services/ticketService'

export default function TicketUpload({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const user = useAuthStore(state => state.user)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = async (file: File) => {
    if (!user) {
      setError('Debes iniciar sesión primero')
      return
    }

    if (file.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF')
      return
    }

    setUploading(true)
    setError(null)

    try {
      await ticketService.uploadAndParseTicket(file, user.id)
      onUploadComplete?.()
    } catch (err: any) {
      console.error('Error uploading ticket:', err)
      setError(err.message || 'Error al subir el ticket')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  return (
    <div className="w-full">
      <label
        htmlFor="ticket-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center w-full h-64 
          border-2 border-dashed rounded-lg cursor-pointer 
          transition-colors duration-200
          ${dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 mb-3 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-600">Procesando ticket...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-700">
                <span className="font-semibold">Click para subir</span> o arrastra el PDF aquí
              </p>
              <p className="text-xs text-gray-500">
                Sube tu ticket de compra en formato PDF
              </p>
            </>
          )}
        </div>
        <input
          id="ticket-upload"
          type="file"
          className="hidden"
          accept="application/pdf"
          onChange={handleChange}
          disabled={uploading}
        />
      </label>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}
