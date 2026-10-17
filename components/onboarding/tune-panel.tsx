'use client'

import { useState } from 'react'
import { changedValues, params, resetTune, setTimeScale, tune, useTune, type TuneKey } from './tune'

export const SPEEDS = [
  { label: '1×', value: 1 },
  { label: '½×', value: 0.5 },
  { label: '¼×', value: 0.25 },
  { label: '⅒×', value: 0.1 },
]

const groups = Object.entries(params).reduce<Record<string, TuneKey[]>>((acc, [key, p]) => {
  ;(acc[p.group] ??= []).push(key as TuneKey)
  return acc
}, {})

const decimals = (step: number) => (step >= 1 ? 0 : String(step).split('.')[1]?.length ?? 0)

// Live controls for the hand's physics. Only shown with ?tune in the URL.
export function TunePanel() {
  const [open, setOpen] = useState(false)
  const [speed, setSpeed] = useState(1)

  const pickSpeed = (value: number) => {
    setSpeed(value)
    setTimeScale(value)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-3 z-[70] rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur"
      >
        Tune{speed !== 1 && ` · ${SPEEDS.find((s) => s.value === speed)?.label}`}
      </button>
    )
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[70] mx-auto flex max-h-[60vh] max-w-md flex-col rounded-b-2xl bg-neutral-900/95 text-xs text-white shadow-2xl backdrop-blur">
      <TuneControls
        speed={speed}
        onSpeed={pickSpeed}
        onRestart={() => window.location.reload()}
        onDone={() => setOpen(false)}
      />
    </div>
  )
}

// The panel's contents, shared by the floating panel above and the desktop
// preview, which docks it beside a phone frame.
export function TuneControls({
  speed,
  onSpeed,
  onRestart,
  onDone,
}: {
  speed: number
  onSpeed: (value: number) => void
  onRestart: () => void
  onDone?: () => void
}) {
  useTune()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = JSON.stringify(changedValues(), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy these values', text)
    }
  }

  return (
    <>
      <div className="space-y-2 border-b border-white/10 p-3">
        <div className="flex items-center gap-2">
          <span className="mr-auto text-sm">Tuning</span>
          <button type="button" onClick={copy} className="rounded-full bg-white/10 px-2 py-1">
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={resetTune} className="rounded-full bg-white/10 px-2 py-1">
            Reset
          </button>
          <button type="button" onClick={onRestart} className="rounded-full bg-white/10 px-2 py-1">
            Restart
          </button>
          {onDone && (
            <button type="button" onClick={onDone} className="rounded-full bg-white px-3 py-1 text-neutral-950">
              Done
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-auto text-neutral-400">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onSpeed(s.value)}
              className={`rounded-full px-2 py-1 ${speed === s.value ? 'bg-white text-neutral-950' : 'bg-white/10'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="touch-pan-y overflow-y-auto overscroll-contain px-3 pb-3">
        {Object.entries(groups).map(([group, keys]) => (
          <section key={group} className="pt-3">
            <h3 className="pb-1 text-[11px] uppercase tracking-[0.08em] text-neutral-500">{group}</h3>
            {group === 'Glass' && <GlassCurve />}
            {keys.map((key) => {
              const p = params[key]
              const value = tune[key].get()
              const changed = value !== p.value
              const toggle = p.min === 0 && p.max === 1 && p.step === 1
              if (p.options) {
                return (
                  <div key={key} className="py-1">
                    <span className={changed ? 'text-white' : 'text-neutral-400'}>
                      {changed && <span className="mr-1 inline-block h-1 w-1 rounded-full bg-sky-400 align-middle" />}
                      {p.label}
                    </span>
                    <div className="mt-1 flex gap-1">
                      {p.options.map((option, i) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => tune[key].set(i)}
                          className={`flex-1 rounded-full px-2 py-1 ${value === i ? 'bg-white text-neutral-950' : 'bg-white/10'}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {p.hint && <span className="block pt-1 text-[11px] text-neutral-500">{p.hint}</span>}
                  </div>
                )
              }
              return (
                <label key={key} className="block py-1">
                  <span className="flex items-baseline gap-2">
                    <span className={changed ? 'text-white' : 'text-neutral-400'}>
                      {changed && <span className="mr-1 inline-block h-1 w-1 rounded-full bg-sky-400 align-middle" />}
                      {p.label}
                    </span>
                    {!toggle && <span className="ml-auto tabular-nums text-neutral-300">{value.toFixed(decimals(p.step))}</span>}
                    {toggle && (
                      <button
                        type="button"
                        onClick={() => tune[key].set(value ? 0 : 1)}
                        className={`ml-auto rounded-full px-2 py-0.5 ${value ? 'bg-white text-neutral-950' : 'bg-white/10'}`}
                      >
                        {value ? 'On' : 'Off'}
                      </button>
                    )}
                  </span>
                  {!toggle && (
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={value}
                      onChange={(e) => tune[key].set(Number(e.target.value))}
                      className="mt-1 w-full accent-white"
                    />
                  )}
                  {p.hint && <span className="block text-[11px] text-neutral-500">{p.hint}</span>}
                </label>
              )
            })}
          </section>
        ))}
      </div>
    </>
  )
}

// The glass fade's curve, drawn with its two handles: left is the top of the
// fade, right is full strength behind the button.
function GlassCurve() {
  const size = 96
  const x1 = tune.glassX1.get()
  const y1 = tune.glassY1.get()
  const x2 = tune.glassX2.get()
  const y2 = tune.glassY2.get()
  const px = (x: number) => x * size
  const py = (y: number) => size - y * size
  return (
    <div className="flex items-center gap-3 py-1">
      <svg width={size} height={size} viewBox={`-4 -4 ${size + 8} ${size + 8}`} className="shrink-0 overflow-visible">
        <rect x={0} y={0} width={size} height={size} fill="none" stroke="rgb(255 255 255 / 0.1)" />
        <line x1={px(0)} y1={py(0)} x2={px(x1)} y2={py(y1)} stroke="rgb(56 189 248 / 0.6)" />
        <line x1={px(1)} y1={py(1)} x2={px(x2)} y2={py(y2)} stroke="rgb(56 189 248 / 0.6)" />
        <path
          d={`M ${px(0)} ${py(0)} C ${px(x1)} ${py(y1)}, ${px(x2)} ${py(y2)}, ${px(1)} ${py(1)}`}
          fill="none"
          stroke="white"
          strokeWidth={1.5}
        />
        <circle cx={px(x1)} cy={py(y1)} r={3} fill="rgb(56 189 248)" />
        <circle cx={px(x2)} cy={py(y2)} r={3} fill="rgb(56 189 248)" />
      </svg>
      <code className="text-[11px] leading-4 text-neutral-400">
        cubic-bezier(
        <br />
        {x1.toFixed(2)}, {y1.toFixed(2)},
        <br />
        {x2.toFixed(2)}, {y2.toFixed(2)})
      </code>
    </div>
  )
}
