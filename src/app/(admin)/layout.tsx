import BottomNav from '@/components/ui/BottomNav'

const ADMIN_NAV = [
  { icon: '📊', label: '대시보드', href: '/admin/dashboard' },
  { icon: '👥', label: '회원관리', href: '/admin/members'   },
  { icon: '🎾', label: '코치관리', href: '/admin/coaches'   },
  { icon: '📋', label: '약관관리', href: '/admin/terms'     },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
      <BottomNav items={ADMIN_NAV} />
    </div>
  )
}
