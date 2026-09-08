const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** The only place money becomes a string. Indian grouping: ₹1,25,000. */
export function formatCurrency(amount, { compact = false, signed = false } = {}) {
  const value = Number(amount ?? 0)
  const formatted = (compact ? inrCompact : inr).format(Math.abs(value))
  if (!signed) return value < 0 ? `-${formatted}` : formatted
  return `${value < 0 ? '-' : '+'}${formatted}`
}

/** Axis labels need to stay short: ₹1.3L rather than ₹1,25,000. */
export function formatCurrencyAxis(amount) {
  return formatCurrency(amount, { compact: true })
}

export function formatPercent(value, { fractionDigits = 1 } = {}) {
  if (value === null || value === undefined) return '--'
  return `${Number(value).toFixed(fractionDigits)}%`
}

export function formatDate(isoDate) {
  if (!isoDate) return ''
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function formatLongDate(isoDate) {
  if (!isoDate) return ''
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** "2026-09" -> "Sep 26", for chart axes. */
export function formatMonthLabel(month) {
  if (!month) return ''
  const [year, monthPart] = month.split('-')
  const date = new Date(Number(year), Number(monthPart) - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

/** First and last day of a "YYYY-MM" month, as ISO dates. */
export function monthRange(month) {
  const [year, monthPart] = month.split('-').map(Number)
  const from = new Date(Date.UTC(year, monthPart - 1, 1))
  const to = new Date(Date.UTC(year, monthPart, 0))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
