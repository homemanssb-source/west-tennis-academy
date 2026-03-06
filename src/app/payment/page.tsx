import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'

export default async function PaymentHomePage() {
  const session = await getSession()
  if (!session || !['owner','payment'].includes(session.role)) redirect('/auth/payment')

  const menus = [
    { emoji: '💰', label: '납부 관리',   sub: '납부 현황 확인 및 상태 변경', href: '/payment/list' },
    { emoji: '📷', label: '영수증 관리', sub: '카드·현금 영수증 사진 첨부',   href: '/payment/receipts' },
  ]

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: '#92400e', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: 'white' }}>WTA</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.8rem' }}>결제담당 대시보드</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <NotificationBell />
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>💳 {session.name}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {menus.map(m => (
          <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize: '1.75rem' }}>{m.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{m.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{m.sub}</div>
              </div>
              <div style={{ color: '#d1d5db' }}>›</div>
            </div>
          </Link>
        ))}

        <form action="/api/auth/logout" method="POST" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button type="submit" style={{ background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.625rem 1.5rem', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            로그아웃
          </button>
        </form>
      </div>
    </div>
  )
}
