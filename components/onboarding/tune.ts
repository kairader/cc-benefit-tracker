'use client'

import { motionValue, type MotionValue } from 'framer-motion'
import { useSyncExternalStore } from 'react'

// Every number that shapes how the hand feels, live-editable from the tuning
// panel (open the page with ?tune). Values are motion values so anything
// computed from them updates on the next frame.

interface Param {
  label: string
  group: string
  value: number
  min: number
  max: number
  step: number
  hint?: string
  // Named choices: the value is the index of the chosen one.
  options?: string[]
}

const defs = {
  // Swipe
  fingerLock: { group: 'Swipe', label: 'Card stays under finger', value: 0, min: 0, max: 1, step: 1, hint: 'on a tight fan this makes each card a short swipe' },
  swipeDistance: { group: 'Swipe', label: 'Swipe per card', value: 96, min: 40, max: 200, step: 4, hint: 'px of drag to move one card' },
  coast: { group: 'Swipe', label: 'Coast', value: 0.25, min: 0.05, max: 0.8, step: 0.01, hint: 'how far a fling carries, in seconds of travel' },
  tick: { group: 'Swipe', label: 'Detent tick', value: 4, min: 0, max: 12, step: 0.5, hint: 'px pop as each card passes the centre' },
  lean: { group: 'Swipe', label: 'Hand lean', value: 1.6, min: 0, max: 4, step: 0.1 },

  // Rolodex
  flipDistance: { group: 'Rolodex', label: 'Drag per card', value: 64, min: 24, max: 160, step: 4, hint: 'px of drag to flip one card' },
  axle: { group: 'Rolodex', label: 'Axle height', value: -40, min: -200, max: 200, step: 4, hint: 'px above the screen bottom; below zero crops the cards' },
  peek: { group: 'Rolodex', label: 'Card tops showing', value: 32, min: 0, max: 40, step: 1, hint: 'px each card behind stands above the one in front' },
  catch: { group: 'Rolodex', label: 'Catch before falling', value: 0.15, min: 0, max: 0.5, step: 0.01, hint: 'share of a flip the card holds on the rail' },
  loosen: { group: 'Rolodex', label: 'Loosen on fast flips', value: 0.6, min: 0, max: 2, step: 0.05, hint: 'degrees of fan per card per second' },
  clickSound: { group: 'Rolodex', label: 'Click sound', value: 1, min: 0, max: 1, step: 1 },
  hubRadius: { group: 'Rolodex', label: 'Drum radius', value: 16, min: 0, max: 120, step: 4 },
  backStep: { group: 'Rolodex', label: 'Lean between cards', value: 8, min: 2, max: 20, step: 0.5, hint: 'degrees, cards behind the front one' },
  backGap: { group: 'Rolodex', label: 'Gap behind front card', value: 0, min: 0, max: 20, step: 0.5, hint: 'degrees' },
  flop: { group: 'Rolodex', label: 'Fall of flipped card', value: 66, min: 30, max: 110, step: 1, hint: 'degrees' },
  frontStep: { group: 'Rolodex', label: 'Lean of flipped cards', value: 6, min: 0, max: 20, step: 0.5, hint: 'degrees' },
  camera: { group: 'Rolodex', label: 'Perspective', value: 900, min: 300, max: 2400, step: 20, hint: 'px; lower is more dramatic' },
  cameraHeight: { group: 'Rolodex', label: 'Eye height', value: 600, min: 0, max: 1200, step: 10, hint: 'px above the axle' },
  tilt: { group: 'Rolodex', label: 'Drum tilt', value: 0, min: -40, max: 40, step: 1, hint: 'degrees; negative tips it toward you' },

  // Glass
  glassOnLoad: { group: 'Glass', label: 'Glass before the first card', value: 0, min: 0, max: 1, step: 1 },
  glassShade: { group: 'Glass', label: 'Shade', value: 0.4, min: 0, max: 0.8, step: 0.05, hint: 'how much the glass darkens the cards' },
  glassFade: { group: 'Glass', label: 'Fade height', value: 64, min: 16, max: 240, step: 4, hint: 'px above the button the glass eases in over' },
  glassX1: { group: 'Glass', label: 'Curve x1', value: 0.45, min: 0, max: 1, step: 0.01 },
  glassY1: { group: 'Glass', label: 'Curve y1', value: 0, min: 0, max: 1, step: 0.01 },
  glassX2: { group: 'Glass', label: 'Curve x2', value: 0.55, min: 0, max: 1, step: 0.01 },
  glassY2: { group: 'Glass', label: 'Curve y2', value: 1, min: 0, max: 1, step: 0.01, hint: 'cubic-bezier the fade follows, top of the fade to full strength' },

  // Hand
  radius: { group: 'Hand', label: 'Arc radius', value: 240, min: 160, max: 1400, step: 10 },
  step: { group: 'Hand', label: 'Card spacing', value: 10, min: 3, max: 16, step: 0.1, hint: 'degrees' },
  spread: { group: 'Hand', label: 'Gap around centre card', value: 3, min: 0, max: 8, step: 0.1, hint: 'degrees' },
  lift: { group: 'Hand', label: 'Centre card lift', value: 16, min: 0, max: 40, step: 1 },
  close: { group: 'Hand', label: 'Close gap while holding', value: 0.5, min: 0, max: 1, step: 0.05 },

  // Hold
  pin: { group: 'Hold', label: 'Pivot at grab point', value: 1, min: 0, max: 1, step: 1 },
  hang: { group: 'Hold', label: 'Hang from grab point', value: 0.25, min: 0, max: 1, step: 0.05 },
  holdScale: { group: 'Hold', label: 'Scale when lifted', value: 0.06, min: 0, max: 0.2, step: 0.01 },
  swing: { group: 'Hold', label: 'Swing', value: 18, min: 0, max: 50, step: 1 },
  swingStiffness: { group: 'Hold', label: 'Swing stiffness', value: 400, min: 100, max: 1000, step: 10 },
  swingDamping: { group: 'Hold', label: 'Swing damping', value: 22, min: 5, max: 60, step: 1 },
  pitch: { group: 'Hold', label: 'Pitch', value: 10, min: 0, max: 30, step: 1 },

  // Flick
  flickProjection: { group: 'Flick', label: 'Coast-past line', value: 100, min: 40, max: 240, step: 5, hint: 'px a released card must coast to' },
  flickDistance: { group: 'Flick', label: 'Pull distance', value: 60, min: 20, max: 160, step: 5 },
  flickVelocity: { group: 'Flick', label: 'Throw speed', value: 250, min: 100, max: 1000, step: 10, hint: 'px/s upward' },
  snapBackDuration: { group: 'Flick', label: 'Drop-back time', value: 0.45, min: 0.2, max: 1, step: 0.05 },
  snapBackBounce: { group: 'Flick', label: 'Drop-back bounce', value: 0.3, min: 0, max: 0.6, step: 0.02 },

  // Deal
  flightDuration: { group: 'Deal', label: 'Flight time', value: 0.42, min: 0.2, max: 0.9, step: 0.02, hint: 'seconds from hand to stack' },
  overshoot: { group: 'Deal', label: 'Landing overshoot', value: 1.3, min: 1, max: 1.8, step: 0.05, hint: '1 lands dead; higher sails past and settles back' },
  landing: { group: 'Deal', label: 'Layout', value: 0, min: 0, max: 3, step: 1, options: ['Row', 'Overlap', 'Stack', 'Angled'], hint: 'Angled is the earlier spread with the glowing outline' },
  rowWidth: { group: 'Deal', label: 'Card width in row', value: 112, min: 64, max: 160, step: 4 },
  rowGap: { group: 'Deal', label: 'Gap between cards in row', value: 12, min: 4, max: 32, step: 4 },
  overlapWidth: { group: 'Deal', label: 'Card width in overlap', value: 160, min: 96, max: 240, step: 4 },
  overlapStep: { group: 'Deal', label: 'Card edges showing in overlap', value: 48, min: 16, max: 120, step: 4, hint: 'px of each card left of the one on top; tightens to fit the screen' },
  stackWidth: { group: 'Deal', label: 'Card width in stack', value: 264, min: 160, max: 360, step: 4 },
  stackPeek: { group: 'Deal', label: 'Card tops showing in stack', value: 44, min: 12, max: 64, step: 4, hint: 'px of each card above the one in front' },
  stackRoom: { group: 'Deal', label: 'Room kept for the drum', value: 360, min: 200, max: 560, step: 4, hint: 'px up from the screen bottom the stack stays above; tops tighten to fit' },
  pileScale: { group: 'Deal', label: 'Card size in spread', value: 0.44, min: 0.25, max: 0.7, step: 0.01, hint: 'angled spread only' },
  spacing: { group: 'Deal', label: 'Card spacing', value: 52, min: 24, max: 90, step: 1, hint: 'angled spread only' },
  rowStep: { group: 'Deal', label: 'Row spacing', value: 40, min: 30, max: 120, step: 2, hint: 'angled spread only' },
  perRow: { group: 'Deal', label: 'Cards per row', value: 5, min: 2, max: 6, step: 1, hint: 'angled spread only' },
  scatter: { group: 'Deal', label: 'Scatter', value: 4, min: 0, max: 12, step: 0.5, hint: 'angled spread only: turns and nudges, degrees' },
  toss: { group: 'Deal', label: 'Toss height', value: 0.1, min: 0, max: 0.4, step: 0.01, hint: 'how much it lifts off the table mid-flight' },
  titleGap: { group: 'Deal', label: 'Gap below title', value: 40, min: 8, max: 160, step: 4 },
} satisfies Record<string, Omit<Param, 'value'> & { value: number }>

export type TuneKey = keyof typeof defs
export const params: Record<TuneKey, Param> = defs

const STORAGE_KEY = 'benny-tune-v1'

function load(): Partial<Record<TuneKey, number>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const stored = typeof window === 'undefined' ? {} : load()

export const tune = Object.fromEntries(
  Object.entries(params).map(([key, p]) => [key, motionValue(stored[key as TuneKey] ?? p.value)]),
) as Record<TuneKey, MotionValue<number>>

let version = 0
const listeners = new Set<() => void>()
// Set while taking values from another page, so they aren't written back
// (two pages echoing each other's half-applied changes would undo a Reset).
let following = false
for (const value of Object.values(tune)) {
  value.on('change', () => {
    version++
    listeners.forEach((l) => l())
    if (following) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(changedValues()))
    } catch {}
  })
}

// Another page on this site changed the values (the desktop preview's panel
// driving the phone inside it, or a second tab): follow along.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    let next: Partial<Record<TuneKey, number>> = {}
    try {
      next = JSON.parse(e.newValue ?? '{}')
    } catch {}
    following = true
    for (const key of Object.keys(params) as TuneKey[]) tune[key].set(next[key] ?? params[key].value)
    following = false
  })
  window.addEventListener('message', (e) => {
    if (e.origin === window.location.origin && e.data?.type === 'benny-speed') setTimeScale(Number(e.data.value) || 1)
  })
}

// Re-render when any value changes, for things that are baked in at render
// time (spring configs).
export function useTune() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
    () => 0,
  )
}

// 1 when the system asks for reduced motion. Flourishes read through fx(),
// so they drop to zero there while gestures that follow the finger stay.
export const reducedMotion = motionValue(0)
if (typeof window !== 'undefined') {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.set(query.matches ? 1 : 0)
  query.addEventListener('change', (e) => reducedMotion.set(e.matches ? 1 : 0))
}

type Flourish = 'lean' | 'tick' | 'swing' | 'pitch' | 'hang' | 'scatter' | 'toss'
export const fx = (key: Flourish) => (reducedMotion.get() ? 0 : tune[key].get())

export function changedValues() {
  const out: Partial<Record<TuneKey, number>> = {}
  for (const key of Object.keys(params) as TuneKey[]) {
    if (tune[key].get() !== params[key].value) out[key] = tune[key].get()
  }
  return out
}

export function resetTune() {
  for (const key of Object.keys(params) as TuneKey[]) tune[key].set(params[key].value)
}

// Slow motion for inspecting hand-offs. Framer reads performance.now() each
// frame, so scaling it slows every spring; timers and CSS animations follow.
let timeScale = 1
let installed = false
export function setTimeScale(scale: number) {
  if (!installed) installTimeScale()
  timeScale = scale
  document.getAnimations().forEach((a) => (a.playbackRate = scale))
}

function installTimeScale() {
  installed = true
  const realNow = performance.now.bind(performance)
  let realBase = realNow()
  let virtualBase = realBase
  let lastScale = 1
  performance.now = () => {
    const real = realNow()
    if (timeScale !== lastScale) {
      virtualBase = virtualBase + (real - realBase) * lastScale
      realBase = real
      lastScale = timeScale
    }
    return virtualBase + (real - realBase) * timeScale
  }
  const realTimeout = window.setTimeout.bind(window)
  const realInterval = window.setInterval.bind(window)
  window.setTimeout = ((fn: TimerHandler, ms = 0, ...args: unknown[]) =>
    realTimeout(fn, ms / timeScale, ...args)) as typeof window.setTimeout
  window.setInterval = ((fn: TimerHandler, ms = 0, ...args: unknown[]) =>
    realInterval(fn, ms / timeScale, ...args)) as typeof window.setInterval
  // New CSS animations start at normal speed; catch them as they appear.
  realInterval(() => {
    if (timeScale !== 1) document.getAnimations().forEach((a) => (a.playbackRate = timeScale))
  }, 100)
}
