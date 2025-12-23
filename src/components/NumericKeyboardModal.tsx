import { useState, useEffect } from 'react'
import { X, Delete } from 'lucide-react'

interface NumericKeyboardModalProps {
  isOpen: boolean
  value: number
  onClose: () => void
  onConfirm: (value: number) => void
  title?: string
  minValue?: number
  maxValue?: number
}

export default function NumericKeyboardModal({
  isOpen,
  value,
  onClose,
  onConfirm,
  title = 'Introducir cantidad',
  minValue = 1,
  maxValue = 999,
}: NumericKeyboardModalProps) {
  const [displayValue, setDisplayValue] = useState(value.toString())
  const [isFirstInput, setIsFirstInput] = useState(true)

  useEffect(() => {
    setDisplayValue(value.toString())
    setIsFirstInput(true)
  }, [value, isOpen])

  if (!isOpen) return null

  const handleNumberClick = (num: string) => {
    if (isFirstInput) {
      // Primera pulsación: reemplazar el valor actual
      setDisplayValue(num)
      setIsFirstInput(false)
    } else if (displayValue === '0') {
      setDisplayValue(num)
    } else if (displayValue.length < 3) {
      setDisplayValue(displayValue + num)
    }
  }

  const handleBackspace = () => {
    setIsFirstInput(false)
    if (displayValue.length > 1) {
      setDisplayValue(displayValue.slice(0, -1))
    } else {
      setDisplayValue('0')
    }
  }

  const handleClear = () => {
    setIsFirstInput(false)
    setDisplayValue('0')
  }

  const handleConfirm = () => {
    let numValue = parseInt(displayValue) || 0
    
    // Clamp value between min and max
    if (numValue < minValue) numValue = minValue
    if (numValue > maxValue) numValue = maxValue
    
    onConfirm(numValue)
    onClose()
  }

  const handleCancel = () => {
    setDisplayValue(value.toString())
    onClose()
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-end z-50">
      <div className="bg-white w-full rounded-t-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-secondary-900">{title}</h2>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-secondary-600" />
          </button>
        </div>

        {/* Display */}
        <div className="bg-secondary-100 rounded-lg p-4 mb-6 text-center">
          <div className="text-4xl font-bold text-primary-600">{displayValue}</div>
        </div>

        {/* Action Buttons - Top */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleClear}
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-colors"
          >
            AC
          </button>
          <button
            onClick={handleBackspace}
            className="flex-1 bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Delete className="w-5 h-5" />
            <span>DEL</span>
          </button>
        </div>

        {/* Numeric Keyboard - Calculator Layout */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Row 1: 7, 8, 9 */}
          <button
            onClick={() => handleNumberClick('7')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            7
          </button>
          <button
            onClick={() => handleNumberClick('8')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            8
          </button>
          <button
            onClick={() => handleNumberClick('9')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            9
          </button>

          {/* Row 2: 4, 5, 6 */}
          <button
            onClick={() => handleNumberClick('4')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            4
          </button>
          <button
            onClick={() => handleNumberClick('5')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            5
          </button>
          <button
            onClick={() => handleNumberClick('6')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            6
          </button>

          {/* Row 3: 1, 2, 3 */}
          <button
            onClick={() => handleNumberClick('1')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            1
          </button>
          <button
            onClick={() => handleNumberClick('2')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            2
          </button>
          <button
            onClick={() => handleNumberClick('3')}
            className="bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            3
          </button>

          {/* Row 4: 0, . (decimal) */}
          <button
            onClick={() => handleNumberClick('0')}
            className="col-span-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-900 font-bold py-3 rounded-lg transition-colors text-xl"
          >
            0
          </button>
          <button
            disabled
            className="bg-gray-300 text-gray-500 font-bold py-3 rounded-lg cursor-not-allowed text-xl"
          >
            .
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
