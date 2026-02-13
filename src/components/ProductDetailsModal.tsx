import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { formatCurrency, formatDate } from '../lib/formatters'
import type { ProductStatsDetail, ProductPricePoint, ProductWithCategory } from '../services/productService'

interface ProductDetailsModalProps {
  isOpen: boolean
  product: ProductWithCategory | null
  stats: ProductStatsDetail | null
  loading: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function ProductDetailsModal({
  isOpen,
  product,
  stats,
  loading,
  onClose,
  onEdit,
  onDelete
}: ProductDetailsModalProps) {
  const [chartTab, setChartTab] = useState<'price' | 'frequency'>('price')
  const showActions = Boolean(onEdit || onDelete)

  const safeStats = useMemo(() => stats, [stats])

  if (!isOpen || !product) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-bold text-secondary-900">
              {product.name}
            </h3>
            <p className="text-sm text-secondary-600">
              {product.category ? `${product.category.icon} ${product.category.name}` : 'Sin categoría'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary-100 transition"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-secondary-600" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="w-full">
            <h4 className="text-sm font-semibold text-secondary-700 mb-2">Aliases</h4>
            {product.aliases && product.aliases.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.aliases.map((alias) => (
                  <span key={alias} className="px-2 py-1 text-xs bg-secondary-100 text-secondary-700 rounded">
                    {alias}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-secondary-400">Sin aliases</p>
            )}
          </div>

          <div className="bg-secondary-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-secondary-700 mb-3">Estadísticas</h4>
            {loading ? (
              <p className="text-sm text-secondary-600">Cargando estadísticas…</p>
            ) : safeStats ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-secondary-500">Primera compra</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.firstPurchasedAt ? formatDate(safeStats.firstPurchasedAt) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-500">Última compra</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.lastPurchasedAt ? formatDate(safeStats.lastPurchasedAt) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-500">Veces comprado</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.purchaseCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-500">Promedio días</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.averageDaysBetweenPurchases != null ? Math.round(safeStats.averageDaysBetweenPurchases) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-500">Precio promedio</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.averagePrice != null ? formatCurrency(safeStats.averagePrice) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-500">Precio máximo</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.maxPrice ? `${formatCurrency(safeStats.maxPrice.value)} · ${formatDate(safeStats.maxPrice.date)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-500">Precio mínimo</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.minPrice ? `${formatCurrency(safeStats.minPrice.value)} · ${formatDate(safeStats.minPrice.date)}` : '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-secondary-500">Último precio</div>
                  <div className="text-sm font-medium text-secondary-900">
                    {safeStats.lastPrice ? `${formatCurrency(safeStats.lastPrice.value)} · ${formatDate(safeStats.lastPrice.date)}` : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-secondary-600">Sin datos aún.</p>
            )}
          </div>

          {/* Score de Necesidad (Weibull) */}
          {safeStats && safeStats.needScore !== null && safeStats.needScore !== undefined && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h4 className="text-sm font-semibold text-secondary-700">Score de Necesidad</h4>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap ${
                    safeStats.urgencyLevel === 'very-high'
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : safeStats.urgencyLevel === 'high'
                      ? 'bg-orange-100 text-orange-700 border border-orange-300'
                      : safeStats.urgencyLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                      : 'bg-green-100 text-green-700 border border-green-300'
                  }`}
                >
                  {safeStats.urgencyLevel === 'very-high'
                    ? '🔴 Muy urgente'
                    : safeStats.urgencyLevel === 'high'
                    ? '🟠 Urgente'
                    : safeStats.urgencyLevel === 'medium'
                    ? '🟡 Medio'
                    : '🟢 Bajo'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Score</div>
                  <div className="text-lg font-bold text-indigo-700">
                    {safeStats.needScore.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Confianza</div>
                  <div className="text-lg font-bold text-indigo-700">
                    {safeStats.needConfidence !== null && safeStats.needConfidence !== undefined
                      ? `${Math.round(safeStats.needConfidence * 100)}%`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Días retraso</div>
                  <div className="text-lg font-bold text-indigo-700">
                    {safeStats.daysOverdue !== null && safeStats.daysOverdue !== undefined
                      ? `${safeStats.daysOverdue > 0 ? '+' : ''}${Math.round(safeStats.daysOverdue)}`
                      : '—'}
                  </div>
                </div>
              </div>
              {safeStats.needReason && (
                <div className="text-xs text-secondary-700 bg-white/60 rounded-lg p-2 border border-blue-100">
                  <span className="font-medium">Motivo:</span> {safeStats.needReason}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-secondary-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h4 className="text-sm font-semibold text-secondary-700">Gráficas</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartTab('price')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    chartTab === 'price'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-secondary-700 border-secondary-300 hover:bg-secondary-50'
                  }`}
                >
                  Precios
                </button>
                <button
                  onClick={() => setChartTab('frequency')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    chartTab === 'frequency'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-secondary-700 border-secondary-300 hover:bg-secondary-50'
                  }`}
                >
                  Frecuencia
                </button>
              </div>
            </div>
            {chartTab === 'price' ? (
              safeStats && safeStats.priceHistory.length >= 2 ? (
                <PriceHistoryChart points={safeStats.priceHistory} />
              ) : (
                <p className="text-sm text-secondary-500">No hay suficientes datos para la gráfica de precios.</p>
              )
            ) : (
              safeStats && safeStats.priceHistory.length >= 1 ? (
                <PurchaseFrequencyChart points={safeStats.priceHistory} />
              ) : (
                <p className="text-sm text-secondary-500">No hay suficientes datos para la frecuencia.</p>
              )
            )}
          </div>

          {showActions && (
            <div className="flex gap-3">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Editar
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PriceHistoryChart({ points }: { points: ProductPricePoint[] }) {
  const width = 760
  const height = 220
  const padding = 36
  const max = Math.max(...points.map(p => p.price), 1)
  const min = Math.min(...points.map(p => p.price), 0)
  const range = Math.max(max - min, 1)
  const chartHeight = height - padding * 2
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const avg = points.reduce((sum, p) => sum + p.price, 0) / Math.max(points.length, 1)
  const labelIndices = [0, Math.floor(points.length / 2), points.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i && v >= 0)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="12" />
      {points.map((p, i) => {
        const x = padding + i * stepX
        const y = height - padding - ((p.price - min) / range) * chartHeight
        return (
          <circle key={p.date} cx={x} cy={y} r={3} fill="#0f766e" />
        )
      })}
      {points.map((p, i) => {
        const x = padding + i * stepX
        const y = height - padding - ((p.price - min) / range) * chartHeight
        return i === 0 ? (
          <path key={p.date} d={`M ${x} ${y}`} stroke="none" />
        ) : null
      })}
      <path
        d={points
          .map((p, i) => {
            const x = padding + i * stepX
            const y = height - padding - ((p.price - min) / range) * chartHeight
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
          })
          .join(' ')}
        stroke="#0f766e"
        strokeWidth="2"
        fill="none"
      />
      <path
        d={`M ${padding} ${height - padding - ((avg - min) / range) * chartHeight} L ${width - padding} ${height - padding - ((avg - min) / range) * chartHeight}`}
        stroke="#f59e0b"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
      />
      <text x={padding} y={height - 10} fontSize="12" fill="#64748b">
        {formatCurrency(min)}
      </text>
      <text x={padding} y={22} fontSize="12" fill="#64748b">
        {formatCurrency(max)}
      </text>
      <text x={width - padding} y={height - padding - ((avg - min) / range) * chartHeight - 6} fontSize="12" fill="#64748b" textAnchor="end">
        Media {formatCurrency(avg)}
      </text>
      {labelIndices.map((i) => (
        <text
          key={`x-label-${i}`}
          x={padding + i * stepX}
          y={height - 6}
          fontSize="12"
          fill="#94a3b8"
          textAnchor="middle"
        >
          {formatMonthYear(points[i].date)}
        </text>
      ))}
    </svg>
  )
}

function PurchaseFrequencyChart({ points }: { points: ProductPricePoint[] }) {
  const width = 760
  const height = 220
  const padding = 36

  const buckets = new Map<string, number>()
  for (const p of points) {
    const d = new Date(p.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }

  const keys = Array.from(buckets.keys()).sort()
  const values = keys.map(k => buckets.get(k) || 0)
  const max = Math.max(...values, 1)
  const barWidth = (width - padding * 2) / Math.max(keys.length, 1)
  const chartHeight = height - padding * 2

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="12" />
      {values.map((count, i) => {
        const h = (count / max) * chartHeight
        const x = padding + i * barWidth + barWidth * 0.15
        const y = height - padding - h
        const w = barWidth * 0.7
        return (
          <g key={keys[i]}>
            <rect x={x} y={y} width={w} height={h} rx="6" fill="#2563eb" />
            <text x={x + w / 2} y={y - 6} fontSize="10" fill="#0f172a" textAnchor="middle">
              {count}
            </text>
            <text x={x + w / 2} y={height - 10} fontSize="10" fill="#94a3b8" textAnchor="middle">
              {formatMonth(keys[i])}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function formatMonth(key: string) {
  try {
    const text = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(`${key}-01`))
    return capitalize(text)
  } catch {
    return key
  }
}

function formatMonthYear(dateStr: string) {
  try {
    const text = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(dateStr))
    return capitalize(text)
  } catch {
    return ''
  }
}

function capitalize(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
