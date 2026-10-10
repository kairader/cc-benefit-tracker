'use client'

import { AnimatePresence, motion, type Transition } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cards, type Benefit, type Card } from '@/lib/cards'
import { hand, type HandCard } from '@/lib/demo-cards'
import { AnimatedNumber } from '@/components/animated-number'
import { HomeView } from '@/components/home-view'
import { CardFace } from './card-face'
import { CardFan, CARD_H, CARD_W, type FlickOrigin } from './card-fan'

type Phase = 'pick' | 'loading' | 'landing' | 'home'

interface Picked {
  card: HandCard
  // Only the cards in lib/cards.ts have benefits; the rest still go in the
  // wallet but bow out before the home screen.
  data?: Card
  origin: FlickOrigin
}

const SLOT_W = 40
const SLOT_GAP = 8
const MIN_SLOTS = hand.filter((c) => c.cardId).length
// 7/6 makes the front card 280 tall, so the stack's edges land on the 4px grid.
const STACK_SCALE = 7 / 6
const LOADING_MS = 1700

const PER_YEAR: Record<Benefit['cycle'], number> = { monthly: 12, quarterly: 4, 'semi-annual': 2, annual: 1 }

interface Target {
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotate: number
  radius: number
  faceOpacity: number
  opacity: number
  transition: Transition
}

function useViewport() {
  const [size, setSize] = useState({ w: 402, h: 874 })
  useLayoutEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

export function Onboarding() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [picked, setPicked] = useState<Picked[]>([])
  const [slotRects, setSlotRects] = useState<DOMRect[]>([])
  const [barRects, setBarRects] = useState<Record<string, DOMRect>>({})
  const [tick, setTick] = useState(0)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const viewport = useViewport()

  // The wallet row grows as cards are added past the three placeholders, and
  // the slots shrink to keep it on screen.
  const slotCount = Math.max(MIN_SLOTS, picked.length)
  const slotW = Math.min(SLOT_W, (viewport.w - 32 - (slotCount - 1) * SLOT_GAP) / slotCount)
  const slotH = Math.round((slotW * CARD_H) / CARD_W / 4) * 4
  // Loading stack centre, snapped to the 4px grid.
  const stackY = Math.round((viewport.h * 0.36) / 4) * 4

  useLayoutEffect(() => {
    setSlotRects(slotRefs.current.slice(0, slotCount).map((el) => el!.getBoundingClientRect()))
  }, [viewport, slotCount])

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.card.id)), [picked])
  const items = useMemo(() => hand.filter((c) => !pickedIds.has(c.id)), [pickedIds])

  const handleFlick = useCallback((card: HandCard, origin: FlickOrigin) => {
    const data = cards.find((c) => c.id === card.cardId)
    setPicked((prev) => [...prev, { card, data, origin }])
    return true
  }, [])

  // Every benefit across the picked cards, in the order they tick past while loading.
  const benefits = useMemo(() => picked.flatMap((p) => p.data?.benefits ?? []), [picked])
  const foundValue = benefits
    .slice(0, tick)
    .reduce((sum, b) => sum + b.value * PER_YEAR[b.cycle], 0)

  useEffect(() => {
    if (phase !== 'loading') return
    const interval = LOADING_MS / Math.max(1, benefits.length)
    const timer = setInterval(() => {
      setTick((t) => {
        if (t >= benefits.length) {
          clearInterval(timer)
          return t
        }
        return t + 1
      })
    }, interval)
    const done = setTimeout(() => {
      const rects: Record<string, DOMRect> = {}
      for (const { data } of picked) {
        const el = data && document.querySelector(`[data-glow-bar="${data.id}"]`)
        if (data && el) rects[data.id] = el.getBoundingClientRect()
      }
      setBarRects(rects)
      setPhase('landing')
    }, LOADING_MS + 450)
    return () => {
      clearInterval(timer)
      clearTimeout(done)
    }
  }, [phase, benefits.length, picked])

  useEffect(() => {
    if (phase !== 'landing') return
    const timer = setTimeout(() => setPhase('home'), 650 + picked.length * 80)
    return () => clearTimeout(timer)
  }, [phase, picked.length])

  const targetFor = (index: number, origin: FlickOrigin, at: Phase = phase): Target => {
    const base = { width: CARD_W, height: CARD_H, radius: 12, faceOpacity: 1, opacity: 1 }
    if (at === 'pick') {
      const slot = slotRects[index]
      return {
        ...base,
        x: slot ? slot.left + slot.width / 2 : viewport.w / 2,
        y: slot ? slot.top + slot.height / 2 : 120,
        scale: slotW / CARD_W,
        rotate: 0,
        radius: 4,
        transition: {
          type: 'spring',
          stiffness: 240,
          damping: 24,
          x: { type: 'spring', stiffness: 240, damping: 26, velocity: origin.vx },
          y: { type: 'spring', stiffness: 240, damping: 24, velocity: origin.vy },
        },
      }
    }
    if (at === 'loading') {
      const n = picked.length
      const fromTop = n - 1 - index
      return {
        ...base,
        x: viewport.w / 2 + (index - (n - 1) / 2) * 8,
        y: stackY - fromTop * 12,
        scale: STACK_SCALE - fromTop * 0.05,
        rotate: (index - (n - 1) / 2) * 4,
        radius: 16,
        transition: { type: 'spring', stiffness: 200, damping: 24, delay: index * 0.05 },
      }
    }
    const data = picked[index].data
    const bar = data && barRects[data.id]
    if (!bar) {
      // No benefits to show: sink back into the stack and fade.
      const stack = targetFor(index, origin, 'loading')
      return { ...stack, scale: stack.scale * 0.85, opacity: 0, transition: { type: 'spring', visualDuration: 0.3, bounce: 0 } }
    }
    return {
      x: bar.left + bar.width / 2,
      y: bar.top + bar.height / 2,
      width: bar.width,
      height: bar.height,
      scale: 1,
      rotate: 0,
      radius: 2,
      faceOpacity: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 210,
        damping: 28,
        delay: (picked.length - 1 - index) * 0.08,
      },
    }
  }

  const homeCards = picked.flatMap((p) => (p.data ? [p.data] : []))
  const showOverlay = phase !== 'home'

  return (
    <>
      {phase !== 'pick' && <HomeView cards={homeCards} intro={phase === 'home' ? 'revealed' : 'hidden'} />}

      {showOverlay && (
        <motion.div
          className="fixed inset-0 z-40 overflow-hidden bg-neutral-950"
          animate={{ backgroundColor: phase === 'landing' ? 'rgba(10,10,10,0)' : 'rgba(10,10,10,1)' }}
          transition={{ duration: 0.4 }}
        >
          <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-16">
            <motion.header
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={phase === 'pick' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: -12, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <h1 className="text-center text-2xl font-medium text-white">Add your cards</h1>

              <div className="mt-12 flex justify-center" style={{ gap: SLOT_GAP }}>
                {Array.from({ length: slotCount }, (_, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      slotRefs.current[i] = el
                    }}
                    className="rounded-[4px] border border-dashed border-neutral-800"
                    style={{ width: slotW, height: slotH }}
                  />
                ))}
              </div>

            </motion.header>

            <motion.div
              className="relative flex-1"
              animate={phase === 'pick' ? { y: 0, opacity: 1 } : { y: 420, opacity: 0 }}
              transition={phase === 'pick' ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
            >
              <CardFan items={items} onFlick={handleFlick} />
            </motion.div>

            {/* Solid dark backing at the screen edge: Safari tints its toolbar from
                whatever fixed element sits at the bottom, and the white button
                alone turned it white. */}
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-neutral-950 px-4 pb-[max(24px,env(safe-area-inset-bottom))] before:absolute before:inset-x-0 before:-top-10 before:h-10 before:bg-gradient-to-t before:from-neutral-950 before:to-transparent before:content-['']">
              <div className="relative mx-auto h-12 max-w-md">
                <AnimatePresence>
                  {phase === 'pick' && picked.length > 0 && (
                    <motion.button
                      type="button"
                      onClick={() => setPhase('loading')}
                      initial={{ opacity: 0, y: 40, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.96 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="pointer-events-auto h-12 w-full rounded-full bg-white text-base font-medium text-neutral-950"
                    >
                      Add {picked.length} {picked.length === 1 ? 'card' : 'cards'}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {phase === 'loading' && (
              <motion.div
                className="absolute inset-x-0 text-center"
                style={{ top: stackY + (CARD_H * STACK_SCALE) / 2 + 44 }}
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <p className="text-2xl font-medium text-white">
                  <AnimatedNumber value={foundValue} />
                </p>
                <p className="mt-1 h-5 overflow-hidden text-sm text-neutral-400">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={tick}
                      className="block"
                      initial={{ y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -14, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      {tick === 0 ? 'Loading benefits' : benefits[tick - 1]?.name ?? 'Loading benefits'}
                    </motion.span>
                  </AnimatePresence>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {showOverlay &&
        picked.map((p, i) => <FlyingCard key={p.card.id} picked={p} target={targetFor(i, p.origin)} shimmer={phase === 'loading'} />)}
    </>
  )
}

function FlyingCard({ picked, target, shimmer }: { picked: Picked; target: Target; shimmer: boolean }) {
  const { origin, card } = picked
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-50"
      initial={{ x: origin.x, y: origin.y }}
      animate={{ x: target.x, y: target.y, opacity: target.opacity }}
      transition={target.transition}
    >
      <motion.div
        className="absolute left-0 top-0 overflow-hidden bg-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)]"
        style={{ x: '-50%', y: '-50%' }}
        initial={{ width: CARD_W, height: CARD_H, scale: origin.scale, rotate: origin.rotate, borderRadius: 12 }}
        animate={{
          width: target.width,
          height: target.height,
          scale: target.scale,
          rotate: target.rotate,
          borderRadius: target.radius / target.scale,
        }}
        transition={target.transition}
      >
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ width: CARD_W, height: CARD_H, x: '-50%', y: '-50%' }}
          animate={{ opacity: target.faceOpacity }}
          // While landing, the card keeps its colour until it has mostly shrunk into the bar.
          transition={target.faceOpacity === 0 ? { duration: 0.3, delay: 0.18, ease: 'easeIn' } : { duration: 0.25 }}
        >
          <CardFace card={card} />
          {shimmer && <div className="animate-shimmer absolute inset-0" />}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
