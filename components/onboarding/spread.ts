// Where dealt cards come to rest. Spots are designed rather than thrown, so
// every take lands the same way. The stack at the end of this file is the
// layout; the angled spread is the earlier one, kept to compare (tune:
// Angled spread). It hangs just under the title: each new card joins the row
// on the right and the row re-centres; past a full row, a new row starts
// below, covering only the bottoms of the cards above so their logos stay
// readable.

export interface Spot {
  x: number
  y: number
  rotate: number
}

export interface Zone {
  top: number
  centerX: number
}

export interface SpreadOptions {
  cardH: number
  step: number
  rowStep: number
  perRow: number
  scatter: number
}

// A hand-placed look: small alternating turns and nudges, the same every time.
const TURN = [-4, 3, -2, 4, -3, 2, -4, 3, -1, 4, -3]
const NUDGE = [0, -3, 2, -2, 3, -1, 2, -3, 1, -2, 3]

export function spreadSpot(index: number, count: number, zone: Zone, o: SpreadOptions): Spot {
  const row = Math.floor(index / o.perRow)
  const col = index % o.perRow
  const inRow = Math.min(o.perRow, count - row * o.perRow)
  const firstRowY = zone.top + o.cardH / 2
  const k = index % TURN.length
  return {
    x: zone.centerX + (col - (inRow - 1) / 2) * o.step,
    y: firstRowY + row * o.rowStep + (NUDGE[k] * o.scatter) / 4,
    rotate: (TURN[k] * o.scatter) / 4,
  }
}

export interface StackOptions {
  cardH: number
  peek: number
  // Lowest the stack's front card may reach, in screen px.
  bottom: number
}

// The stack the dealt cards build, like cards in Wallet: square, centred
// under the title, each new card in front of and a little below the last,
// so every card's top edge and logo stays in view. With many cards the tops
// tighten so the stack never reaches the drum.
export function stackSpot(index: number, count: number, zone: Zone, o: StackOptions): Spot {
  const room = o.bottom - zone.top - o.cardH
  const peek = count > 1 ? Math.max(0, Math.min(o.peek, room / (count - 1))) : o.peek
  return {
    x: zone.centerX,
    y: zone.top + o.cardH / 2 + index * peek,
    rotate: 0,
  }
}
