import BottomNav from '@/components/ui/BottomNav'

const PAYMENT_NAV = [
  { icon: '💳', label: '대시보드', href: '/payment/dashboard' },
  { icon: '👥', label: '회원납부', href: '/payment/members' },
  { icon: '➕', label: '수업승인', href: '/payment/extra-approve' },
]

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {children}
      <BottomNav items={PAYMENT_NAV} />
    </div>
  )
}
