// The "hand" shown during the demo onboarding. Only entries with a `cardId`
// have benefit data in lib/cards.ts; the rest are there to fill out the fan.
export interface HandCard {
  id: string
  name: string
  issuer: string
  hue: number
  cardId?: string
}

// The real cards sit together in the middle so the demo starts on them.
export const hand: HandCard[] = [
  { id: 'chase-freedom-unlimited', name: 'Freedom Unlimited', issuer: 'Chase', hue: 250 },
  { id: 'capital-one-venture-x', name: 'Venture X', issuer: 'Capital One', hue: 30 },
  { id: 'chase-sapphire-reserve', name: 'Sapphire Reserve', issuer: 'Chase', hue: 260 },
  { id: 'citi-strata-premier', name: 'Strata Premier', issuer: 'Citi', hue: 200 },
  { id: 'amex-gold', name: 'Gold Card', issuer: 'American Express', hue: 85, cardId: 'amex-gold' },
  { id: 'amex-platinum', name: 'Platinum Card', issuer: 'American Express', hue: 240, cardId: 'amex-platinum' },
  { id: 'chase-sapphire-preferred', name: 'Sapphire Preferred', issuer: 'Chase', hue: 220, cardId: 'chase-sapphire-preferred' },
  { id: 'bilt-mastercard', name: 'Bilt Mastercard', issuer: 'Bilt', hue: 0 },
  { id: 'amex-green', name: 'Green Card', issuer: 'American Express', hue: 150 },
  { id: 'hilton-aspire', name: 'Hilton Aspire', issuer: 'American Express', hue: 300 },
  { id: 'apple-card', name: 'Apple Card', issuer: 'Goldman Sachs', hue: 120 },
]
