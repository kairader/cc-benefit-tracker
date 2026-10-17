'use client'

import { motion } from 'framer-motion'
import type { Card } from '@/lib/cards'
import type { UsageState } from '@/lib/storage'
import { isBenefitUsed } from '@/lib/storage'
import { getCurrentPeriod } from '@/lib/periods'
import { BenefitRow } from './benefit-row'

interface CardSectionProps {
  card: Card
  usageState: UsageState
  onToggleBenefit: (benefitId: string, period: string) => void
  index?: number
  celebrating?: boolean
  intro?: 'hidden' | 'revealed'
}

export function CardSection({ card, usageState, onToggleBenefit, index = 0, celebrating = false, intro }: CardSectionProps) {
  // Sort benefits: unused first, then used
  const sortedBenefits = [...card.benefits].sort((a, b) => {
    const aUsed = isBenefitUsed(a.id, getCurrentPeriod(a.cycle), usageState)
    const bUsed = isBenefitUsed(b.id, getCurrentPeriod(b.cycle), usageState)
    if (aUsed === bUsed) return 0
    return aUsed ? 1 : -1
  })

  // During the onboarding intro the glow bar is where the flying card lands,
  // so it stays put while the name rises in and the benefits fade in after it.
  // Ordinary opens skip the reveal.
  const nameAt = 120 + index * 60
  const reveal = (className: string, delay: number) =>
    intro === 'hidden'
      ? { className: 'opacity-0' }
      : intro
        ? { className, style: { animationDelay: `${delay}ms` } }
        : {}
  const name = reveal('reveal-name', nameAt)

  return (
    <section className="mb-8">
      <div className="flex items-center py-2 mb-2">
        <div
          data-glow-bar={card.id}
          className={`w-1 self-stretch rounded-full bg-white ${celebrating ? 'animate-glow-pulse' : ''} ${intro === 'hidden' ? 'opacity-0' : ''}`}
          style={{
            boxShadow: `
              0 0 3px 1px ${card.glowColor},
              0 0 8px 2px ${card.glowColor},
              0 0 20px 4px ${card.glowColor.replace(')', ' / 0.5)')},
              0 0 40px 8px ${card.glowColor.replace(')', ' / 0.3)')}
            `
          }}
        />
        <h2 className={`text-base font-medium pl-2 ${name.className ?? ''}`} style={{ color: card.textColor, ...name.style }}>{card.name}</h2>
      </div>
      <div className={intro === 'hidden' ? 'opacity-0' : ''}>
        {sortedBenefits.map((benefit, row) => {
          const period = getCurrentPeriod(benefit.cycle)
          const isUsed = isBenefitUsed(benefit.id, period, usageState)

          return (
            <motion.div
              key={benefit.id}
              {...(intro === 'revealed' ? reveal('reveal-fade', nameAt + 40 + row * 30) : {})}
              layout
              initial={false}
              animate={{ opacity: 1 }}
              transition={{
                layout: { type: 'spring', duration: 0.2, bounce: 0 },
                opacity: { duration: 0.15 }
              }}
              whileTap={{ opacity: 0.7 }}
            >
              <BenefitRow
                benefit={benefit}
                isUsed={isUsed}
                usageState={usageState}
                onToggle={() => onToggleBenefit(benefit.id, period)}
              />
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
