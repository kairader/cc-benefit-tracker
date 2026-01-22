import type { Benefit } from './cards'

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1
}

export function getCurrentYear(): number {
  return new Date().getFullYear()
}

export function getCurrentQuarter(): number {
  const month = getCurrentMonth()
  return Math.ceil(month / 3)
}

export function getCurrentPeriod(cycle: Benefit['cycle']): string {
  const year = getCurrentYear()
  const month = getCurrentMonth()

  switch (cycle) {
    case 'monthly':
      return `${year}-${String(month).padStart(2, '0')}`
    case 'quarterly':
      return `${year}-Q${getCurrentQuarter()}`
    case 'semi-annual':
      // H1: Jan-Jun, H2: Jul-Dec
      return month <= 6 ? `${year}-H1` : `${year}-H2`
    case 'annual':
      return `${year}`
  }
}

export function getPeriodLabel(cycle: Benefit['cycle']): string {
  const year = getCurrentYear()
  const month = getCurrentMonth()

  switch (cycle) {
    case 'monthly':
      return new Date().toLocaleString('default', { month: 'short' })
    case 'quarterly':
      return `Q${getCurrentQuarter()}`
    case 'semi-annual':
      return month <= 6 ? 'H1' : 'H2'
    case 'annual':
      return String(year)
  }
}
