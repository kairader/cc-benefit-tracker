export interface UsageState {
  [benefitId: string]: {
    periods: string[] // ["2025-01", "2025-02", ...] | ["2025-H1", "2025-H2"] | ["2025"]
  }
}

// Legacy interface for migration
interface LegacyUsageState {
  [benefitId: string]: {
    period: string
  }
}

const STORAGE_KEY = 'credit-tracker-usage'

function migrateState(stored: unknown): UsageState {
  if (!stored || typeof stored !== 'object') return {}

  const result: UsageState = {}

  for (const [benefitId, value] of Object.entries(stored as Record<string, unknown>)) {
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>
      // Check if it's legacy format (has 'period' string)
      if ('period' in v && typeof v.period === 'string') {
        result[benefitId] = { periods: [v.period] }
      }
      // Check if it's new format (has 'periods' array)
      else if ('periods' in v && Array.isArray(v.periods)) {
        result[benefitId] = { periods: v.periods }
      }
    }
  }

  return result
}

export function getUsageState(): UsageState {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    return migrateState(parsed)
  } catch {
    return {}
  }
}

export function setUsageState(state: UsageState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

export function toggleBenefitUsage(benefitId: string, period: string): UsageState {
  const state = getUsageState()

  const periods = state[benefitId]?.periods ?? []
  const index = periods.indexOf(period)

  if (index >= 0) {
    // Already used in this period, remove it
    periods.splice(index, 1)
    if (periods.length === 0) {
      delete state[benefitId]
    } else {
      state[benefitId] = { periods }
    }
  } else {
    // Mark as used in this period
    state[benefitId] = { periods: [...periods, period] }
  }

  setUsageState(state)
  return state
}

export function isBenefitUsed(benefitId: string, period: string, state: UsageState): boolean {
  return state[benefitId]?.periods?.includes(period) ?? false
}

export function getUsedPeriods(benefitId: string, state: UsageState): string[] {
  return state[benefitId]?.periods ?? []
}
