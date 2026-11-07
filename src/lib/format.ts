import type { ActivityKind, Expense, PageId } from '../types'

export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatRs(amount: number) {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `Rs ${formatted}`
}

export function formatHeaderDate(d = new Date()) {
  return d
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase()
}

export function formatStamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function formatDay(value: string) {
  const d = value.length <= 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function monthPrefix(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function spentThisMonth(expenses: Pick<Expense, 'amount' | 'date'>[], d = new Date()) {
  const prefix = monthPrefix(d)
  return expenses.reduce((sum, expense) => (expense.date.startsWith(prefix) ? sum + expense.amount : sum), 0)
}

export function excerpt(text: string, n = 120) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= n) return clean
  return `${clean.slice(0, n - 1).trimEnd()}…`
}

export function matchesQuery(query: string, parts: Array<string | number | undefined>) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return parts
    .filter((part) => part != null && part !== '')
    .join('\n')
    .toLowerCase()
    .includes(needle)
}

export function pageForKind(kind: ActivityKind): PageId {
  switch (kind) {
    case 'note':
      return 'notes'
    case 'task':
      return 'tasks'
    case 'document':
      return 'documents'
    case 'expense':
      return 'expenses'
    case 'event':
      return 'calendar'
    case 'vault':
      return 'vault'
    case 'gallery':
      return 'gallery'
    case 'keep':
      return 'save'
    case 'inbox':
      return 'save'
    case 'folder':
      return 'vault'
  }
}

export function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100
}
