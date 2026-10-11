'use client'

import { useState } from 'react'
import { changedValues, params, resetTune, setTimeScale, tune, useTune, type TuneKey } from './tune'

const SPEEDS = [
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
  useTune()
  const [open, setOpen] = useState(false)
  const [speed, setSpeed] = useState(1)
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
      <div className="space-y-2 border-b border-white/10 p-3">
        <div className="flex items-center gap-2">
          <span className="mr-auto text-sm">Tuning</span>
          <button type="button" onClick={copy} className="rounded-full bg-white/10 px-2 py-1">
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={resetTune} className="rounded-full bg-white/10 px-2 py-1">
            Reset
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-white/10 px-2 py-1">
            Restart
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white px-3 py-1 text-neutral-950">
            Done
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-auto text-neutral-400">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => pickSpeed(s.value)}
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
            {keys.map((key) => {
              const p = params[key]
              const value = tune[key].get()
              const changed = value !== p.value
              const toggle = p.min === 0 && p.max === 1 && p.step === 1
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
    </div>
  )
}
