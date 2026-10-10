import type { HandCard } from '@/lib/demo-cards'

// Low-fi placeholder art. Swap for the real card images once the motion is right.
export function CardFace({ card }: { card: HandCard }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[inherit] border border-white/10"
      style={{
        background: `linear-gradient(135deg, oklch(42% 0.07 ${card.hue}), oklch(24% 0.05 ${card.hue}))`,
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-3.5">
        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/50">{card.issuer}</span>
        <span className="h-[18px] w-[24px] rounded-[4px] bg-white/20" />
        <span className="text-[13px] font-semibold text-white/90">{card.name}</span>
      </div>
    </div>
  )
}
