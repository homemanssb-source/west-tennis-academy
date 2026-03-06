import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'

export default async function OwnerDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/auth/owner')

  const [
    { count: memberCount },
    { count: coachCount },
    { count: appCount },
    { count: unpaidCount },
    { count: programCount },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach').eq('is_active', true),
    supabaseAdmin.from('member_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('lesson_plans').select('*', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
    supabaseAdmin.from('lesson_programs').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const stats = [
    { label: '전체 회원',  value: memberCount ?? 0, unit: '명', color: '#16A34A', bg: '#f0fdf4', href: '/owner/members' },
    { label: '코치',       value: coachCount ?? 0,  unit: '명', color: '#1d4ed8', bg: '#eff6ff', href: '/owner/coaches' },
    { label: '가입 신청',  value: appCount ?? 0,    unit: '건', color: '#854d0e', bg: '#fef9c3', href: '/owner/applications' },
    { label: '미납',       value: unpaidCount ?? 0, unit: '건', color: '#b91c1c', bg: '#fef2f2', href: '/owner/payment' },
  ]

  const menus = [
    { emoji: '📺', label: '실시간 현황',   sub: '코치별 수업 라이브뷰',      href: '/owner/dashboard',      badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '📋', label: '회원 가입서',   sub: '신청 확인 및 승인',          href: '/owner/applications',   badge: appCount ?? 0,    badgeColor: '#854d0e', badgeBg: '#fef9c3' },
    { emoji: '👥', label: '회원 관리',     sub: '회원 등록·수정·이력',        href: '/owner/members',         badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '🎾', label: '코치 관리',     sub: '코치 등록·수정',             href: '/owner/coaches',         badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '📅', label: '스케줄',        sub: '전체 수업 시간표',            href: '/owner/schedule',        badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '💰', label: '납부 관리',     sub: '납부 현황·상태 변경',         href: '/owner/payment',         badge: unpaidCount ?? 0, badgeColor: '#b91c1c', badgeBg: '#fee2e2' },
    { emoji: '🏆', label: '수업 프로그램', sub: '프로그램 종류 관리',          href: '/owner/programs',        badge: programCount ?? 0, badgeColor: '#15803d', badgeBg: '#dcfce7' },
    { emoji: '📊', label: '월별 리포트',   sub: '수업·납부 현황 분석',         href: '/owner/reports',         badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '⚠️', label: '미등록 탐지',  sub: '이번달 미등록 회원 확인',     href: '/owner/unregistered',    badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '🔔', label: '알림 발송',     sub: '회원·코치에게 공지',          href: '/owner/notifications',   badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '💹', label: '연간 매출',     sub: '월별 수입 추이 그래프',       href: '/owner/revenue',     badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '📈', label: '코치 부하',     sub: '코치별 수업 수·완료율 비교',  href: '/owner/coach-stats', badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '📋', label: '플랜 복사',     sub: '지난달 플랜 이번달로 복사',   href: '/owner/lesson-copy', badge: 0, badgeColor: '', badgeBg: '' },
    { emoji: '⚙️', label: '시스템 설정',  sub: 'PIN·월·스탭 관리',            href: '/owner/settings',        badge: 0, badgeColor: '', badgeBg: '' },
  ]

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: '#16A34A', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>WTA</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '0.8rem', marginTop: '2px' }}>서부 테니스 아카데미</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <NotificationBell />
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>👑 {session.name}</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.75rem', marginTop: '2px' }}>운영자</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {stats.map(s => (
            <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: s.bg, border: `1.5px solid ${s.color}22`, borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: s.color, fontWeight: 600 }}>{s.unit} · {s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
          {menus.map(m => (
            <Link key={m.label} href={m.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize: '1.75rem', flexShrink: 0 }}>{m.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{m.label}</span>
                    {m.badge > 0 && (
                      <span style={{ background: m.badgeBg, color: m.badgeColor, fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px' }}>{m.badge}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{m.sub}</div>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '1.1rem' }}>›</div>
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

