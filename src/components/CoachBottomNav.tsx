'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/coach',              emoji: '🏠', label: '홈' },
  { href: '/coach/applications', emoji: '📋', label: '신청확인' },
  { href: '/coach/payment',      emoji: '💰', label: '납부' },
  { href: '/coach/blocks',       emoji: '🚫', label: '휴무' },
  { href: '/coach/schedule',     emoji: '📅', label: '스케줄' },
]

export default function CoachBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/coach') return pathname === '/coach'
    return pathname.startsWith(href)
  }

  return (
    <div className="bottom-nav">
      {navItems.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`bottom-nav-item${isActive(item.href) ? ' active' : ''}`}
        >
          <span style={{ fontSize: '1.25rem' }}>{item.emoji}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  )
}
