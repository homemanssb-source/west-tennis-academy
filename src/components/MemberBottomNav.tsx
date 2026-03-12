'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  pendingAppCount?: number
}

const navItems = [
  { href: '/member',          emoji: '🏠', label: '홈' },
  { href: '/member/schedule', emoji: '📅', label: '스케줄' },
  { href: '/member/apply',    emoji: '🎾', label: '신청' },
  { href: '/member/payment',  emoji: '💰', label: '납부' },
  { href: '/member/family',   emoji: '👨‍👩‍👧', label: '가족' },
]

export default function MemberBottomNav({ pendingAppCount = 0 }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/member') return pathname === '/member'
    return pathname.startsWith(href)
  }

  return (
    <div className="bottom-nav">
      {navItems.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`bottom-nav-item${isActive(item.href) ? ' active' : ''}`}
          style={{ position: 'relative' }}
        >
          <span style={{ fontSize: '1.25rem' }}>{item.emoji}</span>
          <span>{item.label}</span>
          {item.href === '/member/apply' && pendingAppCount > 0 && (
            <span style={{
              position: 'absolute', top: '4px', right: '8px',
              background: '#ef4444', color: 'white',
              fontSize: '0.6rem', fontWeight: 700,
              padding: '1px 5px', borderRadius: '9999px',
            }}>
              {pendingAppCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
