'use client'

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'
import type { HandCard } from '@/lib/demo-cards'
import { CardFace } from './card-face'

export const CARD_W = 236
export const CARD_H = 149

// The hand pivots around a point well below the screen, like cards held in a fist.
const RADIUS = 620
const STEP = 8.5 // degrees between neighbouring cards
const SPACING = (RADIUS * STEP * Math.PI) / 180 // px of horizontal drag per card
const LIFT = 26 // how far the focused card rises out of the hand
const FLICK_DISTANCE = 110
const FLICK_VELOCITY = 500

export interface FlickOrigin {
  x: number
  y: number
  rotate: number
  scale: number
  vx: number
  vy: number
}

interface CardHandle {
  x: MotionValue<number>
  y: MotionValue<number>
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

function rubberBand(v: number, max: number) {
  if (v < 0) return v * 0.35
  if (v > max) return max + (v - max) * 0.35
  return v
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
    else if (focusedId && flicked.current.has(focusedId)) target = clamp(Math.round(offset.get()), 0, max)
    else target = Math.floor(max / 2)
    animate(offset, target, { type: 'spring', stiffness: 220, damping: 30 })
  }, [items, offset])

  const register = useCallback((id: string, handle: CardHandle | null) => {
    if (handle) handles.current.set(id, handle)
    else handles.current.delete(id)
  }, [])

  const velocity = () => {
    const s = gesture.current?.samples ?? []
    if (s.length < 2) return { vx: 0, vy: 0 }
    const last = s[s.length - 1]
    const first = s.find((p) => last.t - p.t < 100) ?? s[0]
    const dt = Math.max(1, last.t - first.t) / 1000
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const cardEl = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]')
    offset.stop()
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startOffset: offset.get(),
      cardId: cardEl?.dataset.cardId ?? null,
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
    if (g.samples.length > 8) g.samples.shift()

    if (!g.axis) {
      if (Math.hypot(dx, dy) < 6) return
      g.axis = g.cardId && Math.abs(dy) > Math.abs(dx) * 1.1 ? 'y' : 'x'
    }

    if (g.axis === 'x') {
      offset.set(rubberBand(g.startOffset - dx / SPACING, items.length - 1))
    } else {
      const h = g.cardId ? handles.current.get(g.cardId) : null
      if (!h) return
      h.y.set(dy < 0 ? dy : dy * 0.2)
      h.x.set(dx * 0.5)
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

    if (!g.axis) {
      // A tap brings a card to the front; tapping the front card nudges it
      // upward as a hint that it can be flicked.
      if (!card || !h) return
      const index = items.indexOf(card)
      if (index !== Math.round(offset.get())) {
        animate(offset, index, { type: 'spring', stiffness: 220, damping: 30 })
      } else {
        animate(h.y, [0, -34, 0], { duration: 0.5, ease: [0.3, 0, 0.2, 1] })
      }
      return
    }

    if (g.axis === 'x') {
      const cardVelocity = -vx / SPACING
      const target = clamp(Math.round(offset.get() + cardVelocity * 0.18), 0, max)
      animate(offset, target, { type: 'spring', stiffness: 220, damping: 30, velocity: cardVelocity })
      return
    }

    if (!card || !h) return
    const isFlick = dy < -20 && (dy < -FLICK_DISTANCE || vy < -FLICK_VELOCITY)
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
      // Not in the demo data: shake it off and drop it back into the hand.
      animate(h.x, [h.x.get(), -12, 10, -6, 0], { duration: 0.45 })
      animate(h.y, 0, { type: 'spring', stiffness: 300, damping: 18, velocity: vy })
      return
    }
    animate(h.x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    animate(h.y, 0, { type: 'spring', stiffness: 400, damping: 26, velocity: vy })
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
          <FanCard key={card.id} card={card} index={index} offset={offset} register={register} />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface FanCardProps {
  card: HandCard
  index: number
  offset: MotionValue<number>
  register: (id: string, handle: CardHandle | null) => void
}

function FanCard({ card, index, offset, register }: FanCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const slot = useSpring(index, { stiffness: 260, damping: 30 })
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  useEffect(() => {
    slot.set(index)
  }, [index, slot])

  const d = useTransform(() => slot.get() - offset.get())
  const focus = useTransform(d, (v) => Math.max(0, 1 - Math.abs(v)))
  // As a card is pulled out of the hand it straightens up.
  const straighten = useTransform(y, (v) => clamp(-v / 140, 0, 1))
  const rotate = useTransform(() => d.get() * STEP * (1 - straighten.get()))
  const lift = useTransform(() => y.get() - LIFT * focus.get())
  const scale = useTransform(() => 1 + 0.05 * focus.get() + 0.04 * straighten.get())
  const zIndex = useTransform(() => (y.get() < -2 ? 300 : 100 - Math.round(Math.abs(d.get()) * 10)))
  const shade = useTransform(d, (v) => Math.min(0.5, Math.abs(v) * 0.16))
  const fade = useTransform(d, (v) => clamp(5.5 - Math.abs(v), 0, 1))

  useEffect(() => {
    register(card.id, { x, y, rotate, scale, el: ref.current })
    return () => register(card.id, null)
  }, [card.id, register, x, y, rotate, scale])

  return (
    <motion.div
      className="absolute left-1/2 top-[46%]"
      style={{
        width: CARD_W,
        height: CARD_H,
        marginLeft: -CARD_W / 2,
        marginTop: -CARD_H / 2,
        rotate,
        zIndex,
        opacity: fade,
        transformOrigin: `50% ${CARD_H / 2 + RADIUS}px`,
      }}
    >
      <motion.div
        variants={{
          enter: { opacity: 0, y: 60 },
          present: { opacity: 1, y: 0 },
          exit: (flicked: React.RefObject<Set<string>>) =>
            flicked.current.has(card.id)
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 60, transition: { duration: 0.2, ease: 'easeIn' } },
        }}
        initial="enter"
        animate="present"
        exit="exit"
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="h-full w-full"
      >
        <motion.div
          ref={ref}
          data-card-id={card.id}
          className="relative h-full w-full rounded-[12px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)]"
          style={{ x, y: lift, scale }}
        >
          <CardFace card={card} />
          <motion.div className="pointer-events-none absolute inset-0 rounded-[12px] bg-black" style={{ opacity: shade }} />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
