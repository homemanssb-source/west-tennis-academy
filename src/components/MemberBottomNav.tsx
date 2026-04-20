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
    <>
      <style>{`
        .member-bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: calc(3.5rem + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: white;
          border-top: 1px solid #f3f4f6;
          display: flex;
          z-index: 30;
          box-shadow: 0 -1px 0 rgba(0,0,0,.06);
        }
        .member-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-size: 0.65rem;
          font-weight: 600;
          color: #9ca3af;
          text-decoration: none;
          position: relative;
          min-height: 44px;
          -webkit-tap-highlight-color: transparent;
          transition: color 0.15s;
        }
        .member-nav-item.active { color: #7e22ce; }
        .member-nav-item.active::after {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 2rem; height: 2px;
          background: #7e22ce;
          border-radius: 0 0 2px 2px;
        }
        .member-nav-icon {
          font-size: 1.25rem;
          line-height: 1;
          display: inline-block;
          width: 1.5rem;
          text-align: center;
          overflow: hidden;
        }
        .member-nav-badge {
          position: absolute;
          top: 5px;
          left: 50%;
          transform: translateX(4px);
          background: #ef4444;
          color: white;
          font-size: 0.55rem;
          font-weight: 700;
          min-width: 14px;
          height: 14px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
          border: 1.5px solid white;
          pointer-events: none;
        }
        .member-bottom-spacer {
          height: calc(3.5rem + env(safe-area-inset-bottom, 0px));
          flex-shrink: 0;
        }
      `}</style>

      <div className="member-bottom-spacer" />

      <nav className="member-bottom-nav" role="navigation" aria-label="메인 메뉴">
        {navItems.map(item => {
          const active   = isActive(item.href)
          const hasBadge = item.href === '/member/apply' && pendingAppCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`member-nav-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="member-nav-icon" aria-hidden="true">{item.emoji}</span>
              <span>{item.label}</span>
              {hasBadge && (
                <span className="member-nav-badge" aria-label={`처리중 ${pendingAppCount}건`}>
                  {pendingAppCount > 9 ? '9+' : pendingAppCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}