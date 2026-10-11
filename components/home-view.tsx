'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Card } from '@/lib/cards'
import { getBenefitValue } from '@/lib/cards'
import { getUsageState, toggleBenefitUsage, isBenefitUsed } from '@/lib/storage'
import type { UsageState } from '@/lib/storage'
import { getCurrentPeriod, getCurrentMonth } from '@/lib/periods'
import { CardSection } from '@/components/card-section'
import { AnimatedNumber } from '@/components/animated-number'

function calculateProgress(cards: Card[], usageState: UsageState) {
  const month = getCurrentMonth()
  let totalAnnualFees = 0
  let claimedValue = 0

  for (const card of cards) {
    totalAnnualFees += card.fee

    for (const benefit of card.benefits) {
      const period = getCurrentPeriod(benefit.cycle)
      if (isBenefitUsed(benefit.id, period, usageState)) {
        claimedValue += getBenefitValue(benefit, month)
      }
    }
  }

  return { totalAnnualFees, claimedValue }
}

interface HomeViewProps {
  cards: Card[]
  // Set by the onboarding demo: 'hidden' lays the screen out invisibly so the
  // flying cards can measure where their glow bars sit, 'revealed' fades it in.
  intro?: 'hidden' | 'revealed'
  // The yearly value the onboarding found, shown under the total.
  found?: number
}

export function HomeView({ cards, intro, found }: HomeViewProps) {
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

  const { totalAnnualFees, claimedValue } = calculateProgress(cards, usageState)

  // Trigger celebration when reaching 100% (only on increase, not on page load)
  useEffect(() => {
    if (mounted && claimedValue >= totalAnnualFees && totalAnnualFees > 0 && prevClaimedRef.current < totalAnnualFees) {
      setCelebrating(true)
      const timer = setTimeout(() => setCelebrating(false), 500)
      return () => clearTimeout(timer)
    }
    prevClaimedRef.current = claimedValue
  }, [claimedValue, totalAnnualFees, mounted])

  if (!mounted) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="h-8 bg-neutral-800 rounded w-48 mb-12" />
        </div>
      </main>
    )
  }

  const hidden = intro === 'hidden'

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Only the onboarding reveals the screen; ordinary opens show it at once. */}
        <header className="mb-12">
          <p
            className={`text-2xl font-medium text-white ${hidden ? 'opacity-0' : intro ? 'reveal-total' : ''} ${celebrating ? 'animate-celebrate' : ''}`}
          >
            {hidden ? '$0' : <AnimatedNumber value={claimedValue} animateOnMount />} / ${totalAnnualFees.toLocaleString()}
          </p>
          {found !== undefined && (
            <p className="mt-1 text-sm text-neutral-400">
              {/* The onboarding's loading total flies into this spot, so it
                  shows straight away rather than fading in. */}
              <span data-found-value className={hidden ? 'opacity-0' : ''}>
                ${Math.round(found).toLocaleString()}
              </span>{' '}
              <span className={hidden ? 'opacity-0' : 'reveal-fade'} style={{ animationDelay: '60ms' }}>
                in benefits a year
              </span>
            </p>
          )}
        </header>

        {cards.map((card, index) => (
          <CardSection
            key={card.id}
            card={card}
            usageState={usageState}
            onToggleBenefit={handleToggle}
            index={index}
            celebrating={celebrating}
            intro={intro}
          />
        ))}
      </div>
    </main>
  )
}
