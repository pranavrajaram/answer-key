import type { Metadata, Viewport } from 'next'
import { Inter, Geist } from 'next/font/google'
import Script from 'next/script'
import RoutePrefetcher from '@/components/RoutePrefetcher'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const inter = Inter({ subsets: ['latin'] })

const themeInitScript = `
(function(){
  try {
    var k = 'ak-theme';
    var t = localStorage.getItem(k) || 'system';
    var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', d);
    document.documentElement.style.colorScheme = d ? 'dark' : 'light';
  } catch (e) {}
})();
`

export const metadata: Metadata = {
  title: 'Answer Key',
  description: 'A prediction market for friends',
  appleWebApp: {
    capable: true,
    title: 'Answer Key',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`h-full font-sans ${geist.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} min-h-full antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>
          {children}
          <RoutePrefetcher />
        </ThemeProvider>
      </body>
    </html>
  )
}
