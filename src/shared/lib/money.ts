export function formatMoney(cents: number, currency = 'MXN'): string {
  const amount = cents / 100
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
