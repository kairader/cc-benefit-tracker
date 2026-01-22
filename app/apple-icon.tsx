import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const barWidth = 14
  const barHeight = 64
  const gap = 16
  const radius = 7

  const colors = ['#b8c4ce', '#e8e4dc', '#c4b896']

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          gap: `${gap}px`,
        }}
      >
        {colors.map((color, i) => (
          <div
            key={i}
            style={{
              width: `${barWidth}px`,
              height: `${barHeight}px`,
              backgroundColor: color,
              borderRadius: `${radius}px`,
            }}
          />
        ))}
      </div>
    ),
    {
      ...size,
    }
  )
}
