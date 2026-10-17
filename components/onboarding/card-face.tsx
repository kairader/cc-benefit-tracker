import { cardImage, type HandCard } from '@/lib/demo-cards'

export function CardFace({ card }: { card: HandCard }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-neutral-800">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, art is pre-sized */}
      <img
        src={cardImage(card)}
        alt={`${card.issuer} ${card.name}`}
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
      {/* Hairline edge so light cards hold their shape against each other. */}
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.18)]" />
    </div>
  )
}
