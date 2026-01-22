import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'
export const size = { width: 192, height: 192 }
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
          gap: '16px',
        }}
      >
        {colors.map((color, i) => (
          <div
            key={i}
            style={{
              width: '14px',
              height: '68px',
              backgroundColor: color,
              borderRadius: '7px',
            }}
          />
        ))}
      </div>
    ),
    { ...size }
  )
}
