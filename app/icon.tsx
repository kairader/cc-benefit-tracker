import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

export default function Icon() {
  const barWidth = 36
  const barHeight = 180
  const gap = 32
  const radius = 18

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
