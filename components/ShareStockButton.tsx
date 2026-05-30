'use client'

import { useState } from 'react'

interface ShareStockButtonProps {
  ticker: string
  username: string
  price: number
}

// Shares the current stock page. Uses the native share sheet (Web Share API,
// available on iOS Safari / most mobile) when present, else copies the link to
// the clipboard. The shared URL unfurls into a price card in chats.
export default function ShareStockButton({ ticker, username, price }: ShareStockButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const shareData = {
      title: `$${ticker} on Answer Key`,
      text: `$${ticker} (${username}) is at ${price.toFixed(1)} pts — buy or sell on Answer Key`,
      url,
    }

    // Prefer the native share sheet (great on iOS — drops straight into iMessage).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked — last resort: select-prompt
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-white dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-200 dark:hover:border-stone-500 dark:hover:bg-stone-800/60"
      aria-label={`Share $${ticker}`}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 3v13M8 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Share
        </>
      )}
    </button>
  )
}
