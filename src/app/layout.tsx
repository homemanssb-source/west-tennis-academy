import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '서부 테니스 아카데미',
  description: '서부 테니스 아카데미 레슨 관리 앱',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WTA',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="application-name" content="WTA" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WTA" />
        <meta name="theme-color" content="#16A34A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.svg" />
        <link rel="icon" type="image/svg+xml" href="/icon-512.svg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
