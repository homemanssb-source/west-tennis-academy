import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'

export default async function AdminDashboard() {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) redirect('/auth/admin')

  const [
    { count: memberCount },
    { count: appCount },
    { count: unpaidCount },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true),
    supabaseAdmin.from('member_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('lesson_plans').select('*', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
  ])

  const menus = [
    { emoji: '📋', label: '회원 가입서',  sub: '신청 확인 및 승인',    href: '/admin/applications', badge: appCount ?? 0, badgeColor: '#854d0e', badgeBg: '#fef9c3' },
    { emoji: '👥', label: '회원 관리',    sub: '회원 등록·수정',        href: '/admin/members',      badge: memberCount ?? 0, badgeColor: '#15803d', badgeBg: '#dcfce7' },
    { emoji: '🎾', label: '코치 관리',    sub: '코치 등록·수정',        href: '/admin/coaches',      badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '💰', label: '납부 관리',    sub: '납부 현황·상태 변경',   href: '/admin/payment',      badge: unpaidCount ?? 0, badgeColor: '#b91c1c', badgeBg: '#fee2e2' },
    { emoji: '📅', label: '수업월 관리',  sub: '월 등록',               href: '/admin/settings',     badge: 0, badgeColor: '', badgeBg: '' },
  ]

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: '#15803d', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>WTA</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '0.8rem', marginTop: '2px' }}>관리자 대시보드</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>🛡️ {session.name}</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.75rem', marginTop: '2px' }}>관리자</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {menus.map(m => (
            <Link key={m.label} href={m.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize: '1.75rem', flexShrink: 0 }}>{m.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{m.label}</span>
                    {m.badge > 0 && (
                      <span style={{ background: m.badgeBg, color: m.badgeColor, fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px' }}>{m.badge}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{m.sub}</div>
                </div>
                <div style={{ color: '#d1d5db' }}>›</div>
              </div>
            </Link>
          ))}
        </div>

        <form action="/api/auth/logout" method="POST" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button type="submit" style={{ background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.625rem 1.5rem', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            로그아웃
          </button>
        </form>
      </div>
    </div>
  )
}
