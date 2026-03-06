import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'

export default async function RootPage() {
  const session = await getSession()

  // 세션 있으면 역할별 홈으로
  if (session) {
    const roleHome: Record<string, string> = {
      owner: '/owner', admin: '/admin', coach: '/coach',
      payment: '/payment', member: '/member',
    }
    redirect(roleHome[session.role] ?? '/auth/owner')
  }

  // 운영자 없으면 setup으로
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
  if ((count ?? 0) === 0) redirect('/setup')

  // 랜딩 페이지
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '3rem', fontWeight: 700, color: '#16A34A', letterSpacing: '4px' }}>WTA</div>
        <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>서부 테니스 아카데미</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '320px' }}>
        {[
          { href: '/auth/owner',   emoji: '👑', label: '운영자 로그인',   color: '#78350f', bg: '#fef9c3' },
          { href: '/auth/admin',   emoji: '🛡️', label: '관리자 로그인',   color: '#15803d', bg: '#dcfce7' },
          { href: '/auth/coach',   emoji: '🎾', label: '코치 로그인',     color: '#1d4ed8', bg: '#dbeafe' },
          { href: '/auth/payment', emoji: '💳', label: '결제담당 로그인', color: '#92400e', bg: '#fde68a' },
          { href: '/auth/member',  emoji: '👤', label: '회원 로그인',     color: '#7e22ce', bg: '#ede9fe' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: item.bg, borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{item.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: item.color }}>{item.label}</span>
              <span style={{ marginLeft: 'auto', color: item.color, fontSize: '1.1rem' }}>›</span>
            </div>
          </Link>
        ))}

        <div style={{ borderTop: '1.5px solid #e5e7eb', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <Link href="/apply" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '1.5px solid #16A34A', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#16A34A' }}>회원 가입 신청</span>
              <span style={{ marginLeft: 'auto', color: '#16A34A', fontSize: '1.1rem' }}>›</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
