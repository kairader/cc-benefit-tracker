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
import { useCallback, useEffect, useRef } from 'react'
import type { HandCard } from '@/lib/demo-cards'
import { CardFace } from './card-face'

export const CARD_W = 150
export const CARD_H = 238

// Cards sit on an arc around a pivot well below the screen, like a hand of cards.
const RADIUS = 760
const STEP = 6.2 // degrees between neighbouring cards
const STEP_RAD = (STEP * Math.PI) / 180
const SPACING = RADIUS * STEP_RAD // px of horizontal drag per card
const LIFT = 14 // how far the focused card rises out of the hand
// Extra room the neighbours make on either side of the focused card.
const SPREAD = (3.4 * Math.PI) / 180
const FLICK_PROJECTION = -100 // where a released card would coast to, in px, to count as a flick
const FLICK_DISTANCE = 60 // or how far it was pulled
const FLICK_VELOCITY = 250 // or how fast it was moving upward (px/s)

// Springs described by how long they take to settle and how much they overshoot,
// the same way UIKit describes them (response + damping ratio).
const settle: Transition = { type: 'spring', visualDuration: 0.5, bounce: 0.12 }
const snapBack: Transition = { type: 'spring', visualDuration: 0.45, bounce: 0.3 }

export interface FlickOrigin {
  x: number
  y: number
  rotate: number
  scale: number
  vx: number
  vy: number
}

interface CardHandle {
  dragX: MotionValue<number>
  dragY: MotionValue<number>
  rotate: MotionValue<number>
  scale: MotionValue<number>
  el: HTMLDivElement | null
}

interface CardFanProps {
  items: HandCard[]
  // Return false to reject the card; it bounces back into the hand.
  onFlick: (card: HandCard, origin: FlickOrigin) => boolean
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const smoothstep = (t: number) => t * t * (3 - 2 * t)

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

export function CardFan({ items, onFlick }: CardFanProps) {
  const offset = useMotionValue(Math.floor((items.length - 1) / 2))
  const handles = useRef(new Map<string, CardHandle>())
  const flicked = useRef(new Set<string>())
  const prevItems = useRef(items)
  const gesture = useRef<{
    id: number
    x: number
    y: number
    startOffset: number
    cardId: string | null
    axis: 'x' | 'y' | null
    samples: { x: number; y: number; t: number }[]
  } | null>(null)

  // The whole hand leans into fast swipes and settles back upright.
  const offsetVelocity = useVelocity(offset)
  const lean = useSpring(useTransform(offsetVelocity, (v) => clamp(-v * 1.6, -7, 7)), {
    stiffness: 300,
    damping: 30,
  })

  // Keep the focused card in focus as the hand changes. When the focused card
  // was flicked away, its neighbour slides into the gap instead.
  useEffect(() => {
    const prev = prevItems.current
    prevItems.current = items
    if (prev === items) return
    const max = Math.max(0, items.length - 1)
    const focusedId = prev[Math.round(offset.get())]?.id
    const stillThere = items.findIndex((c) => c.id === focusedId)
    let target: number
    if (stillThere !== -1) target = stillThere
    else if (focusedId && flicked.current.has(focusedId)) target = nearestAddable(items, Math.round(offset.get()))
    else target = Math.floor(max / 2)
    animate(offset, target, { type: 'spring', visualDuration: 0.35, bounce: 0.1 })
  }, [items, offset])

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
    e.currentTarget.setPointerCapture(e.pointerId)
    // Cards that just left the hand can linger for a frame on their way out; ignore them.
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId
    const cardId = hit && items.some((c) => c.id === hit) ? hit : nearestCardTo(e.clientX, e.clientY)
    offset.stop()
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startOffset: offset.get(),
      cardId: cardId ?? null,
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
    }

    if (g.axis === 'x') {
      offset.set(rubberBand(g.startOffset - dx / SPACING, items.length - 1))
    } else {
      const h = g.cardId ? handles.current.get(g.cardId) : null
      if (!h) return
      // The card stays under the finger; pushing it down into the hand resists.
      h.dragY.set(dy < 0 ? dy : dy * 0.15)
      h.dragX.set(dx)
    }
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
        animate(h.dragY, -36, { type: 'spring', visualDuration: 0.16, bounce: 0 }).then(() =>
          animate(h.dragY, 0, { type: 'spring', visualDuration: 0.4, bounce: 0.45 }),
        )
      }
      return
    }

    if (g.axis === 'x') {
      const cardVelocity = -vx / SPACING
      const target = clamp(Math.round(offset.get() + project(cardVelocity * 1000, 0.995) / 1000), 0, max)
      animate(offset, target, { ...settle, velocity: cardVelocity })
      return
    }

    if (!card || !h) return
    // Generous on purpose: a card pulled well clear of the hand, a quick upward
    // throw, or one that would coast past the line all count.
    const isFlick =
      dy < -FLICK_DISTANCE || (dy < -12 && (vy < -FLICK_VELOCITY || dy + project(vy) < FLICK_PROJECTION))
    if (isFlick && h.el) {
      const rect = h.el.getBoundingClientRect()
      flicked.current.add(card.id)
      const accepted = onFlick(card, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rotate: h.rotate.get(),
        scale: h.scale.get(),
        vx,
        vy,
      })
      if (accepted) return
      flicked.current.delete(card.id)
      // Not in the demo data: it refuses to leave and drops back into the hand.
      animate(h.dragX, [h.dragX.get(), -14, 11, -6, 3, 0], { duration: 0.5, ease: 'easeOut' })
      animate(h.dragY, 0, { ...snapBack, velocity: vy })
      return
    }
    animate(h.dragX, 0, { ...snapBack, velocity: vx })
    animate(h.dragY, 0, { ...snapBack, velocity: vy })
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
          <FanCard key={card.id} card={card} index={index} offset={offset} lean={lean} register={register} />
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
  register: (id: string, handle: CardHandle | null) => void
}

function FanCard({ card, index, offset, lean, register }: FanCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useSpring(index, { stiffness: 520, damping: 44 })
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)

  useEffect(() => {
    slot.set(index)
  }, [index, slot])

  // Each card trails the finger very slightly, which reads as mass.
  const d = useSpring(
    useTransform(() => slot.get() - offset.get()),
    { stiffness: 900, damping: 60 },
  )
  const focus = useTransform(d, (v) => 1 - smoothstep(clamp(Math.abs(v), 0, 1)))
  const lifted = useTransform(dragY, (v) => clamp(-v / 160, 0, 1))

  // A held card tips in the direction it's moving, like it's pinched at the top.
  const swing = useSpring(
    useTransform(useVelocity(dragX), (v) => clamp(v * 0.018, -16, 16)),
    { stiffness: 400, damping: 22 },
  )
  const pitch = useSpring(
    useTransform(useVelocity(dragY), (v) => clamp(-v * 0.01, -14, 14)),
    { stiffness: 400, damping: 24 },
  )

  // Neighbours part around the focused card; the gap opens and closes smoothly
  // as a card passes through the middle.
  const angle = useTransform(() => {
    const v = d.get()
    return v * STEP_RAD + Math.sign(v) * SPREAD * smoothstep(clamp(Math.abs(v), 0, 1))
  })
  const x = useTransform(() => RADIUS * Math.sin(angle.get()) + dragX.get())
  const y = useTransform(
    () => RADIUS * (1 - Math.cos(angle.get())) - LIFT * focus.get() + dragY.get(),
  )
  const rotate = useTransform(
    () => ((angle.get() * 180) / Math.PI + lean.get()) * (1 - lifted.get()) + swing.get(),
  )
  const scale = useTransform(() => 1 + 0.04 * focus.get() + 0.06 * lifted.get())
  const zIndex = useTransform(() => (dragY.get() < -2 ? 300 : 100 - Math.round(Math.abs(d.get()) * 10)))
  const shade = useTransform(d, (v) => Math.min(0.55, Math.abs(v) * 0.14))
  const fade = useTransform(d, (v) => clamp(6 - Math.abs(v), 0, 1))
  const shadow = useTransform(() => {
    const l = Math.max(focus.get() * 0.4, lifted.get())
    return `0 ${10 + l * 30}px ${24 + l * 40}px -8px rgba(0,0,0,${0.7 + l * 0.2})`
  })

  useEffect(() => {
    register(card.id, { dragX, dragY, rotate, scale, el: ref.current })
    return () => register(card.id, null)
  }, [card.id, register, dragX, dragY, rotate, scale])

  return (
    <motion.div
      className="absolute bottom-[250px] left-1/2"
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
        <motion.div
          ref={ref}
          data-card-id={card.id}
          className="relative h-full w-full rounded-[12px]"
          style={{ boxShadow: shadow }}
        >
          <CardFace card={card} />
          <motion.div className="pointer-events-none absolute inset-0 rounded-[12px] bg-black" style={{ opacity: shade }} />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
