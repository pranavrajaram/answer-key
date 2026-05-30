import { ImageResponse } from 'next/og'

export const alt = 'Answer Key Stock Market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#1c1917',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 40, color: '#5eead4', fontWeight: 700, marginBottom: 16 }}>
          Answer Key
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, color: '#fafaf9', letterSpacing: '-2px' }}>
          Stock Market
        </div>
        <div style={{ fontSize: 36, color: '#a8a29e', marginTop: 20 }}>
          Trade shares of your friends
        </div>
      </div>
    ),
    size
  )
}
