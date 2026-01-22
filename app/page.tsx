'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cards, getBenefitValue, getAnnualBenefitValue } from '@/lib/cards'
import { getUsageState, toggleBenefitUsage, isBenefitUsed } from '@/lib/storage'
import type { UsageState } from '@/lib/storage'
import { getCurrentPeriod, getCurrentMonth } from '@/lib/periods'
import { CardSection } from '@/components/card-section'
import { AnimatedNumber } from '@/components/animated-number'

function calculateProgress(usageState: UsageState) {
  const month = getCurrentMonth()
  let totalAnnualValue = 0
  let claimedValue = 0

  for (const card of cards) {
    for (const benefit of card.benefits) {
      totalAnnualValue += getAnnualBenefitValue(benefit)

      const period = getCurrentPeriod(benefit.cycle)
      if (isBenefitUsed(benefit.id, period, usageState)) {
        claimedValue += getBenefitValue(benefit, month)
      }
    }
  }

  return { totalAnnualValue, claimedValue }
}

export default function HomePage() {
  const [usageState, setUsageState] = useState<UsageState>({})
  const [mounted, setMounted] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const prevClaimedRef = useRef<number>(0)

  useEffect(() => {
    setUsageState(getUsageState())
    setMounted(true)
  }, [])

  const handleToggle = useCallback((benefitId: string, period: string) => {
    const newState = toggleBenefitUsage(benefitId, period)
    setUsageState({ ...newState })
  }, [])

  const { totalAnnualValue, claimedValue } = calculateProgress(usageState)

  // Trigger celebration when reaching 100% (only on increase, not on page load)
  useEffect(() => {
    if (mounted && claimedValue === totalAnnualValue && totalAnnualValue > 0 && prevClaimedRef.current < totalAnnualValue) {
      setCelebrating(true)
      const timer = setTimeout(() => setCelebrating(false), 500)
      return () => clearTimeout(timer)
    }
    prevClaimedRef.current = claimedValue
  }, [claimedValue, totalAnnualValue, mounted])

  if (!mounted) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="h-8 bg-neutral-800 rounded w-48 mb-12" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8">
      <div className="max-w-md mx-auto">
        <header className="mb-12 animate-fade-in">
          <p className={`text-2xl font-semibold text-white ${celebrating ? 'animate-celebrate' : ''}`}>
            <AnimatedNumber value={claimedValue} animateOnMount /> / ${totalAnnualValue.toFixed(0)}
          </p>
        </header>

        {cards.map((card, index) => (
          <CardSection
            key={card.id}
            card={card}
            usageState={usageState}
            onToggleBenefit={handleToggle}
            index={index}
            celebrating={celebrating}
          />
        ))}
      </div>
    </main>
  )
}
