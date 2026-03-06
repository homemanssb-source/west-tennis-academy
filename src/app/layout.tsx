import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '서부 테니스 아카데미',
  description: '레슨 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
