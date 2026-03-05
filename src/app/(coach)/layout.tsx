import BottomNav from '@/components/ui/BottomNav'

const COACH_NAV = [
  { icon: '🏠', label: '대시보드', href: '/coach/dashboard' },
  { icon: '🔄', label: '보강요청', href: '/coach/makeup-requests' },
  { icon: '➕', label: '수업추가', href: '/coach/extra-lesson' },
  { icon: '👥', label: '회원',     href: '/coach/members' },
]

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
      <BottomNav items={COACH_NAV} />
    </div>
  )
}
