// Where dealt cards come to rest: a loose spread hanging just under the
// title. Spots are designed rather than thrown, so
// every take lands the same way. Each new card joins the row on the right and
// the row re-centres; past a full row, a new row starts below,
// covering only the bottoms of the cards above so their logos stay readable.

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
