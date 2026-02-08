import { X } from 'lucide-react'

type AppHelpModalProps = {
  open: boolean
  title: string
  description?: string
  bullets: string[]
  primaryLabel?: string
  onClose: () => void
}

export default function AppHelpModal({
  open,
  title,
  description,
  bullets,
  primaryLabel = 'Entendido',
  onClose
}: AppHelpModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-bold text-secondary-900">{title}</h3>
            {description && (
              <p className="text-sm text-secondary-600 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary-100 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5 text-secondary-600" />
          </button>
        </div>

        <ul className="space-y-2 mb-6">
          {bullets.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-secondary-700">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary-600 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
