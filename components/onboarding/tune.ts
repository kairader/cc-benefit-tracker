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

  // Flight
  flightYStiffness: { group: 'Flight', label: 'Vertical stiffness', value: 260, min: 60, max: 800, step: 10 },
  flightYDamping: { group: 'Flight', label: 'Vertical damping', value: 26, min: 5, max: 60, step: 1 },
  flightXStiffness: { group: 'Flight', label: 'Sideways stiffness', value: 170, min: 60, max: 800, step: 10, hint: 'lower than vertical curves the path' },
  flightXDamping: { group: 'Flight', label: 'Sideways damping', value: 22, min: 5, max: 60, step: 1 },
  spinCarry: { group: 'Flight', label: 'Spin carried from hand', value: 1, min: 0, max: 2, step: 0.1 },
  flightTilt: { group: 'Flight', label: 'Tilt into flight', value: 20, min: 0, max: 60, step: 1 },

  // Landing
  landDip: { group: 'Landing', label: 'Catch', value: 3, min: 0, max: 10, step: 0.5, hint: 'px the slot gives' },
  landSquash: { group: 'Landing', label: 'Squash', value: 0.1, min: 0, max: 0.3, step: 0.01 },
  landRipple: { group: 'Landing', label: 'Ripple', value: 1, min: 0, max: 1, step: 1 },
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

type Flourish = 'lean' | 'tick' | 'swing' | 'pitch' | 'hang' | 'spinCarry' | 'flightTilt' | 'landDip' | 'landSquash' | 'landRipple'
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
