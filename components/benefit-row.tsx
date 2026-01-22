'use client'

import type { Benefit } from '@/lib/cards'
import { getBenefitValue } from '@/lib/cards'
import { getCurrentMonth, getCurrentYear, getPeriodLabel } from '@/lib/periods'
import type { UsageState } from '@/lib/storage'
import { getUsedPeriods } from '@/lib/storage'

type IndicatorStatus = 'used' | 'missed' | 'future' | 'current'

interface IndicatorInfo {
  period: string
  status: IndicatorStatus
  label: string
}

function getIndicators(cycle: Benefit['cycle'], usedPeriods: string[]): IndicatorInfo[] {
  const year = getCurrentYear()
  const currentMonth = getCurrentMonth()

  if (cycle === 'monthly') {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const period = `${year}-${String(month).padStart(2, '0')}`
      const label = new Date(year, i, 1).toLocaleString('default', { month: 'short' })

      let status: IndicatorStatus
      if (month > currentMonth) {
        status = 'future'
      } else if (month === currentMonth) {
        status = usedPeriods.includes(period) ? 'used' : 'current'
      } else {
        status = usedPeriods.includes(period) ? 'used' : 'missed'
      }

      return { period, status, label }
    })
  }

  if (cycle === 'quarterly') {
    const currentQuarter = Math.ceil(currentMonth / 3)
    return [1, 2, 3, 4].map((q) => {
      const period = `${year}-Q${q}`
      const label = `Q${q}`

      let status: IndicatorStatus
      if (q > currentQuarter) {
        status = 'future'
      } else if (q === currentQuarter) {
        status = usedPeriods.includes(period) ? 'used' : 'current'
      } else {
        status = usedPeriods.includes(period) ? 'used' : 'missed'
      }

      return { period, status, label }
    })
  }

  if (cycle === 'semi-annual') {
    return ['H1', 'H2'].map((half) => {
      const period = `${year}-${half}`
      const isH2 = half === 'H2'

      let status: IndicatorStatus
      if (isH2 && currentMonth <= 6) {
        status = 'future'
      } else if ((isH2 && currentMonth > 6) || (!isH2 && currentMonth <= 6)) {
        status = usedPeriods.includes(period) ? 'used' : 'current'
      } else {
        status = usedPeriods.includes(period) ? 'used' : 'missed'
      }

      return { period, status, label: half }
    })
  }

  // Annual
  const period = `${year}`
  const status: IndicatorStatus = usedPeriods.includes(period) ? 'used' : 'current'
  return [{ period, status, label: String(year) }]
}

function StreakIndicator({ indicators }: { indicators: IndicatorInfo[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {indicators.map(({ period, status, label }) => (
        <div
          key={period}
          className="flex items-center justify-center"
          title={label}
        >
          {status === 'missed' ? (
            <span className="text-[8px] leading-none text-neutral-700">×</span>
          ) : (
            <span
              className={`block w-1 h-1 rounded-full ${
                status === 'used'
                  ? 'bg-white'
                  : status === 'current'
                    ? 'bg-neutral-700'
                    : 'bg-neutral-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

interface BenefitRowProps {
  benefit: Benefit
  isUsed: boolean
  usageState: UsageState
  onToggle: () => void
}

export function BenefitRow({ benefit, isUsed, usageState, onToggle }: BenefitRowProps) {
  const month = getCurrentMonth()
  const value = getBenefitValue(benefit, month)
  const periodLabel = getPeriodLabel(benefit.cycle)
  const usedPeriods = getUsedPeriods(benefit.id, usageState)
  const indicators = getIndicators(benefit.cycle, usedPeriods)

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${isUsed ? 'Mark unused' : 'Mark used'}: ${benefit.name}`}
      className={`flex w-full items-center py-3 px-3 text-left transition-[background-color,transform,color] duration-150 hover:bg-white/5 active:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
        isUsed ? 'text-neutral-500 line-through' : 'text-white'
      }`}
    >
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span className="truncate">{benefit.name}</span>
        <span className={`text-xs shrink-0 hidden sm:inline ${isUsed ? 'text-neutral-600' : 'text-neutral-400'}`}>
          {periodLabel}
        </span>
      </span>
      <span className="ml-auto flex items-center gap-3">
        <span className="w-[90px]">
          <StreakIndicator indicators={indicators} />
        </span>
        <span className="tabular-nums w-16 text-right">${value.toFixed(value % 1 === 0 ? 0 : 2)}</span>
      </span>
    </button>
  )
}
