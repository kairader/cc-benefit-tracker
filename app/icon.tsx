import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function generateImageMetadata() {
  return [
    { id: 'small', size: { width: 32, height: 32 }, contentType: 'image/png' },
    { id: 'medium', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: 'large', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ]
}

export default function Icon({ id }: { id: string }) {
  const sizes: Record<string, { bar: number; height: number; gap: number; radius: number }> = {
    small: { bar: 3, height: 14, gap: 4, radius: 2 },
    medium: { bar: 14, height: 68, gap: 16, radius: 7 },
    large: { bar: 36, height: 180, gap: 42, radius: 18 },
  }

  const s = sizes[id] || sizes.large
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
          gap: `${s.gap}px`,
        }}
      >
        {colors.map((color, i) => (
          <div
            key={i}
            style={{
              width: `${s.bar}px`,
              height: `${s.height}px`,
              backgroundColor: color,
              borderRadius: `${s.radius}px`,
            }}
          />
        ))}
      </div>
    ),
    {
      width: id === 'small' ? 32 : id === 'medium' ? 192 : 512,
      height: id === 'small' ? 32 : id === 'medium' ? 192 : 512,
    }
  )
}
