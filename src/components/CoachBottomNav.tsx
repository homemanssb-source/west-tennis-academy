'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/coach',              emoji: '🏠', label: '홈' },
  { href: '/coach/applications', emoji: '📋', label: '신청' },
  { href: '/coach/payment',      emoji: '💰', label: '납부' },
  { href: '/coach/blocks',       emoji: '🚫', label: '휴무' },
  { href: '/coach/schedule',     emoji: '📅', label: '일정' },
]

export default function CoachBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/coach') return pathname === '/coach'
    return pathname.startsWith(href)
  }

  return (
    <>
      <style>{`
        .coach-bottom-nav {
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
        .coach-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-size: 0.6rem;
          font-weight: 600;
          color: #9ca3af;
          text-decoration: none;
          position: relative;
          min-height: 44px;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
          transition: color 0.15s;
        }
        .coach-nav-item.active { color: #1d4ed8; }
        .coach-nav-item.active::after {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 2rem; height: 2px;
          background: #1d4ed8;
          border-radius: 0 0 2px 2px;
        }
        .coach-nav-icon {
          font-size: 1.2rem;
          line-height: 1;
          display: inline-block;
          width: 1.5rem;
          text-align: center;
        }
        .coach-nav-label { font-size: 0.6rem; line-height: 1; white-space: nowrap; }
        .coach-bottom-spacer {
          height: calc(3.5rem + env(safe-area-inset-bottom, 0px));
          flex-shrink: 0;
        }
      `}</style>

      <div className="coach-bottom-spacer" />

      <nav className="coach-bottom-nav" role="navigation" aria-label="코치 메뉴">
        {navItems.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`coach-nav-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="coach-nav-icon" aria-hidden="true">{item.emoji}</span>
              <span className="coach-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}