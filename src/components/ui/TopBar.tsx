'use client'
import { useRouter } from 'next/navigation'

interface TopBarProps {
  title: string
  subtitle?: string
  showBack?: boolean
  rightSlot?: React.ReactNode
}

export default function TopBar({ title, subtitle, showBack = false, rightSlot }: TopBarProps) {
  const router = useRouter()
  return (
    <div className="sticky top-0 z-50 bg-[#F0F7F0]/95 backdrop-blur-md border-b border-forest/10 flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-forest/8 border border-forest/15 flex items-center justify-center text-forest text-lg"
          >
            ←
          </button>
        )}
        <div>
          <div className="font-oswald text-base font-semibold tracking-[2px] text-forest">{title}</div>
          {subtitle && <div className="text-[9px] text-[#5A8A5A] tracking-[1.5px]">{subtitle}</div>}
        </div>
      </div>
      {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
    </div>
  )
}