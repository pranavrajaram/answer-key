import { ImageResponse } from 'next/og'

export const size = {
  width: 64,
  height: 64,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0f766e 0%, #14b8a6 58%, #67e8f9 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 12,
            width: 24,
            height: 18,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 2px 8px rgba(6, 78, 59, 0.25)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: 10,
            width: 30,
            height: 22,
            borderRadius: 13,
            background: 'rgba(240, 253, 250, 0.96)',
            boxShadow: '0 2px 8px rgba(6, 78, 59, 0.22)',
          }}
        />
        <svg width="52" height="40" viewBox="0 0 52 40" fill="none">
          <path
            d="M5 30L16 23L26 25L36 14L47 17"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="23" r="3.5" fill="#14B8A6" />
          <circle cx="26" cy="25" r="3.5" fill="#14B8A6" />
          <circle cx="36" cy="14" r="3.5" fill="#0F766E" />
          <path d="M43 15.5L47.5 17.5L45.5 22" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            width: 48,
            height: 14,
            borderRadius: 999,
            background: 'rgba(8, 47, 73, 0.16)',
          }}
        />
      </div>
    ),
    size
  )
}
