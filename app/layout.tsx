import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import RoutePrefetcher from '@/components/RoutePrefetcher'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Answer Key',
  description: 'A prediction market for friends',
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full antialiased`}>
        {children}
        <RoutePrefetcher />
      </body>
    </html>
  )
}
