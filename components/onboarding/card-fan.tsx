'use client'

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
  type Transition,
} from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { HandCard } from '@/lib/demo-cards'
import { CardFace } from './card-face'
import { fx, reducedMotion, tune, useTune } from './tune'

export const CARD_W = 208
export const CARD_H = 132

// Cards sit on an arc around a pivot well below the screen, like a hand of
// cards. Radius, spacing, the gap around the centre card and the lift all
// come from the tuning panel (./tune).

const settle: Transition = { type: 'spring', visualDuration: 0.5, bounce: 0.12 }
const snapBack = (): Transition => ({
  type: 'spring',
  visualDuration: tune.snapBackDuration.get(),
  bounce: tune.snapBackBounce.get(),
})

export interface FlickOrigin {
  x: number
  y: number
  rotate: number
  scale: number
  pitch: number
  vx: number
  vy: number
  vr: number
}

interface CardHandle {
  dragX: MotionValue<number>
  dragY: MotionValue<number>
  rotate: MotionValue<number>
  scale: MotionValue<number>
  pitch: MotionValue<number>
  pinX: MotionValue<number>
  pinY: MotionValue<number>
  pinRotate: MotionValue<number>
  pinScale: MotionValue<number>
  side: MotionValue<number>
  fold: () => void
  el: HTMLDivElement | null
}

interface CardFanProps {
  items: HandCard[]
  // Return false to reject the card; it bounces back into the hand.
  onFlick: (card: HandCard, origin: FlickOrigin) => boolean
  // Bump to have the whole hand settle with a small dip, once the cards that
  // matter are all in.
  exhale?: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const smoothstep = (t: number) => t * t * (3 - 2 * t)
const rad = (deg: number) => (deg * Math.PI) / 180

// Angle on the arc of a card `d` places from the centre, with the neighbours
// parted around the centre card.
function angleFor(d: number) {
  return d * rad(tune.step.get()) + Math.sign(d) * rad(tune.spread.get()) * smoothstep(clamp(Math.abs(d), 0, 1))
}
const xFor = (d: number) => tune.radius.get() * Math.sin(angleFor(d))
const slopeAt = (d: number) => (xFor(d + 0.01) - xFor(d - 0.01)) / 0.02

// Which position on the arc puts a card at screen x. The arc is monotonic up to
// a quarter turn, so a bisection finds it; past that, extend it in a line.
function dFor(x: number) {
  const limit = (80 - tune.spread.get()) / tune.step.get()
  const edge = xFor(limit)
  if (Math.abs(x) > edge) return Math.sign(x) * (limit + (Math.abs(x) - edge) / slopeAt(limit))
  let lo = -limit
  let hi = limit
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (xFor(mid) < x) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// iOS-style rubber banding: resistance grows the further past the edge you pull.
function rubberBand(v: number, max: number) {
  const band = (over: number) => (1 - 1 / ((over * 0.55) / 2 + 1)) * 2
  if (v < 0) return -band(-v)
  if (v > max) return max + band(v - max)
  return v
}

// Where a moving value comes to rest given its release velocity (UIKit's
// projection with a fast deceleration rate).
const project = (velocity: number, rate = 0.99) => ((velocity / 1000) * rate) / (1 - rate)

// After a card leaves the hand, bring the closest card that can be added to the
// front so the next flick works, rather than leaving a filler card in focus.
function nearestAddable(items: HandCard[], from: number) {
  let best = clamp(from, 0, Math.max(0, items.length - 1))
  let bestDistance = Infinity
  items.forEach((c, i) => {
    const distance = Math.abs(i - from + 0.1) // ties go left, toward the cards already passed
    if (c.cardId && distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

export function CardFan({ items, onFlick, exhale = 0 }: CardFanProps) {
  useTune()
  const offset = useMotionValue(Math.floor((items.length - 1) / 2))
  const handles = useRef(new Map<string, CardHandle>())
  const flicked = useRef(new Set<string>())
  const prevItems = useRef(items)
  // How far the held card has been lifted (0 to 1); the rest of the hand
  // starts closing the gap it will leave.
  const hold = useMotionValue(0)
  // A short pop on the centre card each time a new card passes through it.
  const tick = useMotionValue(0)
  const breath = useMotionValue(0)
  const gesture = useRef<{
    id: number
    x: number
    y: number
    startOffset: number
    cardId: string | null
    lockIndex: number
    axis: 'x' | 'y' | null
    samples: { x: number; y: number; t: number }[]
  } | null>(null)

  // The whole hand leans into fast swipes and settles back upright.
  const offsetVelocity = useVelocity(offset)
  const lean = useSpring(
    useTransform(() => clamp(-offsetVelocity.get() * fx('lean'), -7, 7)),
    { stiffness: 300, damping: 30 },
  )

  useEffect(() => {
    let last = Math.round(offset.get())
    return offset.on('change', (v) => {
      const now = Math.round(v)
      if (now === last) return
      last = now
      const strength = fx('tick')
      if (strength > 0) animate(tick, 0, { type: 'spring', velocity: strength * 40, stiffness: 700, damping: 24 })
    })
  }, [offset, tick])

  const itemsRef = useRef(items)
  useLayoutEffect(() => {
    itemsRef.current = items
  })

  // A hint on arrival: the front card hops up and drops back, showing that
  // cards lift out of the hand. Skipped once the hand has been touched.
  const touched = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (touched.current || reducedMotion.get()) return
      const card = itemsRef.current[Math.round(offset.get())]
      const h = card && handles.current.get(card.id)
      if (!h) return
      animate(h.dragY, -44, { type: 'spring', visualDuration: 0.22, bounce: 0 }).then(() => {
        if (!touched.current) animate(h.dragY, 0, { type: 'spring', visualDuration: 0.5, bounce: 0.4 })
      })
    }, 900)
    return () => clearTimeout(timer)
  }, [offset])

  useEffect(() => {
    if (exhale && !reducedMotion.get()) animate(breath, 0, { type: 'spring', velocity: 60, stiffness: 200, damping: 18 })
  }, [exhale, breath])

  // Keep the focused card in focus as the hand changes. When the focused card
  // was flicked away, its neighbour slides into the gap instead.
  useEffect(() => {
    const prev = prevItems.current
    prevItems.current = items
    if (prev === items) return
    // The hand had already started closing up around a lifted card; carry that
    // into the new layout so nothing jumps.
    for (const h of handles.current.values()) h.fold()
    hold.jump(0)
    const max = Math.max(0, items.length - 1)
    const focusedId = prev[Math.round(offset.get())]?.id
    const stillThere = items.findIndex((c) => c.id === focusedId)
    let target: number
    if (stillThere !== -1) target = stillThere
    else if (focusedId && flicked.current.has(focusedId)) target = nearestAddable(items, Math.round(offset.get()))
    else target = Math.floor(max / 2)
    animate(offset, target, { type: 'spring', visualDuration: 0.35, bounce: 0.1 })
  }, [items, offset, hold])

  // A touch that lands in a gap (say, while the hand is closing up after a
  // card leaves) still picks up the card nearest the finger.
  const nearestCardTo = (x: number, y: number) => {
    let best: string | undefined
    let bestDistance = Infinity
    for (const [id, h] of handles.current) {
      if (!items.some((c) => c.id === id)) continue
      const r = h.el?.getBoundingClientRect()
      if (!r || y < r.top - 24 || y > r.bottom + 24) continue
      const distance = Math.abs(r.left + r.width / 2 - x)
      if (distance < r.width && distance < bestDistance) {
        best = id
        bestDistance = distance
      }
    }
    return best
  }

  const register = useCallback((id: string, handle: CardHandle | null) => {
    if (handle) handles.current.set(id, handle)
    else handles.current.delete(id)
  }, [])

  // Release velocity from the last ~80ms of movement, so a finger that slows
  // before lifting doesn't read as a fast throw.
  const velocity = () => {
    const s = gesture.current?.samples ?? []
    if (s.length < 2) return { vx: 0, vy: 0 }
    const last = s[s.length - 1]
    const first = s.find((p) => last.t - p.t <= 80) ?? s[0]
    if (first === last) return { vx: 0, vy: 0 }
    const dt = Math.max(8, last.t - first.t) / 1000
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current) return
    touched.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    // Cards that just left the hand can linger for a frame on their way out; ignore them.
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId
    const cardId = hit && items.some((c) => c.id === hit) ? hit : nearestCardTo(e.clientX, e.clientY)
    offset.stop()
    // Catch a card mid-hop (the arrival hint, or a tap's hop) where it is.
    if (cardId) handles.current.get(cardId)?.dragY.stop()
    const index = items.findIndex((c) => c.id === cardId)
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startOffset: offset.get(),
      cardId: cardId ?? null,
      lockIndex: index !== -1 ? index : Math.round(offset.get()),
      axis: null,
      samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    g.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    if (g.samples.length > 12) g.samples.shift()

    if (!g.axis) {
      if (Math.hypot(dx, dy) < 5) return
      // Anything more upward than sideways on a card picks the card up.
      g.axis = g.cardId && dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.8 ? 'y' : 'x'
      if (g.axis === 'y') startHold(g.cardId!, g.x, g.y)
    }

    if (g.axis === 'x') {
      const max = items.length - 1
      if (tune.fingerLock.get()) {
        // Move the hand so the card that was touched stays exactly under the finger.
        const d0 = g.lockIndex - g.startOffset
        const d = dFor(xFor(d0) + dx)
        offset.set(rubberBand(g.lockIndex - d, max))
      } else {
        offset.set(rubberBand(g.startOffset - dx / tune.swipeDistance.get(), max))
      }
    } else {
      const h = g.cardId ? handles.current.get(g.cardId) : null
      if (!h) return
      // The card stays under the finger; pushing it down into the hand resists.
      h.dragY.set(dy < 0 ? dy : dy * 0.15)
      h.dragX.set(dx)
      hold.set(clamp(-dy / 160, 0, 1))
    }
  }

  // Pin the card where it was grabbed, and tell the rest of the hand which
  // side of the gap they're on.
  const startHold = (cardId: string, x: number, y: number) => {
    const held = items.findIndex((c) => c.id === cardId)
    items.forEach((c, i) => handles.current.get(c.id)?.side.set(Math.sign(i - held)))
    const h = handles.current.get(cardId)
    const r = h?.el?.getBoundingClientRect()
    if (!h || !r || !tune.pin.get()) return
    h.pinRotate.set(h.rotate.get())
    h.pinScale.set(h.scale.get())
    h.pinX.set(x - (r.left + r.width / 2))
    h.pinY.set(y - (r.top + r.height / 2))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const { vx, vy } = velocity()
    gesture.current = null
    const dy = e.clientY - g.y
    const max = items.length - 1
    const card = g.cardId ? items.find((c) => c.id === g.cardId) : undefined
    const h = g.cardId ? handles.current.get(g.cardId) : undefined

    // A touch can land while the hand is still settling; make sure it finishes on a card.
    if (g.axis !== 'x' && offset.get() !== Math.round(offset.get())) {
      animate(offset, clamp(Math.round(offset.get()), 0, max), settle)
    }

    if (!g.axis) {
      // A tap brings a card to the front; tapping the front card hops it up
      // as a hint that it can be flicked.
      if (!card || !h) return
      const index = items.indexOf(card)
      if (index !== Math.round(offset.get())) {
        animate(offset, index, settle)
      } else {
        if (reducedMotion.get()) return
        animate(h.dragY, -36, { type: 'spring', visualDuration: 0.16, bounce: 0 }).then(() =>
          animate(h.dragY, 0, { type: 'spring', visualDuration: 0.4, bounce: 0.45 }),
        )
      }
      return
    }

    if (g.axis === 'x') {
      coast(vx, g.lockIndex)
      return
    }

    if (!card || !h) return
    // Generous on purpose: a card pulled well clear of the hand, a quick upward
    // throw, or one that would coast past the line all count.
    const isFlick =
      dy < -tune.flickDistance.get() ||
      (dy < -12 && (vy < -tune.flickVelocity.get() || dy + project(vy) < -tune.flickProjection.get()))
    if (isFlick && h.el) {
      const rect = h.el.getBoundingClientRect()
      flicked.current.add(card.id)
      const accepted = onFlick(card, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rotate: h.rotate.get(),
        scale: h.scale.get(),
        pitch: h.pitch.get(),
        vx,
        vy,
        vr: h.rotate.getVelocity(),
      })
      if (accepted) return
      flicked.current.delete(card.id)
      // Not in the demo data: it refuses to leave and drops back into the hand.
      if (reducedMotion.get()) animate(h.dragX, 0, snapBack())
      else animate(h.dragX, [h.dragX.get(), -14, 11, -6, 3, 0], { duration: 0.5, ease: 'easeOut' })
      animate(h.dragY, 0, { ...snapBack(), velocity: vy })
    } else {
      animate(h.dragX, 0, { ...snapBack(), velocity: vx })
      animate(h.dragY, 0, { ...snapBack(), velocity: vy })
    }
    animate(h.pinX, 0, snapBack())
    animate(h.pinY, 0, snapBack())
    animate(hold, 0, snapBack())
  }

  // Let a fling carry the hand with friction, then come to rest exactly on a
  // card. The glide starts at the finger's speed and takes as long as the
  // distance needs, rather than a fixed-length spring.
  const coast = (vx: number, lockIndex: number) => {
    const max = items.length - 1
    const from = offset.get()
    const slope = tune.fingerLock.get() ? slopeAt(lockIndex - from) : tune.swipeDistance.get()
    const v = -vx / slope // cards per second
    if (from < 0 || from > max) {
      animate(offset, clamp(Math.round(from), 0, max), { ...settle, velocity: v })
      return
    }
    const target = clamp(Math.round(from + tune.coast.get() * v), 0, max)
    const distance = target - from
    const timeConstant =
      Math.abs(v) > 0.05 && Math.sign(distance) === Math.sign(v) ? clamp((distance / v) * 1000, 90, 700) : 200
    animate(offset, target, {
      type: 'inertia',
      velocity: v,
      power: 1,
      timeConstant,
      modifyTarget: () => target,
      restDelta: 0.001,
    })
  }

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <AnimatePresence custom={flicked}>
        {items.map((card, index) => (
          <FanCard
            key={card.id}
            card={card}
            index={index}
            offset={offset}
            lean={lean}
            hold={hold}
            tick={tick}
            breath={breath}
            register={register}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface FanCardProps {
  card: HandCard
  index: number
  offset: MotionValue<number>
  lean: MotionValue<number>
  hold: MotionValue<number>
  tick: MotionValue<number>
  breath: MotionValue<number>
  register: (id: string, handle: CardHandle | null) => void
}

function FanCard({ card, index, offset, lean, hold, tick, breath, register }: FanCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useSpring(index, { stiffness: 520, damping: 44 })
  const indexRef = useRef(index)
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  // Where the card was grabbed, relative to its centre, and how it sat then.
  const pinX = useMotionValue(0)
  const pinY = useMotionValue(0)
  const pinRotate = useMotionValue(0)
  const pinScale = useMotionValue(1)
  // -1 left of the held card, 1 right of it, 0 for the held card itself.
  const side = useMotionValue(0)

  useEffect(() => {
    indexRef.current = index
    slot.set(index)
  }, [index, slot])

  // Cards on either side of a lifted card drift together to close its gap.
  const shift = useTransform(() => (-side.get() * hold.get() * tune.close.get()) / 2)
  // Exact distance from the centre of the hand: no trailing spring, so the
  // touched card stays under the finger. Weight comes from the release.
  const d = useTransform(() => slot.get() + shift.get() - offset.get())
  const focus = useTransform(d, (v) => 1 - smoothstep(clamp(Math.abs(v), 0, 1)))
  const lifted = useTransform(dragY, (v) => clamp(-v / 160, 0, 1))

  useTune()
  // A held card tips in the direction it's moving.
  const swing = useSpring(
    useTransform(useVelocity(dragX), (v) => clamp((v * fx('swing')) / 1000, -16, 16)),
    { stiffness: tune.swingStiffness.get(), damping: tune.swingDamping.get() },
  )
  const pitch = useSpring(
    useTransform(useVelocity(dragY), (v) => clamp((-v * fx('pitch')) / 1000, -14, 14)),
    { stiffness: 400, damping: 24 },
  )
  // Held off-centre, the card hangs a little from the grab point.
  const hang = useTransform(
    () => ((fx('hang') * Math.atan2(-pinX.get(), Math.abs(pinY.get()) + 40) * 180) / Math.PI) * lifted.get(),
  )

  const angle = useTransform(() => angleFor(d.get()))
  const rotate = useTransform(
    () => ((angle.get() * 180) / Math.PI + lean.get()) * (1 - lifted.get()) + swing.get() + hang.get(),
  )
  const scale = useTransform(() => 1 + 0.04 * focus.get() + tune.holdScale.get() * lifted.get())

  // Turning and scaling happen about the card's centre; shift the card so the
  // point under the finger stays put, as if it pivots where it's pinched.
  const pinOffset = (axis: 'x' | 'y') => {
    const px = pinX.get()
    const py = pinY.get()
    if (!px && !py) return 0
    const t = rad(rotate.get() - pinRotate.get())
    const k = scale.get() / pinScale.get()
    return axis === 'x'
      ? px - k * (px * Math.cos(t) - py * Math.sin(t))
      : py - k * (px * Math.sin(t) + py * Math.cos(t))
  }
  const x = useTransform(() => tune.radius.get() * Math.sin(angle.get()) + dragX.get() + pinOffset('x'))
  const y = useTransform(
    () =>
      tune.radius.get() * (1 - Math.cos(angle.get())) -
      (tune.lift.get() + tick.get()) * focus.get() +
      breath.get() +
      dragY.get() +
      pinOffset('y'),
  )
  const zIndex = useTransform(() => (dragY.get() < -2 ? 300 : 100 - Math.round(Math.abs(d.get()) * 10)))
  const shade = useTransform(d, (v) => Math.min(0.55, Math.abs(v) * 0.14))
  const fade = useTransform(d, (v) => clamp(6 - Math.abs(v), 0, 1))
  // Cards past the screen edge drop out of rendering, so the hand only keeps
  // GPU layers for the cards you can see.
  const display = useTransform(() =>
    fade.get() > 0 && Math.abs(x.get()) < window.innerWidth / 2 + CARD_W * 0.7 ? 'block' : 'none',
  )

  useEffect(() => {
    const fold = () => {
      const s = shift.get()
      side.set(0)
      if (!s) return
      slot.jump(slot.get() + s)
      slot.set(indexRef.current)
    }
    register(card.id, {
      dragX,
      dragY,
      rotate,
      scale,
      pitch,
      pinX,
      pinY,
      pinRotate,
      pinScale,
      side,
      fold,
      el: ref.current,
    })
    return () => register(card.id, null)
  }, [card.id, register, dragX, dragY, rotate, scale, pitch, pinX, pinY, pinRotate, pinScale, side, shift, slot])

  return (
    <motion.div
      className="absolute bottom-[248px] left-1/2"
      style={{
        width: CARD_W,
        height: CARD_H,
        marginLeft: -CARD_W / 2,
        marginBottom: -CARD_H / 2,
        x,
        y,
        rotate,
        rotateX: pitch,
        transformPerspective: 900,
        scale,
        zIndex,
        opacity: fade,
        display,
      }}
    >
      <motion.div
        variants={{
          enter: { opacity: 0, y: 120 },
          present: { opacity: 1, y: 0 },
          exit: (flicked: React.RefObject<Set<string>>) =>
            flicked.current.has(card.id)
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 120, transition: { type: 'spring', visualDuration: 0.3, bounce: 0 } },
        }}
        initial="enter"
        animate="present"
        exit="exit"
        transition={{ type: 'spring', visualDuration: 0.45, bounce: 0.2 }}
        className="h-full w-full"
      >
        <div ref={ref} data-card-id={card.id} className="relative h-full w-full rounded-[12px]">
          <CardFace card={card} />
          <motion.div className="pointer-events-none absolute inset-0 rounded-[12px] bg-black" style={{ opacity: shade }} />
        </div>
      </motion.div>
    </motion.div>
  )
}
