import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '서부 테니스 아카데미',
  description: '서부 테니스 아카데미 회원 관리 앱',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'WEST TENNIS' },
}

export const viewport: Viewport = {
  themeColor: '#1B4D2E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700&family=Noto+Serif+KR:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F0F7F0] text-[#0F2010] font-noto antialiased">
        {children}
      </body>
    </html>
  )
}