import type { Metadata, Viewport } from 'next'
import { Oswald, Noto_Sans_KR, Noto_Serif_KR, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
})
const notoSans = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-noto',
  weight: ['400', '500', '700'],
  display: 'swap',
})
const notoSerif = Noto_Serif_KR({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '600', '700'],
  display: 'swap',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '서부 테니스 아카데미',
  description: '레슨 예약, 보강 신청, 결제 관리를 한 곳에서',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WestTennis',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1B4D2E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${oswald.variable} ${notoSans.variable} ${notoSerif.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WestTennis" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={notoSans.className}>
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered'); })
                  .catch(function(err) { console.log('SW error:', err); });
              });
            }
          `
        }} />
      </body>
    </html>
  )
}
