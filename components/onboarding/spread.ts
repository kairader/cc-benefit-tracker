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

export interface RowOptions {
  cardW: number
  cardH: number
  gap: number
  perRow: number
}

// Whole small cards side by side, like a collection laid out on a table:
// each row centred, a new row below once one fills. Nothing overlaps and
// nothing turns, so the picks read as a set apart from the drum.
export function rowSpot(index: number, count: number, zone: Zone, o: RowOptions): Spot {
  const row = Math.floor(index / o.perRow)
  const col = index % o.perRow
  const inRow = Math.min(o.perRow, count - row * o.perRow)
  return {
    x: zone.centerX + (col - (inRow - 1) / 2) * (o.cardW + o.gap),
    y: zone.top + o.cardH / 2 + row * (o.cardH + o.gap),
    rotate: 0,
  }
}

export interface OverlapOptions {
  cardW: number
  step: number
  // Widest the row may get, in px.
  maxWidth: number
}

// One straight row of cards laid over each other left to right, the newest
// on top, each showing its left edge like a hand set down on the table.
// The edges tighten when the row would outgrow the screen.
export function overlapSpot(index: number, count: number, zone: Zone, o: OverlapOptions & { cardH: number }): Spot {
  const step = count > 1 ? Math.min(o.step, (o.maxWidth - o.cardW) / (count - 1)) : o.step
  return {
    x: zone.centerX + (index - (count - 1) / 2) * step,
    y: zone.top + o.cardH / 2,
    rotate: 0,
  }
}

// Where a card goes before its row settles: the open place straight after
// the last settled card in its row, or the middle of a new row. Settled
// cards stay put while it's on its way; once it lands, the row centres
// itself again with it included.
export function openRowSpot(index: number, settled: number, zone: Zone, o: RowOptions): Spot {
  const row = Math.floor(index / o.perRow)
  const step = o.cardW + o.gap
  const y = zone.top + o.cardH / 2 + row * (o.cardH + o.gap)
  if (settled > 0 && row === Math.floor((settled - 1) / o.perRow)) {
    const last = rowSpot(settled - 1, settled, zone, o)
    return { x: last.x + (index - settled + 1) * step, y, rotate: 0 }
  }
  return { x: zone.centerX + (index % o.perRow) * step, y, rotate: 0 }
}

// The widest card that keeps the open place on screen when a row is one card
// short of full: the settled cards centred, the open place hanging after them.
export function rowFitWidth(perRow: number, gap: number, halfWidth: number) {
  return (halfWidth - (perRow * gap) / 2) / ((perRow + 1) / 2)
}
