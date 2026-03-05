'use client'

interface FamilyMember {
  id: string
  name: string
  display_name: string
  is_primary: boolean
  coach: { name: string } | null
  lesson_type: string
}

interface FamilyTabsProps {
  members: FamilyMember[]
  activeId: string
  onChange: (id: string) => void
}

export default function FamilyTabs({ members, activeId, onChange }: FamilyTabsProps) {
  if (members.length <= 1) return null

  return (
    <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none">
      {members.map((m) => {
        const isActive = activeId === m.id
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-2xl border-[1.5px] transition-all ${
              isActive
                ? 'bg-[#1B4D2E] border-[#1B4D2E] text-white shadow-md'
                : 'bg-white border-[#1B4D2E]/10 text-[#2A5A2A]'
            }`}
          >
            {/* 아바타 */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-oswald text-sm font-bold mb-1 ${
              isActive ? 'bg-white/20 text-white' : 'bg-[#EAF3EA] text-[#1B4D2E]'
            }`}>
              {m.is_primary ? '👤' : m.display_name.charAt(0)}
            </div>
            <span className="text-[11px] font-medium whitespace-nowrap">
              {m.is_primary ? '본인' : m.display_name}
            </span>
            {m.coach && (
              <span className={`text-[9px] mt-0.5 ${isActive ? 'text-white/70' : 'text-[#9AB89A]'}`}>
                {m.coach.name} 코치
              </span>
            )}
          </button>
        )
      })}

      {/* 가족 추가 버튼 */}
      <a
        href="/profile/family/add"
        className="flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-2xl border-[1.5px] border-dashed border-[#1B4D2E]/20 text-[#9AB89A] transition-all hover:border-[#1B4D2E]/40"
      >
        <div className="w-8 h-8 rounded-xl bg-[#EAF3EA] flex items-center justify-center text-lg mb-1">+</div>
        <span className="text-[11px] whitespace-nowrap">추가</span>
      </a>
    </div>
  )
}
