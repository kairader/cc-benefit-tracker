// The "hand" shown during the demo onboarding. Only entries with a `cardId`
// have benefit data in lib/cards.ts; the rest are there to fill out the fan.
export interface HandCard {
  id: string
  name: string
  issuer: string
  // Portrait art in public/cards, rotated so the card reads top to bottom.
  image: string
  cardId?: string
}

// Ordered so light and dark faces alternate, mirrored about the centre:
// the two saturated cards (Freedom blue, Bank of America red) sit either side
// of the real cards, and the hand opens on Sapphire Preferred between Gold
// and Platinum.
export const hand: HandCard[] = [
  { id: 'bilt-mastercard', name: 'Bilt Mastercard', issuer: 'Bilt', image: 'bilt-mastercard' },
  { id: 'amex-green', name: 'Green Card', issuer: 'American Express', image: 'amex-green' },
  { id: 'united-quest', name: 'MileagePlus Quest', issuer: 'Chase', image: 'united-quest' },
  { id: 'chase-freedom', name: 'Freedom', issuer: 'Chase', image: 'chase-freedom' },
  { id: 'amex-gold', name: 'Gold Card', issuer: 'American Express', image: 'amex-gold', cardId: 'amex-gold' },
  { id: 'chase-sapphire-preferred', name: 'Sapphire Preferred', issuer: 'Chase', image: 'chase-sapphire-preferred', cardId: 'chase-sapphire-preferred' },
  { id: 'amex-platinum', name: 'Platinum Card', issuer: 'American Express', image: 'amex-platinum', cardId: 'amex-platinum' },
  { id: 'boa-cash-rewards', name: 'Cash Rewards', issuer: 'Bank of America', image: 'boa-cash-rewards' },
  { id: 'capital-one-venture-x', name: 'Venture X', issuer: 'Capital One', image: 'capital-one-venture-x' },
  { id: 'citi-strata', name: 'Strata', issuer: 'Citi', image: 'citi-strata' },
  { id: 'capital-one-quicksilver', name: 'Quicksilver', issuer: 'Capital One', image: 'capital-one-quicksilver' },
]

export const cardImage = (card: HandCard) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/cards/${card.image}.webp`
