'use client'

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type Transition,
} from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cards, type Benefit, type Card } from '@/lib/cards'
import { hand, type HandCard } from '@/lib/demo-cards'
import { AnimatedNumber } from '@/components/animated-number'
import { HomeView } from '@/components/home-view'
import { CardFace } from './card-face'
import { CardFan, CARD_H, CARD_W, type FlickOrigin } from './card-fan'
import { fx, reducedMotion, tune, useTune } from './tune'
import { TunePanel } from './tune-panel'

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

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const DATA_IDS = hand.filter((c) => c.cardId).map((c) => c.id)

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
  shadow: number
  // Whether arriving here is a catch (the slot gives a little).
  catch: boolean
  // Folding into a glow bar: the card flashes its own colour before settling white.
  tint?: { delay: number }
  spring: { x: Transition; y: Transition; rest: Transition }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const same = (t: Transition) => ({ x: t, y: t, rest: t })

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
  const [catches, setCatches] = useState<number[]>([])
  const [exhale, setExhale] = useState(0)
  // Where the loading total flies to: its place in the home header.
  const [counterTo, setCounterTo] = useState<{ x: number; y: number; scale: number } | null>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const caught = useRef(new Set<string>())
  const [tuning] = useState(() => new URLSearchParams(window.location.search).has('tune'))
  useTune()
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
      const from = counterRef.current
      const to = document.querySelector<HTMLElement>('[data-found-value]')
      if (from && to) {
        const a = from.getBoundingClientRect()
        const b = to.getBoundingClientRect()
        const scale = parseFloat(getComputedStyle(to).fontSize) / parseFloat(getComputedStyle(from).fontSize)
        setCounterTo({ x: b.left - a.left, y: b.top + b.height / 2 - (a.top + (a.height * scale) / 2), scale })
      }
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
    const base = { width: CARD_W, height: CARD_H, radius: 12, faceOpacity: 1, opacity: 1, catch: false }
    if (at === 'pick') {
      const slot = slotRects[index]
      // Vertical and sideways run on different springs, so a thrown card
      // travels on a curve rather than a straight line.
      const y: Transition = { type: 'spring', stiffness: tune.flightYStiffness.get(), damping: tune.flightYDamping.get() }
      return {
        ...base,
        x: slot ? slot.left + slot.width / 2 : viewport.w / 2,
        y: slot ? slot.top + slot.height / 2 : 120,
        scale: slotW / CARD_W,
        rotate: 0,
        radius: 4,
        shadow: 0.2,
        catch: true,
        spring: {
          x: { type: 'spring', stiffness: tune.flightXStiffness.get(), damping: tune.flightXDamping.get() },
          y,
          rest: y,
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
        shadow: 0.6,
        spring: same({ type: 'spring', stiffness: 200, damping: 24, delay: index * 0.05 }),
      }
    }
    const data = picked[index].data
    const bar = data && barRects[data.id]
    if (!bar) {
      // No benefits to show: sink back into the stack and fade.
      const stack = targetFor(index, origin, 'loading')
      return { ...stack, scale: stack.scale * 0.85, opacity: 0, spring: same({ type: 'spring', visualDuration: 0.3, bounce: 0 }) }
    }
    const delay = (picked.length - 1 - index) * 0.08
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
      shadow: 0,
      catch: false,
      tint: { delay },
      spring: same({ type: 'spring', stiffness: 210, damping: 28, delay }),
    }
  }

  const homeCards = picked.flatMap((p) => (p.data ? [p.data] : []))
  const totalFound = benefits.reduce((sum, b) => sum + b.value * PER_YEAR[b.cycle], 0)

  const handleCatch = (i: number) => {
    setCatches((prev) => {
      const next = [...prev]
      next[i] = (next[i] ?? 0) + 1
      return next
    })
    caught.current.add(picked[i].card.id)
    if (!exhale && DATA_IDS.every((id) => caught.current.has(id))) setExhale(1)
  }
  const showOverlay = phase !== 'home'

  return (
    <>
      {phase !== 'pick' && (
        <HomeView cards={homeCards} intro={phase === 'home' ? 'revealed' : 'hidden'} found={totalFound} />
      )}

      {showOverlay && (
        <motion.div
          className="fixed inset-0 z-40 overflow-hidden bg-neutral-950"
          animate={{ backgroundColor: phase === 'landing' ? 'rgba(10,10,10,0)' : 'rgba(10,10,10,1)' }}
          transition={{ duration: 0.4 }}
        >
          <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-16">
            {/* Leaving is quieter than arriving: a quick fade, no movement. */}
            <motion.header
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={phase === 'pick' ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(2px)' }}
              transition={phase === 'pick' ? { duration: 0.4, ease: 'easeOut' } : { duration: 0.2, ease: EASE_OUT }}
            >
              <h1 className="text-center text-2xl font-medium text-white">Add your cards</h1>

              <div className="mt-10 flex justify-center" style={{ gap: SLOT_GAP }}>
                {Array.from({ length: slotCount }, (_, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      slotRefs.current[i] = el
                    }}
                    className="relative rounded-[4px] border border-dashed border-neutral-800"
                    style={{ width: slotW, height: slotH }}
                  >
                    {/* A ring that spreads out as a card is caught. */}
                    {catches[i] > 0 && fx('landRipple') > 0 && (
                      <motion.div
                        key={catches[i]}
                        className="pointer-events-none absolute -inset-px rounded-[4px] border"
                        // Tinted with the caught card's own colour.
                        style={{ borderColor: `oklch(80% 0.12 ${picked[i]?.card.hue ?? 0} / 0.7)` }}
                        initial={{ opacity: 1, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.4 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    )}
                  </div>
                ))}
              </div>

            </motion.header>

            <motion.div
              className="relative flex-1"
              animate={phase === 'pick' ? { y: 0, opacity: 1 } : { y: 160, opacity: 0 }}
              transition={phase === 'pick' ? { duration: 0 } : { type: 'spring', visualDuration: 0.3, bounce: 0 }}
            >
              <CardFan items={items} onFlick={handleFlick} exhale={exhale} />
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
            {(phase === 'loading' || phase === 'landing') && (
              <motion.div
                className="absolute inset-x-0 text-center"
                style={{ top: stackY + (CARD_H * STACK_SCALE) / 2 + 44 }}
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <p className="text-2xl font-medium">
                  {/* The total doesn't vanish: it flies up and becomes the
                      line under the home screen's headline. */}
                  <motion.span
                    ref={counterRef}
                    className="inline-block"
                    style={{ originX: 0, originY: 0 }}
                    initial={false}
                    animate={
                      phase === 'landing' && counterTo
                        ? { ...counterTo, color: 'rgb(161, 161, 161)' }
                        : { x: 0, y: 0, scale: 1, color: 'rgb(255, 255, 255)' }
                    }
                    transition={{ type: 'spring', visualDuration: 0.5, bounce: 0 }}
                  >
                    <AnimatedNumber value={Math.round(foundValue)} />
                  </motion.span>
                </p>
                <motion.p
                  className="mt-1 h-5 overflow-hidden text-sm text-neutral-400"
                  animate={{ opacity: phase === 'landing' ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={tick}
                      className="block"
                      initial={{ y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -14, opacity: 0 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                    >
                      {tick === 0 ? 'Loading benefits' : benefits[tick - 1]?.name ?? 'Loading benefits'}
                    </motion.span>
                  </AnimatePresence>
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {showOverlay &&
        picked.map((p, i) => (
          <FlyingCard
            key={p.card.id}
            picked={p}
            target={targetFor(i, p.origin)}
            onCatch={() => handleCatch(i)}
          />
        ))}

      {tuning && <TunePanel />}
    </>
  )
}

function FlyingCard({ picked, target, onCatch }: { picked: Picked; target: Target; onCatch: () => void }) {
  const { origin, card, data } = picked
  // Starts exactly as the card left the hand: same place, turn, tilt, scale
  // and shadow, moving at the same speed.
  const x = useMotionValue(origin.x)
  const y = useMotionValue(origin.y)
  const spin = useMotionValue(origin.rotate)
  const pitch = useMotionValue(origin.pitch)
  const scale = useMotionValue(origin.scale)
  // The card stays card-sized and folds into its glow bar by scaling, so the
  // landing never touches layout.
  const foldX = useMotionValue(1)
  const foldY = useMotionValue(1)
  // Corner radius as it looks on screen.
  const radius = useMotionValue(12 * origin.scale)
  const opacity = useMotionValue(1)
  const shadow = useMotionValue(origin.shadow)
  const catchY = useMotionValue(0)
  const squash = useMotionValue(0)
  const tint = useMotionValue(0)

  // Leans into its sideways travel, like it's cutting through air.
  const tilt = useSpring(
    useTransform(useVelocity(x), (v) => clamp((v * fx('flightTilt')) / 1000, -20, 20)),
    { stiffness: 300, damping: 30 },
  )
  const rotate = useTransform(() => spin.get() + tilt.get())
  const top = useTransform(() => y.get() + catchY.get())
  const scaleX = useTransform(() => foldX.get() * (1 + squash.get() * 0.6))
  const scaleY = useTransform(() => foldY.get() * (1 - squash.get()))
  const shadowY = useTransform(shadow, (l) => l * 24)
  const shadowScale = useTransform(shadow, (l) => 0.96 + l * 0.06)
  const shadowOpacity = useTransform(shadow, (l) => 0.55 + l * 0.45)
  // Elliptical corners in the card's own space, so they stay round on screen
  // however unevenly it's squeezed.
  const borderRadius = useTransform(() => {
    const r = radius.get()
    const s = scale.get()
    return `${r / (s * foldX.get())}px / ${r / (s * foldY.get())}px`
  })

  const targetRef = useRef(target)
  const onCatchRef = useRef(onCatch)
  useLayoutEffect(() => {
    targetRef.current = target
    onCatchRef.current = onCatch
  })
  const launched = useRef(false)
  const key = [target.x, target.y, target.scale, target.rotate, target.width, target.height, target.radius, target.opacity, target.shadow].join()

  useEffect(() => {
    const t = targetRef.current
    const first = !launched.current
    launched.current = true

    if (t.tint) {
      tint.jump(1)
      animate(tint, [1, 1, 0], { duration: 0.7, times: [0, 0.6, 1], delay: t.tint.delay })
    }

    // Reduced motion: nothing flies or spins. The card fades in where it's going.
    if (reducedMotion.get()) {
      if (t.opacity === 0) {
        const run = animate(opacity, 0, { duration: 0.2 })
        return () => run.stop()
      }
      x.jump(t.x)
      y.jump(t.y)
      spin.jump(t.rotate)
      pitch.jump(0)
      foldX.jump(t.width / CARD_W)
      foldY.jump(t.height / CARD_H)
      radius.jump(t.radius)
      shadow.jump(t.shadow)
      scale.jump(t.scale * 0.96)
      opacity.jump(0)
      const fade = { duration: 0.2, ease: EASE_OUT }
      const runs = [animate(scale, t.scale, fade), animate(opacity, t.opacity, fade)]
      if (t.catch) onCatchRef.current()
      return () => runs.forEach((r) => r.stop())
    }

    const runs = [
      animate(x, t.x, first ? { ...t.spring.x, velocity: origin.vx } : t.spring.x),
      animate(y, t.y, first ? { ...t.spring.y, velocity: origin.vy } : t.spring.y),
      animate(spin, t.rotate, first ? { ...t.spring.rest, velocity: origin.vr * fx('spinCarry') } : t.spring.rest),
      animate(pitch, 0, t.spring.rest),
      animate(scale, t.scale, t.spring.rest),
      animate(foldX, t.width / CARD_W, t.spring.rest),
      animate(foldY, t.height / CARD_H, t.spring.rest),
      animate(radius, t.radius, t.spring.rest),
      animate(opacity, t.opacity, t.spring.rest),
      animate(shadow, t.shadow, t.spring.rest),
    ]
    // The first moment it reaches the slot, the slot gives a little and the
    // card squashes against it.
    let caught = !t.catch
    const check = () => {
      if (caught || Math.hypot(x.get() - t.x, y.get() - t.y) > 2) return
      caught = true
      const dip = fx('landDip')
      if (dip) animate(catchY, 0, { type: 'spring', velocity: -dip * 36, stiffness: 500, damping: 18 })
      const amount = fx('landSquash')
      if (amount) animate(squash, 0, { type: 'spring', velocity: amount * 40, stiffness: 600, damping: 20 })
      onCatchRef.current()
    }
    const unsubscribe = [x.on('change', check), y.on('change', check)]
    return () => {
      runs.forEach((r) => r.stop())
      unsubscribe.forEach((u) => u())
    }
  }, [key, origin, x, y, spin, pitch, scale, foldX, foldY, radius, opacity, shadow, catchY, squash, tint])

  return (
    <motion.div className="pointer-events-none fixed left-0 top-0 z-50" style={{ x, y: top, opacity }}>
      <motion.div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          x: '-50%',
          y: '-50%',
          width: CARD_W,
          height: CARD_H,
          scale,
          scaleX,
          scaleY,
          rotate,
          rotateX: pitch,
          transformPerspective: 900,
        }}
      >
        <motion.div
          aria-hidden
          className="absolute inset-0 shadow-[0_32px_48px_-12px_rgba(0,0,0,0.9)] will-change-transform"
          style={{ borderRadius, y: shadowY, scale: shadowScale, opacity: shadowOpacity }}
        />
        <motion.div className="absolute inset-0 overflow-hidden bg-white" style={{ borderRadius }}>
          {data && <motion.div className="absolute inset-0" style={{ background: data.glowColor, opacity: tint }} />}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: target.faceOpacity }}
            // While landing, the card keeps its colour until it has mostly shrunk into the bar.
            transition={
              target.faceOpacity === 0
                ? { duration: 0.2, delay: 0.2 + (target.tint?.delay ?? 0), ease: 'easeIn' }
                : { duration: 0.25 }
            }
          >
            <CardFace card={card} />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
