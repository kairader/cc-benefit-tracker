import { CARD_H, CARD_W } from './card-fan'

// Where dealt cards come to rest. There are no slots: each card lands where
// its flick carries it, and the spot is nudged just enough that every card
// underneath stays readable.

export interface Placed {
  x: number
  y: number
  rotate: number
}

export interface Zone {
  left: number
  top: number
  right: number
  bottom: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const rad = (deg: number) => (deg * Math.PI) / 180

// Points spread over a card, in its own space, used to measure how much of it
// is still showing.
const SAMPLES: [number, number][] = []
for (let i = 0; i < 6; i++) {
  for (let j = 0; j < 9; j++) SAMPLES.push([(i + 0.5) / 6 - 0.5, (j + 0.5) / 9 - 0.5])
}

function covers(card: Placed, w: number, h: number, px: number, py: number) {
  const t = rad(-card.rotate)
  const dx = px - card.x
  const dy = py - card.y
  const lx = dx * Math.cos(t) - dy * Math.sin(t)
  const ly = dx * Math.sin(t) + dy * Math.cos(t)
  return Math.abs(lx) < w / 2 && Math.abs(ly) < h / 2
}

// Share of a card left uncovered by the cards dealt after it.
function visible(card: Placed, above: Placed[], w: number, h: number) {
  const t = rad(card.rotate)
  let shown = 0
  for (const [sx, sy] of SAMPLES) {
    const lx = sx * w
    const ly = sy * h
    const px = card.x + lx * Math.cos(t) - ly * Math.sin(t)
    const py = card.y + lx * Math.sin(t) + ly * Math.cos(t)
    if (!above.some((c) => covers(c, w, h, px, py))) shown++
  }
  return shown / SAMPLES.length
}

// The worst-off card in the pile if `next` were dealt on top.
function worst(pile: Placed[], next: Placed, w: number, h: number) {
  let min = 1
  const stack = [...pile, next]
  for (let i = 0; i < pile.length; i++) min = Math.min(min, visible(pile[i], stack.slice(i + 1), w, h))
  return min
}

// Searches outward from where the flick would naturally leave the card for the
// nearest spot that keeps at least `reveal` of every card showing. If the
// pile is too full for that, it takes the spot that hides the least.
export function place(ideal: Placed, pile: Placed[], zone: Zone, scale: number, reveal: number): Placed {
  const w = CARD_W * scale
  const h = CARD_H * scale
  const fit = (x: number, y: number): Placed => ({
    x: clamp(x, zone.left + w / 2, zone.right - w / 2),
    y: clamp(y, zone.top + h / 2, zone.bottom - h / 2),
    rotate: ideal.rotate,
  })
  let best = fit(ideal.x, ideal.y)
  let bestScore = worst(pile, best, w, h)
  if (bestScore >= reveal) return best
  // Start each ring at a random angle so nudges don't all lean one way.
  const turn = Math.random()
  for (let r = 10; r <= 300; r += 10) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 24))
    for (let k = 0; k < steps; k++) {
      const a = (k / steps + turn) * 2 * Math.PI
      const spot = fit(ideal.x + r * Math.cos(a), ideal.y + r * Math.sin(a))
      const score = worst(pile, spot, w, h)
      if (score >= reveal) return spot
      if (score > bestScore) {
        best = spot
        bestScore = score
      }
    }
  }
  return best
}
