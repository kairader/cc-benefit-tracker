'use client'

import { useEffect, useRef, useState } from 'react'
import { TuneControls } from '@/components/onboarding/tune-panel'

// A desktop stand-in for the phone: the onboarding runs at iPhone 17 Pro size
// (402 × 874) inside a device frame, with the tuning panel docked beside it.
// The panel and the phone are separate pages on the same site; slider values
// reach the phone through localStorage, and speed through postMessage.

const SCREEN = { w: 402, h: 874, radius: 55 }
const BEZEL = 12
const FRAME = { w: SCREEN.w + BEZEL * 2, h: SCREEN.h + BEZEL * 2 }
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function PhonePreview() {
  const stageRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLIFrameElement>(null)
  const [run, setRun] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [scale, setScale] = useState(1)

  // Fit the phone to the space beside the panel, never larger than life.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect()
      setScale(Math.min(1, (width - 64) / FRAME.w, (height - 80) / FRAME.h))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const sendSpeed = (value: number) =>
    phoneRef.current?.contentWindow?.postMessage({ type: 'benny-speed', value }, window.location.origin)

  const pickSpeed = (value: number) => {
    setSpeed(value)
    sendSpeed(value)
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-neutral-900 text-white">
      <div ref={stageRef} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4">
        <div style={{ width: FRAME.w * scale, height: FRAME.h * scale }}>
          <div
            className="relative origin-top-left rounded-[67px] bg-black shadow-[0_0_0_2px_#3a3a3c,0_0_0_3px_#1c1c1e]"
            style={{ width: FRAME.w, height: FRAME.h, transform: `scale(${scale})` }}
          >
            <div
              className="absolute overflow-hidden bg-neutral-950"
              style={{ left: BEZEL, top: BEZEL, width: SCREEN.w, height: SCREEN.h, borderRadius: SCREEN.radius }}
            >
              <iframe
                key={run}
                ref={phoneRef}
                title="Onboarding on a phone"
                src={`${base}/onboarding?embed=1`}
                onLoad={() => speed !== 1 && sendSpeed(speed)}
                className="block border-0"
                style={{ width: SCREEN.w, height: SCREEN.h }}
              />
              <StatusBar />
              <div className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[139px] -translate-x-1/2 rounded-full bg-white" />
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500 tabular-nums">
          iPhone 17 Pro · {SCREEN.w} × {SCREEN.h}
          {scale < 1 && ` · shown at ${Math.round(scale * 100)}%`}
        </p>
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-neutral-950 text-xs">
        <TuneControls speed={speed} onSpeed={pickSpeed} onRestart={() => setRun((r) => r + 1)} />
      </aside>
    </main>
  )
}

// The status bar and Dynamic Island the Home Screen app runs under. Drawn over
// the page, which leaves 62px for it.
function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[62px] text-white">
      <span className="absolute left-0 top-[19px] w-[136px] text-center text-[17px] font-semibold leading-[22px] tabular-nums">
        9:41
      </span>
      <div className="absolute left-1/2 top-[11px] h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
      <div className="absolute right-0 top-[23px] flex w-[136px] items-center justify-center gap-[6px]">
        <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor" aria-hidden>
          <rect x="0" y="7.5" width="3" height="4.5" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden>
          <path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.6 10.6 0 0 0 8.5.5 10.6 10.6 0 0 0 1 3.5l1.2 1.3a8.9 8.9 0 0 1 6.3-2.5Z" />
          <path d="M8.5 5.8c1.5 0 2.8.5 3.9 1.5l1.2-1.3a7.4 7.4 0 0 0-10.2 0l1.2 1.3c1-1 2.4-1.5 3.9-1.5Z" />
          <path d="M8.5 9.2c.6 0 1.1.2 1.5.6L8.5 11.5 7 9.8c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  )
}
