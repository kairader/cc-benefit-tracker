import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
          gap: '4px',
        }}
      >
        {colors.map((color, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: '14px',
              backgroundColor: color,
              borderRadius: '2px',
            }}
          />
        ))}
      </div>
    ),
    { ...size }
  )
}
