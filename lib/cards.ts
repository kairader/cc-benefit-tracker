export interface Benefit {
  id: string
  name: string
  value: number
  cycle: 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
  decemberValue?: number
}

export interface Card {
  id: string
  name: string
  fee: number
  hue: number
  textColor: string
  glowColor: string
  benefits: Benefit[]
}

export const cards: Card[] = [
  {
    id: 'amex-platinum',
    name: 'Amex Platinum',
    fee: 895,
    hue: 240,
    textColor: 'oklch(90% 0.02 240)',
    glowColor: 'oklch(75% 0.08 240)',
    benefits: [
      { id: 'plat-uber', name: 'Uber Cash', value: 15, cycle: 'monthly', decemberValue: 35 },
      { id: 'plat-digital', name: 'Digital Entertainment', value: 25, cycle: 'monthly' },
      { id: 'plat-walmart', name: 'Walmart+', value: 12.95, cycle: 'monthly' },
      { id: 'plat-lululemon', name: 'Lululemon', value: 75, cycle: 'quarterly' },
      { id: 'plat-resy', name: 'Resy', value: 100, cycle: 'quarterly' },
      { id: 'plat-saks', name: 'Saks', value: 50, cycle: 'semi-annual' },
      { id: 'plat-hotel', name: 'Hotel Credit', value: 300, cycle: 'semi-annual' },
      { id: 'plat-airline', name: 'Airline Fee', value: 200, cycle: 'annual' },
      { id: 'plat-clear', name: 'CLEAR Plus', value: 209, cycle: 'annual' },
      { id: 'plat-equinox', name: 'Equinox', value: 300, cycle: 'annual' },
      { id: 'plat-soulcycle', name: 'SoulCycle', value: 300, cycle: 'annual' },
      { id: 'plat-uberone', name: 'Uber One', value: 120, cycle: 'annual' },
      { id: 'plat-oura', name: 'Oura Ring', value: 200, cycle: 'annual' },
    ],
  },
  {
    id: 'amex-gold',
    name: 'Amex Gold',
    fee: 325,
    hue: 85,
    textColor: 'oklch(85% 0.05 85)',
    glowColor: 'oklch(65% 0.2 85)',
    benefits: [
      { id: 'gold-uber', name: 'Uber Cash', value: 10, cycle: 'monthly' },
      { id: 'gold-dunkin', name: 'Dunkin', value: 7, cycle: 'monthly' },
      { id: 'gold-dining', name: 'Dining Credit', value: 10, cycle: 'monthly' },
      { id: 'gold-resy', name: 'Resy', value: 50, cycle: 'semi-annual' },
    ],
  },
  {
    id: 'chase-sapphire-reserve',
    name: 'Chase Sapphire Reserve',
    fee: 795,
    hue: 260,
    textColor: 'oklch(85% 0.05 260)',
    glowColor: 'oklch(65% 0.2 260)',
    benefits: [
      { id: 'csr-doordash', name: 'DoorDash', value: 25, cycle: 'monthly' },
      { id: 'csr-lyft', name: 'Lyft', value: 10, cycle: 'monthly' },
      { id: 'csr-peloton', name: 'Peloton', value: 10, cycle: 'monthly' },
      { id: 'csr-hotel', name: 'The Edit Hotel', value: 250, cycle: 'semi-annual' },
      { id: 'csr-dining', name: 'Exclusive Tables', value: 150, cycle: 'semi-annual' },
      { id: 'csr-stubhub', name: 'StubHub', value: 150, cycle: 'semi-annual' },
      { id: 'csr-travel', name: 'Travel Credit', value: 300, cycle: 'annual' },
    ],
  },
]

export function getBenefitValue(benefit: Benefit, month: number): number {
  if (benefit.decemberValue && month === 12) {
    return benefit.decemberValue
  }
  return benefit.value
}

export function getAnnualBenefitValue(benefit: Benefit): number {
  switch (benefit.cycle) {
    case 'monthly':
      if (benefit.decemberValue) {
        return benefit.value * 11 + benefit.decemberValue
      }
      return benefit.value * 12
    case 'quarterly':
      return benefit.value * 4
    case 'semi-annual':
      return benefit.value * 2
    case 'annual':
      return benefit.value
  }
}

export function getTotalAnnualValue(): number {
  return cards.reduce((total, card) => {
    return total + card.benefits.reduce((cardTotal, benefit) => {
      return cardTotal + getAnnualBenefitValue(benefit)
    }, 0)
  }, 0)
}
