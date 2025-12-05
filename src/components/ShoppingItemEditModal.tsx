import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import NumericKeyboardModalDecimal from './NumericKeyboardModalDecimal'
import type { Database } from '../types/database'
import type { ProductWithCategory } from '../services/productService'

type ShoppingListItem = Database['public']['Tables']['shopping_list_items']['Row'] & {
  product?: ProductWithCategory
}

interface ShoppingItemEditModalProps {
  isOpen: boolean
  item: ShoppingListItem | null
  onClose: () => void
  onConfirm: (updates: {
    quantity?: number
    weight?: number | null
    actual_price?: number | null
  }) => void
}

type InputMode = 'units' | 'weight'

export default function ShoppingItemEditModal({
  isOpen,
  item,
  onClose,
  onConfirm,
}: ShoppingItemEditModalProps) {
  const [inputMode, setInputMode] = useState<InputMode>('units')
  const [quantity, setQuantity] = useState(1)
  const [weight, setWeight] = useState(0)
  const [pricePerUnit, setPricePerUnit] = useState(0)
  const [pricePerKg, setPricePerKg] = useState(0)

  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [showPricePerUnitModal, setShowPricePerUnitModal] = useState(false)
  const [showPricePerKgModal, setShowPricePerKgModal] = useState(false)

  // Calculate totalPrice - moved BEFORE the null check
  const totalPrice = useMemo(() => {
    if (inputMode === 'units') {
      return quantity * pricePerUnit
    } else {
      return weight * pricePerKg
    }
  }, [inputMode, quantity, weight, pricePerUnit, pricePerKg])

  if (!isOpen || !item) {
    return null
  }

  const handleConfirm = () => {
    const updates: {
      quantity?: number
      weight?: number | null
      actual_price?: number | null
    } = {}

    if (inputMode === 'units') {
      updates.quantity = quantity
      updates.weight = null
      updates.actual_price = totalPrice > 0 ? totalPrice : null
    } else {
      updates.quantity = 1
      updates.weight = weight
      updates.actual_price = totalPrice > 0 ? totalPrice : null
    }

    onConfirm(updates)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-secondary-900">Editar producto</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-secondary-600" />
          </button>
        </div>

        {/* Product Name */}
        <div className="mb-6 p-4 bg-secondary-50 rounded-lg">
          <p className="text-sm text-secondary-600 mb-1">Producto</p>
          <p className="text-lg font-bold text-secondary-900">{item.name}</p>
        </div>

        {/* Input Mode Selection */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setInputMode('units')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              inputMode === 'units'
                ? 'bg-primary-600 text-white'
                : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
            }`}
          >
            Por unidades
          </button>
          <button
            onClick={() => setInputMode('weight')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              inputMode === 'weight'
                ? 'bg-primary-600 text-white'
                : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
            }`}
          >
            Por peso
          </button>
        </div>

        {/* Input Fields Based on Mode */}
        <div className="space-y-4 mb-6">
          {inputMode === 'units' ? (
            <>
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Unidades
                </label>
                <button
                  onClick={() => setShowQuantityModal(true)}
                  className="w-full py-3 px-4 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-bold text-primary-600 text-lg"
                >
                  {quantity}
                </button>
              </div>

              {/* Price per Unit */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Precio por unidad (€)
                </label>
                <button
                  onClick={() => setShowPricePerUnitModal(true)}
                  className="w-full py-3 px-4 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-bold text-primary-600 text-lg"
                >
                  {pricePerUnit.toFixed(2)}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Peso (kg)
                </label>
                <button
                  onClick={() => setShowWeightModal(true)}
                  className="w-full py-3 px-4 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-bold text-primary-600 text-lg"
                >
                  {weight.toFixed(2)}
                </button>
              </div>

              {/* Price per Kg */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Precio por kg (€)
                </label>
                <button
                  onClick={() => setShowPricePerKgModal(true)}
                  className="w-full py-3 px-4 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-bold text-primary-600 text-lg"
                >
                  {pricePerKg.toFixed(2)}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Total Price */}
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-center">
          <p className="text-sm text-green-700 mb-1">Precio total</p>
          <p className="text-3xl font-bold text-green-600">{totalPrice.toFixed(2)}€</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-secondary-300 text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Guardar
          </button>
        </div>

        {/* Numeric Keyboard Modals */}
        <NumericKeyboardModalDecimal
          isOpen={showQuantityModal}
          value={quantity}
          onClose={() => setShowQuantityModal(false)}
          onConfirm={(value) => setQuantity(Math.round(value))}
          title="Introducir unidades"
          minValue={1}
          maxValue={9999}
          allowDecimals={false}
        />

        <NumericKeyboardModalDecimal
          isOpen={showWeightModal}
          value={weight}
          onClose={() => setShowWeightModal(false)}
          onConfirm={setWeight}
          title="Introducir peso (kg)"
          minValue={0.01}
          maxValue={9999.99}
          allowDecimals={true}
        />

        <NumericKeyboardModalDecimal
          isOpen={showPricePerUnitModal}
          value={pricePerUnit}
          onClose={() => setShowPricePerUnitModal(false)}
          onConfirm={setPricePerUnit}
          title="Precio por unidad (€)"
          minValue={0}
          maxValue={9999.99}
          allowDecimals={true}
        />

        <NumericKeyboardModalDecimal
          isOpen={showPricePerKgModal}
          value={pricePerKg}
          onClose={() => setShowPricePerKgModal(false)}
          onConfirm={setPricePerKg}
          title="Precio por kg (€)"
          minValue={0}
          maxValue={9999.99}
          allowDecimals={true}
        />
      </div>
    </div>
  )
}
