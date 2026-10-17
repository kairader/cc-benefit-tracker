'use client'

import dynamic from 'next/dynamic'
import { MotionConfig } from 'framer-motion'

// Client-only: the hand's layout is computed from motion values, so there's
// nothing useful to server-render and the float maths would mismatch on hydration.
const Onboarding = dynamic(() => import('@/components/onboarding/onboarding').then((m) => m.Onboarding), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-neutral-950" />,
})

export default function OnboardingPage() {
  // Framer Motion ignores the CSS reduced-motion rule unless told to follow it.
  return (
    <MotionConfig reducedMotion="user">
      <Onboarding />
    </MotionConfig>
  )
}
