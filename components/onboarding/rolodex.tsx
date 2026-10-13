'use client'

import { animate, motion, useMotionValue, useTransform, type MotionValue, type Transition } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { HandCard } from '@/lib/demo-cards'
import { CardFace } from './card-face'
import { CARD_W, type FlickOrigin } from './card-fan'
import { fx, reducedMotion, tune, useTune } from './tune'

// The hand as an old-school rotary card file: big cards stand on a drum just
// below the bottom of the screen, so their lower edges are cut off. Each
// direction has one job: dragging down flips the front card toward you and
// brings up the one behind (the drum is a closed loop, so that reaches every
// card), and dragging up pulls the front card out of the file.

export const ROLODEX_W = 360
export const ROLODEX_H = 228

const settle: Transition = { type: 'spring', visualDuration: 0.45, bounce: 0.1 }
const snapBack = (): Transition => ({
  type: 'spring',
  visualDuration: tune.snapBackDuration.get(),
  bounce: tune.snapBackBounce.get(),
})

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const smoothstep = (t: number) => t * t * (3 - 2 * t)
// Signed distance from the front of the loop, in cards: positive is behind
// the front card, negative has already flipped forward.
const wrap = (d: number, n: number) => ((((d + n / 2) % n) + n) % n) - n / 2

// How far a card leans back (positive) or has fallen forward (negative).
function angleFor(d: number) {
  if (d >= 0) return tune.backGap.get() * smoothstep(clamp(d, 0, 1)) + d * tune.backStep.get()
  const fallen = -d
  return -(tune.flop.get() * smoothstep(clamp(fallen, 0, 1)) + Math.max(0, fallen - 1) * tune.frontStep.get())
}

// UIKit-style projection of where a released value would come to rest.
const project = (velocity: number, rate = 0.99) => ((velocity / 1000) * rate) / (1 - rate)

interface Handle {
  dragX: MotionValue<number>
  dragY: MotionValue<number>
  // 1 once the card is pulled far enough that letting go adds it.
  armed: MotionValue<number>
  el: HTMLDivElement | null
}

interface RolodexProps {
  items: HandCard[]
  // Return false to reject the card; it drops back into the file.
  onFlick: (card: HandCard, origin: FlickOrigin) => boolean
  exhale?: number
}

export function Rolodex({ items, onFlick, exhale = 0 }: RolodexProps) {
  useTune()
  // Which card is at the front, as a running count of flips. Not wrapped, so
  // a flip past the last card carries straight on to the first.
  const offset = useMotionValue(Math.max(0, items.findIndex((c) => c.cardId)))
  const handles = useRef(new Map<string, Handle>())
  const prevItems = useRef(items)
  // A small kick in the drum each time a card snaps past the front.
  const tick = useMotionValue(0)
  const breath = useMotionValue(0)
  const gesture = useRef<{
    id: number
    x: number
    y: number
    startOffset: number
    cardId: string | null
    mode: 'flip' | 'pull' | 'none' | null
    armed: boolean
    samples: { x: number; y: number; t: number }[]
  } | null>(null)

  const itemsRef = useRef(items)
  useLayoutEffect(() => {
    itemsRef.current = items
  })
  const frontIndex = () => {
    const n = itemsRef.current.length
    return ((Math.round(offset.get()) % n) + n) % n
  }

  useEffect(() => {
    let last = Math.round(offset.get())
    return offset.on('change', (v) => {
      const now = Math.round(v)
      if (now === last) return
      last = now
      const strength = fx('tick')
      if (strength > 0) animate(tick, 0, { type: 'spring', velocity: strength * 12, stiffness: 700, damping: 22 })
    })
  }, [offset, tick])

  // A two-part hint on arrival, one for each direction: the front card rises
  // partway out of the file and drops back, then the file starts to flip
  // forward and settles back. Skipped once the file has been touched.
  const touched = useRef(false)
  useEffect(() => {
    const pullHint = setTimeout(() => {
      if (touched.current || reducedMotion.get()) return
      const card = itemsRef.current[frontIndex()]
      const h = card && handles.current.get(card.id)
      if (!h) return
      animate(h.dragY, -44, { type: 'spring', visualDuration: 0.22, bounce: 0 }).then(() => {
        if (!touched.current) animate(h.dragY, 0, { type: 'spring', visualDuration: 0.5, bounce: 0.4 })
      })
    }, 900)
    const flipHint = setTimeout(() => {
      if (touched.current || reducedMotion.get()) return
      const from = offset.get()
      animate(offset, from + 0.3, { type: 'spring', visualDuration: 0.25, bounce: 0 }).then(() => {
        if (!touched.current) animate(offset, from, { type: 'spring', visualDuration: 0.5, bounce: 0.35 })
      })
    }, 2000)
    return () => {
      clearTimeout(pullHint)
      clearTimeout(flipHint)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [])

  useEffect(() => {
    if (exhale && !reducedMotion.get()) animate(breath, 0, { type: 'spring', velocity: 60, stiffness: 200, damping: 18 })
  }, [exhale, breath])

  // When the front card leaves, the one behind it is already leaning against
  // the gap; it rocks upright into the front rather than jumping there.
  useEffect(() => {
    const prev = prevItems.current
    prevItems.current = items
    if (prev === items || !items.length) return
    const n = prev.length
    const front = ((Math.round(offset.get()) % n) + n) % n
    const frontId = prev[front]?.id
    const stillThere = items.findIndex((c) => c.id === frontId)
    const frac = offset.get() - Math.round(offset.get())
    if (stillThere !== -1) {
      offset.jump(stillThere + frac)
      return
    }
    // The card that stood behind the one removed now has its index.
    const next = front % items.length
    offset.jump(next - 1 + frac)
    animate(offset, next, { type: 'spring', visualDuration: 0.4, bounce: 0.2 })
  }, [items, offset])

  const register = useCallback((id: string, handle: Handle | null) => {
    if (handle) handles.current.set(id, handle)
    else handles.current.delete(id)
  }, [])

  // Release velocity from the last ~80ms of movement.
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
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId
    const cardId = hit && items.some((c) => c.id === hit) ? hit : null
    offset.stop()
    if (cardId) handles.current.get(cardId)?.dragY.stop()
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startOffset: offset.get(),
      cardId,
      mode: null,
      armed: false,
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

    if (!g.mode) {
      if (Math.hypot(dx, dy) < 6) return
      // Mostly sideways does nothing. Otherwise the direction decides,
      // wherever the drag starts: up pulls the front card, down flips.
      if (Math.abs(dx) > Math.abs(dy) * 1.2) g.mode = 'none'
      else if (dy < 0) {
        g.mode = 'pull'
        g.cardId = items[frontIndex()]?.id ?? null
        if (g.cardId) handles.current.get(g.cardId)?.dragY.stop()
      } else g.mode = 'flip'
    }

    if (g.mode === 'flip') {
      offset.set(g.startOffset + dy / tune.flipDistance.get())
    } else if (g.mode === 'pull') {
      const h = g.cardId ? handles.current.get(g.cardId) : null
      if (!h) return
      // It slides straight up the rail at first and only follows the finger
      // sideways once it's clear of the file.
      h.dragY.set(dy < 0 ? dy : dy * 0.15)
      h.dragX.set(dx * clamp(-dy / 120, 0, 1))
      // Past the line it unclips from the rail with a small pop, so you know
      // letting go will add it.
      const armed = dy < -tune.flickDistance.get()
      if (armed !== g.armed) {
        g.armed = armed
        animate(h.armed, armed ? 1 : 0, { type: 'spring', visualDuration: 0.25, bounce: armed ? 0.5 : 0 })
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const { vx, vy } = velocity()
    gesture.current = null
    const dy = e.clientY - g.y
    const card = g.cardId ? items.find((c) => c.id === g.cardId) : undefined
    const h = g.cardId ? handles.current.get(g.cardId) : undefined

    if (g.mode === 'flip') {
      coast(vy)
      return
    }
    if (offset.get() !== Math.round(offset.get())) animate(offset, Math.round(offset.get()), settle)

    if (!g.mode || g.mode === 'none') {
      if (g.mode || !card || !h) return
      // A tap on any other card flips the file to it; a tap on the front card
      // lifts it a little, as a hint that it pulls out.
      const index = items.indexOf(card)
      const n = items.length
      const d = wrap(index - offset.get(), n)
      if (Math.abs(d) > 0.5) {
        animate(offset, Math.round(offset.get() + d), settle)
      } else if (!reducedMotion.get()) {
        animate(h.dragY, -36, { type: 'spring', visualDuration: 0.16, bounce: 0 }).then(() =>
          animate(h.dragY, 0, { type: 'spring', visualDuration: 0.4, bounce: 0.45 }),
        )
      }
      return
    }

    if (!card || !h) return
    animate(h.armed, 0, { duration: 0.2 })
    const isFlick =
      dy < -tune.flickDistance.get() ||
      (dy < -12 && (vy < -tune.flickVelocity.get() || dy + project(vy) < -tune.flickProjection.get()))
    if (isFlick && h.el) {
      const rect = h.el.getBoundingClientRect()
      const accepted = onFlick(card, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rotate: 0,
        scale: ROLODEX_W / CARD_W,
        pitch: tune.tilt.get(),
        vx,
        vy,
        vr: 0,
      })
      if (accepted) return
      if (reducedMotion.get()) animate(h.dragX, 0, snapBack())
      else animate(h.dragX, [h.dragX.get(), -14, 11, -6, 3, 0], { duration: 0.5, ease: 'easeOut' })
      animate(h.dragY, 0, { ...snapBack(), velocity: vy })
    } else {
      animate(h.dragX, 0, { ...snapBack(), velocity: vx })
      animate(h.dragY, 0, { ...snapBack(), velocity: vy })
    }
  }

  // A fling keeps the drum turning with friction and stops exactly on a card.
  const coast = (vy: number) => {
    const from = offset.get()
    const v = vy / tune.flipDistance.get() // cards per second
    const target = Math.round(from + tune.coast.get() * v)
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

  const drumTilt = useTransform(() => tune.tilt.get() + tick.get())

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        perspective: tune.camera.get(),
        perspectiveOrigin: `50% calc(100% - ${tune.axle.get() + tune.cameraHeight.get()}px)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          originY: `calc(100% - ${tune.axle.get()}px)`,
          rotateX: drumTilt,
          y: breath,
        }}
      >
        {items.map((card, index) => (
          <FileCard key={card.id} card={card} index={index} count={items.length} offset={offset} register={register} />
        ))}
      </motion.div>
    </div>
  )
}

interface FileCardProps {
  card: HandCard
  index: number
  count: number
  offset: MotionValue<number>
  register: (id: string, handle: Handle | null) => void
}

function FileCard({ card, index, count, offset, register }: FileCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const armed = useMotionValue(0)
  const scale = useTransform(armed, (a) => 1 + a * 0.04)
  useTune()

  const d = useTransform(() => wrap(index - offset.get(), count))
  const rotateX = useTransform(() => angleFor(d.get()))
  // Cards behind stand a step taller, like index tabs, so their tops show
  // above the front card.
  const y = useTransform(() => dragY.get() - tune.peek.get() * clamp(d.get(), 0, 4))
  // Cards further back sit in the drum's shadow.
  const shade = useTransform(d, (v) => (v > 0 ? Math.min(0.6, v * 0.14) : 0))
  // Fade before the loop wraps a card from the far front to the far back.
  // Only the last few flipped cards show, so the front of the file stays quiet.
  const fade = useTransform(d, (v) => clamp((v < 0 ? 3.5 : 5) - Math.abs(v), 0, 1) * clamp((count / 2 - Math.abs(v)) * 2, 0, 1))
  const display = useTransform(fade, (v) => (v > 0 ? 'block' : 'none'))
  const hub = tune.hubRadius.get()

  useEffect(() => {
    register(card.id, { dragX, dragY, armed, el: ref.current })
    return () => register(card.id, null)
  }, [card.id, register, dragX, dragY, armed])

  // Opacity would flatten the 3D, so it goes on the two faces, not the card.
  return (
    <motion.div
      className="absolute left-1/2"
      style={{
        bottom: tune.axle.get() + hub,
        width: ROLODEX_W,
        height: ROLODEX_H,
        marginLeft: -ROLODEX_W / 2,
        // Turns about the drum's axle, below the card's bottom edge.
        originY: `${ROLODEX_H + hub}px`,
        transformStyle: 'preserve-3d',
        x: dragX,
        y,
        scale,
        rotateX,
        display,
      }}
    >
      <motion.div
        ref={ref}
        data-card-id={card.id}
        className="absolute inset-0 rounded-[14px] [transform-style:preserve-3d]"
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', visualDuration: 0.45, bounce: 0.2 }}
      >
        <motion.div className="absolute inset-0 rounded-[14px] [backface-visibility:hidden]" style={{ opacity: fade }}>
          <CardFace card={card} />
          <motion.div className="pointer-events-none absolute inset-0 rounded-[14px] bg-black" style={{ opacity: shade }} />
        </motion.div>
        {/* The back, seen on cards that have flipped forward. */}
        <motion.div
          className="absolute inset-0 rounded-[14px] border border-white/10 bg-neutral-900 [backface-visibility:hidden] [transform:rotateX(180deg)]"
          style={{ opacity: fade }}
        >
          <div className="absolute inset-x-0 top-5 h-7 bg-black/60" />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
