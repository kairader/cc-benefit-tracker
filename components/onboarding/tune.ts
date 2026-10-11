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
}

const defs = {
  // Swipe
  fingerLock: { group: 'Swipe', label: 'Card stays under finger', value: 1, min: 0, max: 1, step: 1 },
  coast: { group: 'Swipe', label: 'Coast', value: 0.25, min: 0.05, max: 0.8, step: 0.01, hint: 'how far a fling carries, in seconds of travel' },
  tick: { group: 'Swipe', label: 'Detent tick', value: 4, min: 0, max: 12, step: 0.5, hint: 'px pop as each card passes the centre' },
  lean: { group: 'Swipe', label: 'Hand lean', value: 1.6, min: 0, max: 4, step: 0.1 },

  // Hand
  radius: { group: 'Hand', label: 'Arc radius', value: 760, min: 400, max: 1400, step: 10 },
  step: { group: 'Hand', label: 'Card spacing', value: 6.2, min: 3, max: 10, step: 0.1, hint: 'degrees' },
  spread: { group: 'Hand', label: 'Gap around centre card', value: 3.4, min: 0, max: 8, step: 0.1, hint: 'degrees' },
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
  friction: { group: 'Deal', label: 'Table friction', value: 0.22, min: 0.06, max: 0.4, step: 0.01, hint: 'seconds; higher slides further' },
  pileScale: { group: 'Deal', label: 'Card size in pile', value: 0.55, min: 0.3, max: 0.9, step: 0.01 },
  reveal: { group: 'Deal', label: 'Keep showing', value: 0.6, min: 0.1, max: 0.9, step: 0.05, hint: 'least share of each card left uncovered' },
  scatter: { group: 'Deal', label: 'Scatter', value: 6, min: 0, max: 20, step: 1, hint: 'random turn, degrees' },
  spinCarry: { group: 'Deal', label: 'Spin from flick', value: 1, min: 0, max: 3, step: 0.1 },
  toss: { group: 'Deal', label: 'Toss height', value: 0.1, min: 0, max: 0.4, step: 0.01, hint: 'how much it lifts off the table mid-flight' },
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
for (const value of Object.values(tune)) {
  value.on('change', () => {
    version++
    listeners.forEach((l) => l())
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(changedValues()))
    } catch {}
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

type Flourish = 'lean' | 'tick' | 'swing' | 'pitch' | 'hang' | 'spinCarry' | 'scatter' | 'toss'
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
