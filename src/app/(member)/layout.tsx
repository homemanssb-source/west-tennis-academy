import BottomNav from '@/components/ui/BottomNav'

const MEMBER_NAV = [
  { icon: '🏠', label: '홈',    href: '/home' },
  { icon: '🔄', label: '보강',  href: '/makeup' },
  { icon: '📅', label: '일정',  href: '/schedule' },
  { icon: '👤', label: '내정보', href: '/profile' },
]

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
      <BottomNav items={MEMBER_NAV} />
    </div>
  )
}
