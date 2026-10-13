'use client'

// A soft paper tick, made on the fly with Web Audio so there's no file to
// load: a short burst of filtered noise for the card edge and a low knock
// for the drum. Browsers only allow sound after a touch, so the first touch
// primes it.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let last = 0

export function primeClick() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.03), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
    }
  } catch {}
}

export function click(volume = 1) {
  if (!ctx || !noise || ctx.state !== 'running') return
  const now = ctx.currentTime
  // A fast fling passes many cards; keep the ticks distinct rather than a buzz.
  if (now - last < 0.035) return
  last = now

  const edge = ctx.createBufferSource()
  edge.buffer = noise
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2400
  band.Q.value = 1.2
  const edgeGain = ctx.createGain()
  edgeGain.gain.setValueAtTime(0.35 * volume, now)
  edgeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
  edge.connect(band).connect(edgeGain).connect(ctx.destination)
  edge.start(now)

  const knock = ctx.createOscillator()
  knock.frequency.setValueAtTime(190, now)
  knock.frequency.exponentialRampToValueAtTime(90, now + 0.04)
  const knockGain = ctx.createGain()
  knockGain.gain.setValueAtTime(0.18 * volume, now)
  knockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  knock.connect(knockGain).connect(ctx.destination)
  knock.start(now)
  knock.stop(now + 0.06)

  navigator.vibrate?.(4)
}
