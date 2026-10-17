'use client'

import dynamic from 'next/dynamic'

// Client-only: the frame fits itself to the window, and the tuning values
// live in localStorage.
const PhonePreview = dynamic(() => import('@/components/preview/phone-preview').then((m) => m.PhonePreview), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-neutral-900" />,
})

export default function PreviewPage() {
  return <PhonePreview />
}
