'use client'

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
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
import { place, type Placed } from './pile'

type Phase = 'pick' | 'loading' | 'landing' | 'home'

interface Picked {
  card: HandCard
  // Only the cards in lib/cards.ts have benefits; the rest still go in the
  // wallet but bow out before the home screen.
  data?: Card
  origin: FlickOrigin
  // Where it comes to rest in the pile.
  land: Placed
}

// 7/6 makes the front card 280 tall, so the stack's edges land on the 4px grid.
const STACK_SCALE = 7 / 6
const LOADING_MS = 1700
// Height from the screen's bottom edge to just above the raised centre card
// (the hand is anchored 248 up); the pile stays above it.
const HAND_TOP = 248 + CARD_H / 2 + 40

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
  // Being dealt onto the pile: it slides to a stop like a card on a table.
  deal: boolean
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
  const [barRects, setBarRects] = useState<Record<string, DOMRect>>({})
  const [tick, setTick] = useState(0)
  const [exhale, setExhale] = useState(0)
  // Where the loading total flies to: its place in the home header.
  const [counterTo, setCounterTo] = useState<{ x: number; y: number; scale: number } | null>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const caught = useRef(new Set<string>())
  const [tuning] = useState(() => new URLSearchParams(window.location.search).has('tune'))
  useTune()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const pile = useRef<Placed[]>([])
  const viewport = useViewport()

  // Loading stack centre, snapped to the 4px grid.
  const stackY = Math.round((viewport.h * 0.36) / 4) * 4

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.card.id)), [picked])
  const items = useMemo(() => hand.filter((c) => !pickedIds.has(c.id)), [pickedIds])

  const handleFlick = useCallback((card: HandCard, origin: FlickOrigin) => {
    const data = cards.find((c) => c.id === card.cardId)
    // Where the flick alone would leave it: sliding on with the table's
    // friction, still turning with the spin it left the hand with.
    const friction = tune.friction.get()
    const spin = (origin.vr + origin.vx * 0.06) * fx('spinCarry')
    const ideal = {
      x: origin.x + origin.vx * friction,
      y: origin.y + origin.vy * friction,
      rotate: clamp(origin.rotate + spin * friction + (Math.random() * 2 - 1) * fx('scatter'), -24, 24),
    }
    // The table is the space between the title and the top of the hand.
    const title = titleRef.current?.getBoundingClientRect()
    const zone = {
      left: 16,
      right: window.innerWidth - 16,
      top: (title?.bottom ?? 96) + 24,
      bottom: window.innerHeight - HAND_TOP,
    }
    const land = place(ideal, pile.current, zone, tune.pileScale.get(), tune.reveal.get())
    pile.current.push(land)
    setPicked((prev) => [...prev, { card, data, origin, land }])
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
    const base = { width: CARD_W, height: CARD_H, radius: 12, faceOpacity: 1, opacity: 1, deal: false }
    if (at === 'pick') {
      const { land } = picked[index]
      const pileScale = tune.pileScale.get()
      return {
        ...base,
        ...land,
        scale: pileScale,
        radius: 12 * pileScale,
        shadow: 0.15,
        deal: true,
        spring: same({ type: 'spring', visualDuration: 0.4, bounce: 0 }),
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
      deal: false,
      tint: { delay },
      spring: same({ type: 'spring', stiffness: 210, damping: 28, delay }),
    }
  }

  const homeCards = picked.flatMap((p) => (p.data ? [p.data] : []))
  const totalFound = benefits.reduce((sum, b) => sum + b.value * PER_YEAR[b.cycle], 0)

  const handleLand = (i: number) => {
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
              <h1 ref={titleRef} className="text-center text-2xl font-medium text-white">
                Add your cards
              </h1>

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
            onLand={() => handleLand(i)}
          />
        ))}

      {tuning && <TunePanel />}
    </>
  )
}

function FlyingCard({ picked, target, onLand }: { picked: Picked; target: Target; onLand: () => void }) {
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
  // Height off the table while it's tossed: it grows a little and casts a
  // longer shadow, then settles.
  const hop = useMotionValue(0)
  const tint = useMotionValue(0)

  const size = useTransform(() => scale.get() * (1 + hop.get()))
  const lift = useTransform(() => Math.min(1, shadow.get() + hop.get() * 5))
  const shadowY = useTransform(lift, (l) => l * 24)
  const shadowScale = useTransform(lift, (l) => 0.96 + l * 0.06)
  const shadowOpacity = useTransform(lift, (l) => 0.55 + l * 0.45)
  // Elliptical corners in the card's own space, so they stay round on screen
  // however unevenly it's squeezed.
  const borderRadius = useTransform(() => {
    const r = radius.get()
    const s = scale.get()
    return `${r / (s * foldX.get())}px / ${r / (s * foldY.get())}px`
  })

  const targetRef = useRef(target)
  const onLandRef = useRef(onLand)
  useLayoutEffect(() => {
    targetRef.current = target
    onLandRef.current = onLand
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
      if (t.deal && first) onLandRef.current()
      return () => runs.forEach((r) => r.stop())
    }

    if (first && t.deal) {
      // Dealt onto the table: it leaves at the flick's speed and slides to a
      // stop under friction, so a harder flick travels further. If the pile
      // nudged its spot, the glide is stretched or shortened to match, which
      // keeps the starting speed true to the flick.
      const friction = tune.friction.get()
      const natural = Math.hypot(origin.vx, origin.vy) * friction
      const distance = Math.hypot(t.x - x.get(), t.y - y.get())
      const tau = friction * clamp(natural > 1 ? distance / natural : 1.6, 0.4, 1.6)
      const glide = (mv: typeof x, to: number, restDelta = 0.01) =>
        animate(mv, to, {
          type: 'inertia',
          velocity: (to - mv.get()) / tau,
          power: 1,
          timeConstant: tau * 1000,
          modifyTarget: () => to,
          restDelta,
        })
      const runs = [
        glide(x, t.x, 0.2),
        glide(y, t.y, 0.2),
        glide(spin, t.rotate),
        glide(pitch, 0),
        glide(scale, t.scale, 0.001),
        glide(radius, t.radius),
        glide(shadow, t.shadow, 0.001),
      ]
      const toss = fx('toss')
      const air = tau * 4
      const flight = animate(hop, [0, toss, 0], { duration: air, times: [0, 0.3, 1], ease: ['easeOut', 'easeIn'] })
      // Touchdown.
      const landed = setTimeout(() => onLandRef.current(), air * 1000)
      return () => {
        runs.forEach((r) => r.stop())
        flight.stop()
        clearTimeout(landed)
      }
    }

    const runs = [
      animate(x, t.x, t.spring.x),
      animate(y, t.y, t.spring.y),
      animate(spin, t.rotate, t.spring.rest),
      animate(pitch, 0, t.spring.rest),
      animate(scale, t.scale, t.spring.rest),
      animate(foldX, t.width / CARD_W, t.spring.rest),
      animate(foldY, t.height / CARD_H, t.spring.rest),
      animate(radius, t.radius, t.spring.rest),
      animate(opacity, t.opacity, t.spring.rest),
      animate(shadow, t.shadow, t.spring.rest),
    ]
    return () => runs.forEach((r) => r.stop())
  }, [key, origin, x, y, spin, pitch, scale, foldX, foldY, radius, opacity, shadow, hop, tint])

  return (
    <motion.div className="pointer-events-none fixed left-0 top-0 z-50" style={{ x, y, opacity }}>
      <motion.div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          x: '-50%',
          y: '-50%',
          width: CARD_W,
          height: CARD_H,
          scale: size,
          scaleX: foldX,
          scaleY: foldY,
          rotate: spin,
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
