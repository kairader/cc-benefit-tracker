'use client'

import { MotionValue, motion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  className?: string
  animateOnMount?: boolean
}

function Digit({ place, value, animateOnMount }: { place: number; value: number; animateOnMount?: boolean }) {
  const valueRoundedToPlace = Math.floor(value / place)
  const isFirstRender = useRef(true)

  const animatedValue = useSpring(animateOnMount ? 0 : valueRoundedToPlace, {
    stiffness: 150,
    damping: 20,
    mass: 0.5,
  })

  useEffect(() => {
    if (isFirstRender.current && animateOnMount) {
      isFirstRender.current = false
      const timer = setTimeout(() => {
        animatedValue.set(valueRoundedToPlace)
      }, 100)
      return () => clearTimeout(timer)
    }
    animatedValue.set(valueRoundedToPlace)
  }, [animatedValue, valueRoundedToPlace, animateOnMount])

  return (
    <span className="inline-block w-[1ch] h-[1lh] relative overflow-hidden">
      {[...Array(10).keys()].map((i) => (
        <NumberSpan key={i} mv={animatedValue} number={i} />
      ))}
    </span>
  )
}

function NumberSpan({ mv, number }: { mv: MotionValue; number: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10
    let offset = (10 + number - placeValue) % 10

    if (offset > 5) {
      offset -= 10
    }

    return `${offset}lh`
  })

  return (
    <motion.span
      style={{ y }}
      className="absolute inset-x-0 top-0 flex items-center justify-center h-[1lh]"
    >
      {number}
    </motion.span>
  )
}

export function AnimatedNumber({ value, className = '', animateOnMount = false }: AnimatedNumberProps) {
  const hasDecimals = value % 1 !== 0
  const integerPart = Math.floor(value)
  const decimalPart = hasDecimals ? Math.round((value % 1) * 100) : 0

  const integerDigits = Math.max(1, Math.floor(Math.log10(Math.max(1, integerPart))) + 1)

  const integerPlaces: number[] = []
  for (let i = integerDigits - 1; i >= 0; i--) {
    integerPlaces.push(Math.pow(10, i))
  }

  return (
    <span className={`inline-flex tabular-nums ${className}`}>
      <span>$</span>
      {integerPlaces.map((place) => (
        <Digit key={`int-${place}`} place={place} value={integerPart} animateOnMount={animateOnMount} />
      ))}
      {hasDecimals && (
        <>
          <span>.</span>
          <Digit place={10} value={decimalPart} animateOnMount={animateOnMount} />
          <Digit place={1} value={decimalPart} animateOnMount={animateOnMount} />
        </>
      )}
    </span>
  )
}
