import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { BarChart3, TrendingUp, Receipt, Wallet } from 'lucide-react'
import supermarketService from '../services/supermarketService'
import type { Database } from '../types/database'

type TicketRow = {
  id: string
  purchase_date: string | null
  total_amount: number | null
  supermarket_id?: string | null
  store_name?: string | null
  created_at: string
}

type TicketItemRow = {
  total_price: number
  unit_price: number | null
  quantity: number
  product_id: string | null
  products?: {
    name: string
    category_id: string | null
    categories?: {
      name: string
      icon: string | null
      color: string | null
    } | null
  } | null
  tickets?: {
    purchase_date: string | null
    supermarket_id?: string | null
    store_name?: string | null
  } | null
  created_at: string
}

type MonthlySpend = { key: string; label: string; value: number }
type TrendPoint = { x: number; y: number }

type TopItem = {
  name: string
  value: number
  icon?: string | null
  color?: string | null
}

type Supermarket = Database['public']['Tables']['supermarkets']['Row']

export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [items, setItems] = useState<TicketItemRow[]>([])
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStore, setSelectedStore] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'quarter' | 'semester' | 'year'>('all')
  const [periodMode, setPeriodMode] = useState<'current' | 'rolling'>('current')

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return
      setLoading(true)
      try {
        const { data: ticketData, error: tErr } = await supabase
          .from('tickets')
          .select('id,purchase_date,total_amount,created_at,supermarket_id,store_name')
          .eq('user_id', user.id)

        if (tErr) throw tErr

        const { data: itemData, error: iErr } = await supabase
          .from('ticket_items')
          .select(`
            total_price,
            unit_price,
            quantity,
            product_id,
            created_at,
            products(
              name,
              category_id,
              categories(name, icon, color)
            ),
            tickets!inner(purchase_date, user_id, supermarket_id, store_name)
          `)
          .eq('tickets.user_id', user.id)

        if (iErr) throw iErr

        const [markets] = await Promise.all([
          supermarketService.getAll()
        ])

        setTickets((ticketData as TicketRow[]) || [])
        setItems((itemData as TicketItemRow[]) || [])
        setSupermarkets(markets)
      } catch (e) {
        console.error('Error loading analytics:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id])

  const storeFilteredTickets = useMemo(() => {
    if (selectedStore === 'all') return tickets
    return tickets.filter(t => t.supermarket_id === selectedStore)
  }, [tickets, selectedStore])

  const storeFilteredItems = useMemo(() => {
    if (selectedStore === 'all') return items
    return items.filter(i => i.tickets?.supermarket_id === selectedStore)
  }, [items, selectedStore])

  const periodRange = useMemo(() => getPeriodRange(selectedPeriod, periodMode), [selectedPeriod, periodMode])

  const filteredTickets = useMemo(() => {
    if (selectedPeriod === 'all') return storeFilteredTickets
    if (!periodRange) return storeFilteredTickets
    return storeFilteredTickets.filter(t => isWithinRange(t, periodRange.start, periodRange.end))
  }, [storeFilteredTickets, selectedPeriod, periodRange])

  const filteredItems = useMemo(() => {
    if (selectedPeriod === 'all') return storeFilteredItems
    if (!periodRange) return storeFilteredItems
    return storeFilteredItems.filter(i => {
      const dateStr = i.tickets?.purchase_date || i.created_at
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) return false
      return d >= periodRange.start && d <= periodRange.end
    })
  }, [storeFilteredItems, selectedPeriod, periodRange])

  const totalSpend = useMemo(() => {
    return filteredTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0)
  }, [filteredTickets])

  const ticketsCount = filteredTickets.length
  const avgTicket = ticketsCount > 0 ? totalSpend / ticketsCount : 0

  const comparison = useMemo(() => {
    if (!periodRange) return null
    const { start, end, prevStart, prevEnd } = periodRange

    const current = storeFilteredTickets
      .filter(t => isWithinRange(t, start, end))
      .reduce((sum, t) => sum + (t.total_amount || 0), 0)

    const previous = storeFilteredTickets
      .filter(t => isWithinRange(t, prevStart, prevEnd))
      .reduce((sum, t) => sum + (t.total_amount || 0), 0)

    const diff = current - previous
    const pct = previous > 0 ? (diff / previous) * 100 : null
    return { current, previous, diff, pct }
  }, [storeFilteredTickets, selectedPeriod, periodRange])

  const infoRangeLabel = useMemo(() => {
    if (selectedPeriod === 'all') {
      if (tickets.length === 0) return 'Todo el histórico'
      let minDate: Date | null = null
      let maxDate: Date | null = null
      for (const t of tickets) {
        const dateStr = t.purchase_date || t.created_at
        const d = new Date(dateStr)
        if (Number.isNaN(d.getTime())) continue
        if (!minDate || d < minDate) minDate = d
        if (!maxDate || d > maxDate) maxDate = d
      }
      if (!minDate || !maxDate) return 'Todo el histórico'
      return rangeLabel(minDate, maxDate)
    }
    if (!periodRange) return ''
    const base = rangeLabel(periodRange.start, periodRange.end)
    return periodMode === 'rolling' ? `${base} (móvil)` : base
  }, [selectedPeriod, tickets, periodRange, periodMode])


  const monthlySpend = useMemo<MonthlySpend[]>(() => {
    const map = new Map<string, number>()
    for (const t of filteredTickets) {
      const dateStr = t.purchase_date || t.created_at
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + (t.total_amount || 0))
    }
    const rows = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return rows.slice(-12).map(([key, value]) => ({
      key,
      label: formatMonthYear(`${key}-01`),
      value
    }))
  }, [filteredTickets])

  const monthlyTrend = useMemo<TrendPoint[] | null>(() => {
    if (monthlySpend.length < 2) return null
    const n = monthlySpend.length
    const xs = monthlySpend.map((_, i) => i)
    const ys = monthlySpend.map(m => m.value)
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
    const sumX2 = xs.reduce((a, x) => a + x * x, 0)
    const denom = n * sumX2 - sumX * sumX
    if (denom === 0) return null
    const slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    return xs.map(x => ({ x, y: slope * x + intercept }))
  }, [monthlySpend])

  const comparisonChart = useMemo<MonthlySpend[] | null>(() => {
    if (!periodRange) return null
    const current = storeFilteredTickets
      .filter(t => isWithinRange(t, periodRange.start, periodRange.end))
      .reduce((sum, t) => sum + (t.total_amount || 0), 0)
    const previous = storeFilteredTickets
      .filter(t => isWithinRange(t, periodRange.prevStart, periodRange.prevEnd))
      .reduce((sum, t) => sum + (t.total_amount || 0), 0)

    return [
      { key: 'current', label: rangeLabel(periodRange.start, periodRange.end), value: current },
      { key: 'previous', label: rangeLabel(periodRange.prevStart, periodRange.prevEnd), value: previous }
    ]
  }, [storeFilteredTickets, selectedPeriod, periodRange])

  const priceIncreases = useMemo(() => {
    const map = new Map<string, { name: string; first: number; last: number; firstDate: Date; lastDate: Date }>()
    for (const item of filteredItems) {
      const key = item.product_id || item.products?.name || 'Producto'
      const name = item.products?.name || 'Producto'
      const quantity = item.quantity || 1
      const unitPrice = item.unit_price ?? (quantity > 0 ? item.total_price / quantity : null)
      if (unitPrice === null || Number.isNaN(unitPrice)) continue

      const dateStr = item.tickets?.purchase_date || item.created_at
      const date = new Date(dateStr)
      if (Number.isNaN(date.getTime())) continue

      const existing = map.get(key)
      if (!existing) {
        map.set(key, { name, first: unitPrice, last: unitPrice, firstDate: date, lastDate: date })
      } else {
        if (date < existing.firstDate) {
          existing.firstDate = date
          existing.first = unitPrice
        }
        if (date > existing.lastDate) {
          existing.lastDate = date
          existing.last = unitPrice
        }
      }
    }

    return Array.from(map.values())
      .map((p) => ({
        name: p.name,
        delta: p.last - p.first,
        first: p.first,
        last: p.last
      }))
      .filter(p => p.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 6)
  }, [filteredItems])

  const categoryFrequency = useMemo(() => {
    const map = new Map<string, { name: string; count: number; icon?: string | null; color?: string | null }>()
    for (const item of filteredItems) {
      const name = item.products?.categories?.name || 'Sin categoría'
      const icon = item.products?.categories?.icon || '📦'
      const color = item.products?.categories?.color || '#6b7280'
      const existing = map.get(name)
      if (existing) existing.count += 1
      else map.set(name, { name, count: 1, icon, color })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [filteredItems])

  const spendForecast = useMemo(() => {
    if (!periodRange) return null
    const { start, end } = periodRange
    const current = storeFilteredTickets
      .filter(t => isWithinRange(t, start, end))
      .reduce((sum, t) => sum + (t.total_amount || 0), 0)
    const daysElapsed = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    const totalDays = periodMode === 'rolling'
      ? daysElapsed
      : Math.max(daysElapsed, getTotalDaysForPeriod(start, selectedPeriod))
    const forecast = (current / daysElapsed) * totalDays
    const prevRange = periodMode === 'rolling'
      ? { start: periodRange.prevStart, end: periodRange.prevEnd }
      : getPreviousFullPeriodRange(selectedPeriod)
    const previous = prevRange
      ? storeFilteredTickets
        .filter(t => isWithinRange(t, prevRange.start, prevRange.end))
        .reduce((sum, t) => sum + (t.total_amount || 0), 0)
      : 0
    const diff = forecast - previous
    return { current, forecast, previous, diff }
  }, [storeFilteredTickets, selectedPeriod, periodRange, periodMode])

  const topCategories = useMemo<TopItem[]>(() => {
    const map = new Map<string, TopItem>()
    for (const item of filteredItems) {
      const name = item.products?.categories?.name || 'Sin categoría'
      const icon = item.products?.categories?.icon || '📦'
      const color = item.products?.categories?.color || '#6b7280'
      const value = item.total_price || 0
      const existing = map.get(name)
      if (existing) {
        existing.value += value
      } else {
        map.set(name, { name, value, icon, color })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [filteredItems])

  const topProducts = useMemo<TopItem[]>(() => {
    const map = new Map<string, TopItem>()
    for (const item of filteredItems) {
      const name = item.products?.name || 'Producto'
      const value = item.total_price || 0
      const existing = map.get(name)
      if (existing) {
        existing.value += value
      } else {
        map.set(name, { name, value })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [filteredItems])

  const storeOptions = useMemo(() => {
    return supermarkets.map(sm => ({ value: sm.id, label: sm.name }))
  }, [supermarkets])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900">Análisis</h1>
        <p className="text-secondary-600">Patrones de compra y gastos</p>
      </div>

      {loading ? (
        <div className="text-secondary-600">Cargando análisis…</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-secondary-200 p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <label className="text-sm text-secondary-700 font-medium">Supermercado</label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="px-3 py-2 border border-secondary-300 rounded-lg text-sm bg-white text-secondary-900"
                >
                  <option value="all">Todos</option>
                  {storeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <label className="text-sm text-secondary-700 font-medium">Periodo</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="px-3 py-2 border border-secondary-300 rounded-lg text-sm bg-white text-secondary-900"
                >
                  <option value="all">Todos</option>
                  <option value="month">Mes</option>
                  <option value="quarter">Trimestre</option>
                  <option value="semester">Semestre</option>
                  <option value="year">Año</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <label className="text-sm text-secondary-700 font-medium">Modo</label>
                <div className="flex items-center bg-secondary-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setPeriodMode('current')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${periodMode === 'current'
                      ? 'bg-white text-secondary-900 shadow-sm'
                      : 'text-secondary-600 hover:text-secondary-800'
                    }`}
                    disabled={selectedPeriod === 'all'}
                  >
                    Actual
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodMode('rolling')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${periodMode === 'rolling'
                      ? 'bg-white text-secondary-900 shadow-sm'
                      : 'text-secondary-600 hover:text-secondary-800'
                    }`}
                    disabled={selectedPeriod === 'all'}
                  >
                    Móvil
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Gasto total" value={formatCurrencyLocal(totalSpend)} subtitle={infoRangeLabel} icon={<Wallet className="w-5 h-5" />} />
            <StatCard title="Nº tickets" value={formatNumber(ticketsCount)} subtitle={infoRangeLabel} icon={<Receipt className="w-5 h-5" />} />
            <StatCard title="Ticket medio" value={formatCurrencyLocal(avgTicket)} subtitle={infoRangeLabel} icon={<TrendingUp className="w-5 h-5" />} />
            <StatCard
              title="Comparativa"
              value={comparison ? formatComparison(comparison.diff, comparison.pct) : '—'}
              subtitle={infoRangeLabel}
              icon={<BarChart3 className="w-5 h-5" />}
              valueClassName={comparison ? (comparison.diff <= 0 ? 'text-emerald-600' : 'text-red-600') : undefined}
            />
          </div>

          <div className="bg-white rounded-xl border border-secondary-200 p-4">
            <h3 className="text-sm font-semibold text-secondary-700 mb-3">
              {selectedPeriod === 'all' ? 'Gasto mensual' : 'Comparativa del periodo'}
            </h3>
            {selectedPeriod === 'all' ? (
              monthlySpend.length > 0 ? (
                <div className="space-y-2">
                  <MonthlySpendChart data={monthlySpend} trend={monthlyTrend || undefined} />
                  {monthlyTrend && (
                    <p className="text-xs text-secondary-500">Línea morada: tendencia del gasto mensual.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-secondary-500">No hay datos suficientes.</p>
              )
            ) : (
              comparisonChart && comparisonChart.length > 0 ? (
                <MonthlySpendChart data={comparisonChart} />
              ) : (
                <p className="text-sm text-secondary-500">No hay datos suficientes.</p>
              )
            )}
          </div>

          {selectedPeriod !== 'all' && spendForecast && (
            <div className="bg-white rounded-xl border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-700 mb-2">Predicción de gasto</h3>
              <p className="text-sm text-secondary-600">
                Con el ritmo actual, estimamos un total de <strong>{formatCurrencyLocal(spendForecast.forecast)}</strong> para este periodo. El periodo anterior se gastaron <strong>{formatCurrencyLocal(spendForecast.previous)}</strong>,
                con lo cual este periodo preveemos gastar{' '}
                <strong className={spendForecast.diff >= 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {formatCurrencyLocal(Math.abs(spendForecast.diff))}
                </strong>{' '}
                <span className={spendForecast.diff >= 0 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                  {spendForecast.diff >= 0 ? 'más' : 'menos'}
                </span>{' '}
                que el anterior.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-700 mb-3">Top categorías</h3>
              <TopList items={topCategories} currency />
            </div>
            <div className="bg-white rounded-xl border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-700 mb-3">Top productos</h3>
              <TopList items={topProducts} currency />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-700 mb-3">Subidas de precio</h3>
              {priceIncreases.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {priceIncreases.map((p) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <span className="truncate max-w-[240px] text-secondary-800">{p.name}</span>
                      <span className="text-red-600 font-medium">+{formatCurrencyLocal(p.delta)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary-500">Sin subidas detectadas.</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-secondary-200 p-4">
              <h3 className="text-sm font-semibold text-secondary-700 mb-3">Frecuencia por categoría</h3>
              {categoryFrequency.length > 0 ? (
                <CategoryFrequencyList items={categoryFrequency} />
              ) : (
                <p className="text-sm text-secondary-500">Sin datos.</p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon, valueClassName }: { title: string; value: string; subtitle?: string; icon: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs text-secondary-500">{title}</div>
        <div className={`text-lg font-semibold ${valueClassName || 'text-secondary-900'}`}>{value}</div>
        {subtitle && (
          <div className="text-[11px] text-secondary-500 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  )
}

function TopList({ items, currency }: { items: TopItem[]; currency?: boolean }) {
  if (items.length === 0) {
    return <p className="text-sm text-secondary-500">Sin datos.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {item.icon && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md" style={{ backgroundColor: (item.color || '#6b7280') + '20', color: item.color || '#6b7280' }}>
                {item.icon}
              </span>
            )}
            <span className="text-secondary-800 truncate max-w-[220px]">{item.name}</span>
          </div>
          <span className="text-secondary-900 font-medium">
            {currency ? formatCurrencyLocal(item.value) : item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function MonthlySpendChart({ data, trend }: { data: MonthlySpend[]; trend?: TrendPoint[] }) {
  const width = 760
  const height = 240
  const padding = 36
  const max = Math.max(...data.map(d => d.value), 1)
  const barWidth = (width - padding * 2) / Math.max(data.length, 1)
  const chartHeight = height - padding * 2

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
      <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="12" />
      {trend && trend.length === data.length && (
        <path
          d={trend
            .map((p, i) => {
              const x = padding + i * barWidth + barWidth / 2
              const y = height - padding - (p.y / max) * chartHeight
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
            })
            .join(' ')}
          stroke="#7c3aed"
          strokeWidth="2"
          fill="none"
        />
      )}
      {data.map((d, i) => {
        const h = (d.value / max) * chartHeight
        const x = padding + i * barWidth + barWidth * 0.15
        const y = height - padding - h
        const w = barWidth * 0.7
        return <rect key={d.key} x={x} y={y} width={w} height={h} fill="#0f766e" rx="4" />
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * chartHeight
        const x = padding + i * barWidth + barWidth * 0.5
        const y = height - padding - h - 6
        return (
          <text
            key={`${d.key}-value`}
            x={x}
            y={y}
            fontSize="12"
            fill="#0f766e"
            textAnchor="middle"
          >
            {formatCurrencyLocal(d.value)}
          </text>
        )
      })}
      {data.map((d, i) => (
        <text
          key={`${d.key}-label`}
          x={padding + i * barWidth + barWidth / 2}
          y={height - 8}
          fontSize="12"
          fill="#94a3b8"
          textAnchor="middle"
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}

function formatMonthYear(dateStr: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(new Date(dateStr))
  } catch {
    return ''
  }
}

function getPeriodRange(period: 'all' | 'month' | 'quarter' | 'semester' | 'year', mode: 'current' | 'rolling') {
  if (period === 'all') return null
  if (mode === 'current') return getPeriodRangeToDate(period)
  return getRollingPeriodRange(period)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES', { useGrouping: true }).format(value)
}

function formatCurrencyLocal(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    useGrouping: true
  }).format(value)
}

function getTotalDaysForPeriod(start: Date, period: 'all' | 'month' | 'quarter' | 'semester' | 'year') {
  if (period === 'all') return 0
  if (period === 'month') {
    return new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  }
  if (period === 'quarter') {
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0)
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  if (period === 'semester') {
    const end = new Date(start.getFullYear(), start.getMonth() + 6, 0)
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  // year
  const end = new Date(start.getFullYear(), 11, 31)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function CategoryFrequencyList({ items }: { items: { name: string; count: number; icon?: string | null; color?: string | null }[] }) {
  const total = items.reduce((sum, i) => sum + i.count, 0)
  return (
    <div className="space-y-2 text-sm">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
        return (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-md"
                style={{ backgroundColor: (item.color || '#6b7280') + '20', color: item.color || '#6b7280' }}
              >
                {item.icon || '📦'}
              </span>
              <span className="text-secondary-800">{item.name}</span>
            </div>
            <span className="text-secondary-700">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

function getPeriodRangeToDate(period: 'all' | 'month' | 'quarter' | 'semester' | 'year') {
  if (period === 'all') return null
  const now = new Date()
  const end = new Date(now)

  let start: Date
  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEnd = new Date(prevStart)
    prevEnd.setDate(prevEnd.getDate() + (end.getDate() - 1))
    return { start, end, prevStart, prevEnd }
  }

  if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    start = new Date(now.getFullYear(), quarter * 3, 1)
    const prevStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1)
    const dayOffset = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const prevEnd = new Date(prevStart)
    prevEnd.setDate(prevEnd.getDate() + dayOffset)
    return { start, end, prevStart, prevEnd }
  }

  if (period === 'semester') {
    const semesterStartMonth = now.getMonth() < 6 ? 0 : 6
    start = new Date(now.getFullYear(), semesterStartMonth, 1)
    const prevStart = new Date(now.getFullYear(), semesterStartMonth - 6, 1)
    const dayOffset = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const prevEnd = new Date(prevStart)
    prevEnd.setDate(prevEnd.getDate() + dayOffset)
    return { start, end, prevStart, prevEnd }
  }

  // year
  start = new Date(now.getFullYear(), 0, 1)
  const prevStart = new Date(now.getFullYear() - 1, 0, 1)
  const dayOffset = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const prevEnd = new Date(prevStart)
  prevEnd.setDate(prevEnd.getDate() + dayOffset)
  return { start, end, prevStart, prevEnd }
}

function getRollingPeriodRange(period: 'all' | 'month' | 'quarter' | 'semester' | 'year') {
  if (period === 'all') return null
  const end = new Date()
  const start = new Date(end)
  switch (period) {
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'quarter':
      start.setMonth(start.getMonth() - 3)
      break
    case 'semester':
      start.setMonth(start.getMonth() - 6)
      break
    case 'year':
      start.setFullYear(start.getFullYear() - 1)
      break
  }
  const duration = end.getTime() - start.getTime()
  const prevStart = new Date(start.getTime() - duration)
  const prevEnd = new Date(end.getTime() - duration)
  return { start, end, prevStart, prevEnd }
}

function getPreviousFullPeriodRange(period: 'all' | 'month' | 'quarter' | 'semester' | 'year') {
  if (period === 'all') return null
  const now = new Date()

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start, end }
  }

  if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    const start = new Date(now.getFullYear(), quarter * 3 - 3, 1)
    const end = new Date(now.getFullYear(), quarter * 3, 0)
    return { start, end }
  }

  if (period === 'semester') {
    const semesterStartMonth = now.getMonth() < 6 ? 0 : 6
    const start = new Date(now.getFullYear(), semesterStartMonth - 6, 1)
    const end = new Date(now.getFullYear(), semesterStartMonth, 0)
    return { start, end }
  }

  const start = new Date(now.getFullYear() - 1, 0, 1)
  const end = new Date(now.getFullYear() - 1, 11, 31)
  return { start, end }
}

function rangeLabel(start: Date, end: Date) {
  const startText = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(start)
  const endText = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(end)
  return `${startText}–${endText}`
}

function isWithinRange(ticket: TicketRow, start: Date, end: Date) {
  const dateStr = ticket.purchase_date || ticket.created_at
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d >= start && d <= end
}

function formatComparison(diff: number, pct: number | null) {
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : ''
  const abs = Math.abs(diff)
  const pctText = pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
  return `${sign}${formatCurrencyLocal(abs)} (${pctText})`
}
