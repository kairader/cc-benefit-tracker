'use client'

import { cards } from '@/lib/cards'
import { HomeView } from '@/components/home-view'

export default function HomePage() {
  return <HomeView cards={cards} />
}
