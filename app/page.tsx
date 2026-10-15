'use client'

import { cards } from '@/lib/cards'
import { HomeView } from '@/components/home-view'
import { SafariEdges } from '@/components/safari-edges'

export default function HomePage() {
  return (
    <>
      <HomeView cards={cards} />
      <SafariEdges />
    </>
  )
}
