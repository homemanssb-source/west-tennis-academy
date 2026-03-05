'use client'
import { usePathname, useRouter } from 'next/navigation'

interface NavItem {
  icon: string
  label: string
  href: string
}

interface BottomNavProps {
  items: NavItem[]
}

export default function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#F0F7F0]/97 backdrop-blur-md border-t border-forest/10 flex pb-2">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all ${
              isActive ? 'text-forest' : 'text-[#9AB89A]'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className={`text-[10px] tracking-[.5px] font-medium ${isActive ? 'text-forest' : ''}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}