fhref: '/owner/lesson-plans',import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
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
    { label: '전체 회원', value: memberCount ?? 0, unit: '명', color: '#16A34A', bg: '#f0fdf4', href: '/owner/members' },
    { label: '코치',      value: coachCount ?? 0,  unit: '명', color: '#1d4ed8', bg: '#eff6ff', href: '/owner/coaches' },
    { label: '가입 신청', value: appCount ?? 0,    unit: '건', color: '#854d0e', bg: '#fef9c3', href: '/owner/applications' },
    { label: '미납',      value: unpaidCount ?? 0, unit: '건', color: '#b91c1c', bg: '#fef2f2', href: '/owner/payment' },
  ]

  const menuGroups = [
    {
      title: '수업 관리',
      color: '#16A34A',
      items: [
        { emoji: '📺', label: '실시간 현황',   sub: '코치별 수업 라이브뷰',         href: '/owner/dashboard',     badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '📅', label: '스케줄',        sub: '전체 수업 시간표',              href: '/owner/schedule',      badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '📆', label: '주간 스케줄',   sub: '전체 코치 주간 수업표',         href: '/owner/weekly',        badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '📝', label: '스케줄 등록',   sub: '레슨 플랜 등록',                href: '/owner/lesson-plan',   badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '📋', label: '플랜 목록',     sub: '등록된 레슨플랜 조회·수정',     href: '/owner/lesson-plan-list',  badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '📬', label: '수업 신청',     sub: '회원 신청 승인·거절 관리',      href: '/owner/lesson-applications', badge: 0,           badgeColor: '',        badgeBg: '' },
        { emoji: '📋', label: '플랜 복사',     sub: '지난달 플랜 이번달로 복사',     href: '/owner/lesson-copy',   badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '🏆', label: '수업 프로그램', sub: '프로그램 종류 관리',            href: '/owner/programs',      badge: programCount ?? 0, badgeColor: '#15803d', badgeBg: '#dcfce7' },
      ]
    },
    {
      title: '회원 · 코치',
      color: '#1d4ed8',
      items: [
        { emoji: '📋', label: '회원 가입서',   sub: '신청 확인 및 승인',             href: '/owner/applications',  badge: appCount ?? 0,     badgeColor: '#854d0e', badgeBg: '#fef9c3' },
        { emoji: '👥', label: '회원 관리',     sub: '회원 등록·수정·이력',           href: '/owner/members',       badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '🎾', label: '코치 관리',     sub: '코치 등록·수정',                href: '/owner/coaches',       badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '⚠️', label: '미등록 탐지',  sub: '이번달 미등록 회원 확인',       href: '/owner/unregistered',  badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '🔔', label: '알림 발송',     sub: '회원·코치에게 공지',            href: '/owner/notifications', badge: 0,                 badgeColor: '',        badgeBg: '' },
      ]
    },
    {
      title: '납부 · 분석',
      color: '#b91c1c',
      items: [
        { emoji: '💰', label: '납부 관리',     sub: '납부 현황·상태 변경',           href: '/owner/payment',       badge: unpaidCount ?? 0,  badgeColor: '#b91c1c', badgeBg: '#fee2e2' },
        { emoji: '📊', label: '월별 리포트',   sub: '수업·납부 현황 분석',           href: '/owner/reports',       badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '💹', label: '연간 매출',     sub: '월별 수입 추이 그래프',         href: '/owner/revenue',       badge: 0,                 badgeColor: '',        badgeBg: '' },
        { emoji: '📈', label: '코치 부하',     sub: '코치별 수업수·완료율 비교',     href: '/owner/coach-stats',   badge: 0,                 badgeColor: '',        badgeBg: '' },
      ]
    },
    {
      title: '시스템',
      color: '#6b7280',
      items: [
        { emoji: '⚙️', label: '시스템 설정',  sub: 'PIN·월·스탭 관리',             href: '/owner/settings',      badge: 0,                 badgeColor: '',        badgeBg: '' },
      ]
    },
  ]

  return (
    <>
      <style>{`
        .owner-wrap { background: #f9fafb; min-height: 100vh; }
        .owner-header { background: #16A34A; padding: 1.5rem; }
        .owner-header-inner { max-width: 960px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .owner-body { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
        .menu-groups { display: flex; flex-direction: column; gap: 1.25rem; }
        .group-title { font-family: Oswald, sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #9ca3af; margin-bottom: 0.625rem; display: flex; align-items: center; gap: 0.5rem; }
        .group-title::before { content: ''; display: inline-block; width: 3px; height: 14px; border-radius: 2px; background: var(--gcolor); }
        .menu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.625rem; }
        .menu-item { background: white; border: 1.5px solid #f3f4f6; border-radius: 1rem; padding: 1rem 1rem; display: flex; align-items: center; gap: 0.75rem; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: box-shadow .15s, border-color .15s; }
        .menu-item:hover { box-shadow: 0 3px 8px rgba(0,0,0,.08); border-color: #e5e7eb; }
        .menu-emoji { font-size: 1.5rem; flex-shrink: 0; }
        .menu-label { font-weight: 700; font-size: 0.875rem; color: #111827; }
        .menu-sub { font-size: 0.7rem; color: #9ca3af; margin-top: 1px; }
        .menu-arrow { color: #d1d5db; margin-left: auto; flex-shrink: 0; font-size: 1rem; }
        .badge { font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 9999px; margin-left: 4px; }
        @media (max-width: 768px) {
          .owner-body { padding: 1rem; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem; }
          .menu-grid { grid-template-columns: repeat(1, 1fr); gap: 0.5rem; }
          .menu-item { padding: 0.875rem 1rem; border-radius: 0.875rem; }
          .owner-header { padding: 1.25rem 1rem; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .menu-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
      <div className="owner-wrap">
        {/* 헤더 */}
        <div className="owner-header">
          <div className="owner-header-inner">
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>WTA</div>
              <div style={{ color: 'rgba(255,255,255,.75)', fontSize: '0.8rem', marginTop: '2px' }}>서부 테니스 아카데미</div>
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

        <div className="owner-body">
          {/* 통계 카드 */}
          <div className="stats-grid">
            {stats.map(s => (
              <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: s.bg, border: `1.5px solid ${s.color}22`, borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600, marginTop: '2px' }}>{s.unit} · {s.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* 메뉴 그룹 */}
          <div className="menu-groups">
            {menuGroups.map(group => (
              <div key={group.title}>
                <div className="group-title" style={{ '--gcolor': group.color } as React.CSSProperties}>
                  {group.title}
                </div>
                <div className="menu-grid">
                  {group.items.map(m => (
                    <Link key={m.href} href={m.href} className="menu-item">
                      <span className="menu-emoji">{m.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="menu-label">{m.label}</span>
                          {m.badge > 0 && (
                            <span className="badge" style={{ background: m.badgeBg, color: m.badgeColor }}>{m.badge}</span>
                          )}
                        </div>
                        <div className="menu-sub">{m.sub}</div>
                      </div>
                      <span className="menu-arrow">›</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <LogoutButton />
          </div>
        </div>
      </div>
    </>
  )
}