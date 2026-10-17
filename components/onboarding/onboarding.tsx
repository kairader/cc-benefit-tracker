'use client'

import {
  animate,
  AnimatePresence,
  cubicBezier,
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
import { SafariEdges } from '@/components/safari-edges'
import { CardFace } from './card-face'
import { CardFan, CARD_H, CARD_W, type FlickOrigin } from './card-fan'
import { Rolodex } from './rolodex'
import { fx, reducedMotion, tune, useTune } from './tune'
import { TunePanel } from './tune-panel'
import { gridSpot, overlapSpot, rowFitWidth, spreadSpot, stackSpot } from './spread'

type Phase = 'pick' | 'loading' | 'landing' | 'home'

interface Picked {
  card: HandCard
  // Only the cards in lib/cards.ts have benefits; the rest still go in the
  // wallet but bow out before the home screen.
  data?: Card
  origin: FlickOrigin
}

// Makes the front card 320 wide, so the stack's edges land on the 4px grid.
const STACK_SCALE = 320 / CARD_W
// The landing layouts, in the order the tuning panel lists them.
const LAYOUTS = ['row', 'overlap', 'stack', 'angled', 'value'] as const
type Layout = (typeof LAYOUTS)[number]
// The value layout's list, matching the home screen's card headers: a total
// and its caption, then a 40px line per card with a 4x24 glow bar at its left.
const VALUE_HEAD = 56 + 24
const VALUE_LINE = 40
const annual = (card?: Card) => card?.benefits.reduce((sum, b) => sum + b.value * PER_YEAR[b.cycle], 0) ?? 0
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
  // Being dealt onto the pile: it slides to a stop like a card on a table.
  deal: boolean
  // Folding into a glow bar: the card flashes its own colour before settling white.
  tint?: { delay: number }
  spring: { x: Transition; y: Transition; rest: Transition }
}

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

// Inside the desktop preview's phone frame there's no real safe area, so the
// page pretends to be an iPhone's: status bar on top, home indicator below.
// Layouts read --safe-top/--safe-bottom and fall back to the real insets.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed')) {
  document.documentElement.style.setProperty('--safe-top', '62px')
  document.documentElement.style.setProperty('--safe-bottom', '34px')
}

// How far the overlay reaches below the screen's bottom edge: deeper than
// Safari's toolbar, so whatever it covers is still the onboarding.
const BLEED = 160

// The glass comes in along a cubic-bezier (tune: Glass), from nothing at the
// top of the fade to full strength at the button's top edge. The default is
// flat at both ends, so there's no line where the glass starts or where it
// levels off. CSS gradients are linear between stops, so the curve is sampled
// into many of them.
const GLASS_STOPS = 24
// Blur each layer adds. Stacked blurs compound (about the square root of the
// sum of squares), so these build 1, 2, 3.5, 5, 7 and 9px in roughly even
// visible steps. A little saturation per layer adds up to about 1.8x.
const GLASS_BLURS = [1, 1.75, 2.9, 3.6, 4.9, 5.7]

function glassEase() {
  const ease = cubicBezier(tune.glassX1.get(), tune.glassY1.get(), tune.glassX2.get(), tune.glassY2.get())
  return (t: number) => Math.min(1, Math.max(0, ease(t)))
}

function easedStops(fade: number, value: (amount: number) => string) {
  const ease = glassEase()
  return Array.from({ length: GLASS_STOPS + 1 }, (_, i) => {
    const t = i / GLASS_STOPS
    return `${value(ease(t))} ${(t * fade).toFixed(2)}px`
  }).join(', ')
}

// Each layer takes its own slice of the curve, so the stack thickens one
// layer at a time and the total follows the curve exactly.
function glassLayers(fade: number) {
  const n = GLASS_BLURS.length
  return GLASS_BLURS.map((blur, k) => ({
    filter: `blur(${blur}px) saturate(1.1)`,
    mask: `linear-gradient(to bottom, ${easedStops(fade, (e) => `rgb(0 0 0 / ${Math.min(1, Math.max(0, e * n - k)).toFixed(3)})`)})`,
  }))
}

export function Onboarding() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [picked, setPicked] = useState<Picked[]>([])
  // How many picks have landed, in order. In the row, a card that hasn't
  // landed heads for the open slot; one that has takes its column.
  const [settled, setSettled] = useState(0)
  const [barRects, setBarRects] = useState<Record<string, DOMRect>>({})
  const [tick, setTick] = useState(0)
  const [exhale, setExhale] = useState(0)
  // Where the loading total flies to: its place in the home header.
  const [counterTo, setCounterTo] = useState<{ x: number; y: number; scale: number } | null>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const caught = useRef(new Set<string>())
  const [tuning] = useState(() => new URLSearchParams(window.location.search).has('tune'))
  // ?fan shows the earlier fanned hand instead of the rolodex.
  const [fan] = useState(() => new URLSearchParams(window.location.search).has('fan'))
  useTune()
  // ?layout=value (or any layout's name) shows that layout whatever the
  // tuning panel says, so a prototype can be shared as a link.
  const [layoutParam] = useState(() => new URLSearchParams(window.location.search).get('layout'))
  const layout: Layout = LAYOUTS.find((l) => l === layoutParam) ?? LAYOUTS[tune.landing.get()] ?? 'row'
  const navRef = useRef<HTMLElement>(null)
  const [navBottom, setNavBottom] = useState(44)
  const viewport = useViewport()

  // Loading stack centre, snapped to the 4px grid.
  const stackY = Math.round((viewport.h * 0.36) / 4) * 4

  // The nav bar's height depends on the safe area, which only the layout knows.
  useLayoutEffect(() => {
    const measure = () => setNavBottom(navRef.current?.getBoundingClientRect().bottom ?? 44)
    measure()
  }, [viewport])

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
      // The value layout has already shown what the cards are worth, so it
      // goes straight on to the home screen.
    }, layout === 'value' ? 300 : LOADING_MS + 450)
    return () => {
      clearInterval(timer)
      clearTimeout(done)
    }
  }, [phase, benefits.length, picked, layout])

  useEffect(() => {
    if (phase !== 'landing') return
    const timer = setTimeout(() => setPhase('home'), 650 + picked.length * 80)
    return () => clearTimeout(timer)
  }, [phase, picked.length])

  // Dealt cards gather a set gap under the nav bar, in the layout chosen in
  // the tuning panel. The row shows an open slot for the next card and each
  // card lands right in it; a row's first card then slides left so the next
  // open slot can sit in the middle.
  const perRow = tune.rowPerRow.get()
  const cardWidth = {
    row: Math.min(tune.rowWidth.get(), Math.floor(rowFitWidth(perRow, tune.rowGap.get(), viewport.w / 2 - 16) / 4) * 4),
    overlap: tune.overlapWidth.get(),
    stack: tune.stackWidth.get(),
    angled: tune.pileScale.get() * CARD_W,
    value: CARD_W,
  }[layout]
  const pileScale = cardWidth / CARD_W
  const glassFade = tune.glassFade.get()
  const zone = { top: navBottom + tune.titleGap.get(), centerX: viewport.w / 2 }
  const cardH = CARD_H * pileScale
  const row = { cardW: cardWidth, cardH, gap: tune.rowGap.get(), perRow }
  // Value: lines tighten if there are too many to fit above the drum.
  const valueLeft = Math.max(16, (viewport.w - 448) / 2 + 16)
  const valueLine = Math.min(VALUE_LINE, (viewport.h - tune.stackRoom.get() - zone.top - VALUE_HEAD) / Math.max(1, picked.length))
  const valueSpot = (index: number) => ({ x: valueLeft + 2, y: zone.top + VALUE_HEAD + index * valueLine + valueLine / 2, rotate: 0 })
  const valueTotal = picked.slice(0, settled).reduce((sum, p) => sum + annual(p.data), 0)
  const spotFor = (index: number, count: number) => {
    switch (layout) {
      case 'value':
        return valueSpot(index)
      case 'row':
        return gridSpot(index, true, zone, row)
      case 'overlap':
        return overlapSpot(index, count, zone, { cardW: cardWidth, cardH, step: tune.overlapStep.get(), maxWidth: viewport.w - 32 })
      case 'stack':
        return stackSpot(index, count, zone, { cardH, peek: tune.stackPeek.get(), bottom: viewport.h - tune.stackRoom.get() })
      case 'angled':
        return spreadSpot(index, count, zone, {
          cardH,
          step: tune.spacing.get(),
          rowStep: tune.rowStep.get(),
          perRow: tune.perRow.get(),
          scatter: fx('scatter'),
        })
    }
  }
  const pickSpot = (index: number) => {
    if (layout !== 'row') return spotFor(index, picked.length)
    return gridSpot(index, index < settled, zone, row)
  }
  const nextSpot = layout === 'row' ? gridSpot(settled, false, zone, row) : spotFor(picked.length, picked.length + 1)

  const targetFor = (index: number, origin: FlickOrigin, at: Phase = phase): Target => {
    const base = { width: CARD_W, height: CARD_H, radius: 12, faceOpacity: 1, opacity: 1, deal: false }
    if (layout === 'value' && (at === 'pick' || at === 'loading')) {
      // Flies up and folds into its glow line, flashing its own colour.
      return {
        ...base,
        ...valueSpot(index),
        width: 4,
        height: 24,
        scale: 1,
        radius: 2,
        faceOpacity: 0,
        deal: true,
        tint: { delay: 0 },
        spring: same({ type: 'spring', visualDuration: 0.4, bounce: 0 }),
      }
    }
    if (at === 'pick') {
      const spot = pickSpot(index)
      return {
        ...base,
        ...spot,
        scale: pileScale,
        radius: 12 * pileScale,
        deal: true,
        spring: same({ type: 'spring', visualDuration: 0.4, bounce: 0 }),
      }
    }
    if (at === 'loading') {
      const n = picked.length
      const fromTop = n - 1 - index
      // The stack squares up as it grows into the middle; the old spread fans.
      const fan = layout === 'angled' ? index - (n - 1) / 2 : 0
      return {
        ...base,
        x: viewport.w / 2 + fan * 8,
        y: stackY - fromTop * 12,
        scale: STACK_SCALE - fromTop * 0.05,
        rotate: fan * 4,
        radius: 16,
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
      deal: false,
      tint: { delay },
      spring: same({ type: 'spring', stiffness: 210, damping: 28, delay }),
    }
  }

  const homeCards = picked.flatMap((p) => (p.data ? [p.data] : []))
  const totalFound = benefits.reduce((sum, b) => sum + b.value * PER_YEAR[b.cycle], 0)

  const handleLand = (i: number) => {
    setSettled((s) => Math.max(s, i + 1))
    caught.current.add(picked[i].card.id)
    if (!exhale && DATA_IDS.every((id) => caught.current.has(id))) setExhale(1)
  }
  const showOverlay = phase !== 'home'

  return (
    <>
      {phase !== 'pick' && (
        <HomeView cards={homeCards} intro={phase === 'home' ? 'revealed' : 'hidden'} found={totalFound} />
      )}

      {/* Safari 26 on iPhone draws nothing past the end of the page under its
          floating toolbar, so while the overlay is up the page is made taller
          than the screen. The overlay blocks scrolling, so it never moves. */}
      {showOverlay && <div aria-hidden className="safari-runway" />}

      {showOverlay && (
        // The overlay runs BLEED past the bottom of the screen, and pads it
        // back out so the layout inside still ends at the visible edge. That
        // way the drum keeps drawing under Safari's toolbar, and Safari, which
        // tints its toolbar from any screen-sized fixed layer touching the
        // bottom edge, sees a layer too tall to count and leaves the bar clear.
        <motion.div
          className="fixed inset-x-0 top-0 z-40 touch-none overflow-hidden bg-neutral-950"
          style={{ bottom: -BLEED, paddingBottom: BLEED }}
          animate={{ backgroundColor: phase === 'landing' ? 'rgba(10,10,10,0)' : 'rgba(10,10,10,1)' }}
          transition={{ duration: 0.4 }}
        >
          {layout === 'value' && (
            // What the picks are worth: a running total, then a line per card
            // like the home screen's, each with its glow bar. The card lands
            // as the bar; its name and value show once it has.
            <motion.div
              aria-hidden={picked.length === 0}
              className="pointer-events-none absolute"
              style={{ left: valueLeft, right: valueLeft, top: zone.top }}
              initial={false}
              animate={{ opacity: phase === 'pick' ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <p
                className="h-8 text-2xl font-medium tabular-nums transition-colors duration-300"
                style={{ color: valueTotal ? 'rgb(255 255 255)' : 'rgb(115 115 115)' }}
              >
                <AnimatedNumber value={Math.round(valueTotal)} />
              </p>
              <p className="mt-1 h-5 text-sm text-neutral-400">in benefits a year</p>
              <div className="mt-6">
                {picked.map((p, i) => (
                  <div key={p.card.id} className="flex items-center" style={{ height: valueLine }}>
                    <motion.div
                      className="h-6 w-1 shrink-0 rounded-full bg-white"
                      style={{
                        boxShadow: `0 0 3px 1px ${p.data?.glowColor ?? 'rgb(255 255 255 / 0.5)'}, 0 0 8px 2px ${p.data?.glowColor ?? 'rgb(255 255 255 / 0.3)'}`,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: i < settled ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <motion.span
                      className="truncate pl-2 text-base font-medium"
                      style={{ color: p.data?.textColor ?? 'rgb(255 255 255)' }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={i < settled ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                    >
                      {p.data?.name ?? (p.card.name.startsWith(p.card.issuer) ? p.card.name : `${p.card.issuer} ${p.card.name}`)}
                    </motion.span>
                    <motion.span
                      className="ml-auto pl-4 text-sm tabular-nums text-neutral-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: i < settled ? 1 : 0 }}
                      transition={{ duration: 0.18, delay: 0.06 }}
                    >
                      {p.data ? `$${Math.round(annual(p.data)).toLocaleString()}` : ''}
                    </motion.span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {layout === 'value' ? (
            // The next line's place: a faint bar where the next card lands.
            <motion.div
              key={settled}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0"
              initial={{ x: valueSpot(settled).x, y: valueSpot(settled).y, opacity: 0 }}
              animate={{ x: valueSpot(settled).x, y: valueSpot(settled).y, opacity: phase === 'pick' ? 1 : 0 }}
              transition={{ type: 'spring', visualDuration: 0.4, bounce: 0, opacity: { duration: 0.25, delay: phase === 'pick' && settled ? 0.3 : 0 } }}
            >
              <div className="h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15" />
            </motion.div>
          ) : layout === 'angled' ? (
            // The old spread's marker: a card-shaped outline with a soft
            // neutral glow at the next spot. It slides on once the card
            // heading for it arrives.
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0"
              initial={false}
              animate={{ x: nextSpot.x, y: nextSpot.y, rotate: nextSpot.rotate, opacity: phase === 'pick' ? 1 : 0 }}
              transition={{
                type: 'spring',
                visualDuration: 0.4,
                bounce: 0,
                delay: picked.length ? tune.flightDuration.get() * 0.6 : 0,
                opacity: { duration: 0.2 },
              }}
            >
              <div
                className="animate-breathe -translate-x-1/2 -translate-y-1/2 rounded-[5px] border border-white/40 shadow-[0_0_6px_1px_rgb(255_255_255/0.3),0_0_20px_4px_rgb(255_255_255/0.12),inset_0_0_12px_rgb(255_255_255/0.1)]"
                style={{ width: CARD_W * pileScale, height: CARD_H * pileScale }}
              />
            </motion.div>
          ) : layout === 'row' ? (
            // The open place in the row: an empty card-shaped slot, a hairline
            // and a faint fill, with no glow (light is kept for the home
            // screen, where it stands for money). The next card lands in it.
            // Then this one goes and a new one is drawn at the next place,
            // once a row's first card has slid out of the middle.
            <motion.div
              key={settled}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0"
              initial={{ x: nextSpot.x, y: nextSpot.y, opacity: 0 }}
              animate={{ x: nextSpot.x, y: nextSpot.y, opacity: phase === 'pick' ? 1 : 0 }}
              transition={{
                type: 'spring',
                visualDuration: 0.4,
                bounce: 0,
                opacity: { duration: 0.25, delay: phase === 'pick' && settled ? 0.4 : 0 },
              }}
            >
              <div
                className="-translate-x-1/2 -translate-y-1/2 border border-white/10 bg-white/[0.03]"
                style={{ width: cardWidth, height: cardH, borderRadius: 12 * pileScale }}
              />
            </motion.div>
          ) : (
            // Where the first card goes, the same empty slot. After that the
            // cards themselves are the target and the slot goes.
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0"
              initial={false}
              animate={{ x: spotFor(0, 1).x, y: spotFor(0, 1).y, opacity: phase === 'pick' && picked.length === 0 ? 1 : 0 }}
              transition={{
                type: 'spring',
                visualDuration: 0.4,
                bounce: 0,
                opacity: { duration: 0.2, delay: picked.length ? tune.flightDuration.get() : 0 },
              }}
            >
              <div
                className="-translate-x-1/2 -translate-y-1/2 border border-white/10 bg-white/[0.03]"
                style={{ width: cardWidth, height: cardH, borderRadius: 12 * pileScale }}
              />
            </motion.div>
          )}

          <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-[var(--safe-top,env(safe-area-inset-top))]">
            {/* The title sits up top: 16 above it, 32 tall. Leaving is quieter
                than arriving: a quick fade, no movement. */}
            <motion.header
              ref={navRef}
              className="flex h-12 shrink-0 items-end justify-center"
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={phase === 'pick' ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(2px)' }}
              transition={phase === 'pick' ? { duration: 0.4, ease: 'easeOut' } : { duration: 0.2, ease: EASE_OUT }}
            >
              <h1 className="flex h-8 items-center text-xl font-medium text-white">Add your cards</h1>
            </motion.header>

            <motion.div
              className="relative flex-1"
              animate={phase === 'pick' ? { y: 0, opacity: 1 } : { y: 160, opacity: 0 }}
              transition={phase === 'pick' ? { duration: 0 } : { type: 'spring', visualDuration: 0.3, bounce: 0 }}
            >
              {fan ? (
                <CardFan items={items} onFlick={handleFlick} exhale={exhale} />
              ) : (
                <Rolodex items={items} onFlick={handleFlick} exhale={exhale} />
              )}
            </motion.div>

          </div>

          {/* A sheet of glass along the bottom of the screen, there from the
              start. It runs to the left, right and bottom edges, and on under
              Safari's toolbar. It's at full strength across the bottom and
              fades out above, built from stacked blurs that each start a
              little lower, so the drum softens gradually as it turns under
              it. Each layer fades itself in: opacity on a shared parent would
              switch off the blur. It arrives with the first card, under Add
              (or from the start, with tune: Glass before the first card). */}
          <AnimatePresence>
            {phase === 'pick' && (picked.length > 0 || tune.glassOnLoad.get() === 1) && (
              <motion.div
                className="pointer-events-none absolute inset-x-0 z-20 px-4 pb-[max(24px,var(--safe-bottom,env(safe-area-inset-bottom)))]"
                style={{ bottom: BLEED, paddingTop: glassFade }}
                initial="hidden"
                animate="shown"
                exit="hidden"
              >
                {glassLayers(glassFade).map((layer, i) => (
                  <motion.div
                    key={i}
                    aria-hidden
                    className="absolute inset-x-0 top-0"
                    style={{
                      bottom: -BLEED,
                      backdropFilter: layer.filter,
                      WebkitBackdropFilter: layer.filter,
                      maskImage: layer.mask,
                      WebkitMaskImage: layer.mask,
                    }}
                    variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                  />
                ))}
                {/* A dark wash on the same curve, so white stays readable over
                    the light cards (Gold, Platinum, Strata). */}
                <motion.div
                  aria-hidden
                  className="absolute inset-x-0 top-0"
                  style={{
                    bottom: -BLEED,
                    background: `linear-gradient(to bottom, ${easedStops(glassFade, (e) => `rgb(10 10 10 / ${(e * tune.glassShade.get()).toFixed(3)})`)})`,
                  }}
                  variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                />
                <div className="relative mx-auto h-12 max-w-md">
                  <AnimatePresence>
                    {picked.length > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => setPhase('loading')}
                        variants={{
                          hidden: { opacity: 0, y: 40, scale: 0.96 },
                          shown: { opacity: 1, y: 0, scale: 1 },
                        }}
                        initial="hidden"
                        animate="shown"
                        exit="hidden"
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="pointer-events-auto block h-12 w-full rounded-full bg-white text-base font-medium tabular-nums text-neutral-950"
                      >
                        Add {picked.length} {picked.length === 1 ? 'card' : 'cards'}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {layout !== 'value' && (phase === 'loading' || phase === 'landing') && (
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

      {/* The bottom stays clear while the drum runs under Safari's toolbar. */}
      <SafariEdges bottom={!showOverlay} />

      {tuning && <TunePanel />}
    </>
  )
}

function FlyingCard({ picked, target, onLand }: { picked: Picked; target: Target; onLand: () => void }) {
  const { origin, card, data } = picked
  // Starts exactly as the card left the hand: same place, turn, tilt and
  // scale, moving at the same speed.
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
  // Height off the table while it's tossed: it grows a little, then settles.
  const hop = useMotionValue(0)
  const tint = useMotionValue(0)

  const size = useTransform(() => scale.get() * (1 + hop.get()))
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
  // The target it was first sent to. An effect re-run for that same target
  // (React's dev double-run) restarts the launch rather than skipping it.
  const firstKey = useRef<string | null>(null)
  const key = [target.x, target.y, target.scale, target.rotate, target.width, target.height, target.radius, target.opacity].join()

  useEffect(() => {
    const t = targetRef.current
    firstKey.current ??= key
    const first = firstKey.current === key

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
      scale.jump(t.scale * 0.96)
      opacity.jump(0)
      const fade = { duration: 0.2, ease: EASE_OUT }
      const runs = [animate(scale, t.scale, fade), animate(opacity, t.opacity, fade)]
      if (t.deal && first) onLandRef.current()
      return () => runs.forEach((r) => r.stop())
    }

    if (first && t.deal) {
      // Dealt onto the spread. Every card makes the same trip whatever the
      // flick, eased like a game card: it launches fast, travels at a nearly
      // even pace, sails a touch past its spot and settles back. The sideways
      // move eases out without the overshoot, which curves the path a little.
      // It shrinks slightly ahead of its travel, so it reads as dropping onto
      // the table.
      const duration = tune.flightDuration.get()
      const back = [0.34, tune.overshoot.get(), 0.64, 1] as const
      const out = [0.25, 1, 0.5, 1] as const
      // Dealt into a glow line, it folds into the bar over the second half.
      const fold = { duration: duration * 0.6, delay: duration * 0.3, ease: [0.4, 0, 0.2, 1] as const }
      const runs = [
        animate(x, t.x, { duration, ease: out }),
        animate(y, t.y, { duration, ease: back }),
        animate(spin, t.rotate, { duration, ease: back }),
        animate(pitch, 0, { duration: duration * 0.7, ease: out }),
        animate(scale, t.scale, { duration: duration * 0.75, ease: out }),
        animate(radius, t.radius, { duration: duration * 0.75, ease: out }),
        animate(foldX, t.width / CARD_W, fold),
        animate(foldY, t.height / CARD_H, fold),
      ]
      const air = duration * 0.85
      const flight = animate(hop, [0, fx('toss'), 0], { duration: air, times: [0, 0.4, 1], ease: ['easeOut', 'easeIn'] })
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
    ]
    return () => runs.forEach((r) => r.stop())
  }, [key, origin, x, y, spin, pitch, scale, foldX, foldY, radius, opacity, hop, tint])

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
