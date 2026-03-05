'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import FamilyTabs from '@/components/member/FamilyTabs'
import LessonSlotGrid from '@/components/member/LessonSlotGrid'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { LessonSlot } from '@/types'

interface FamilyMember {
  id: string
  name: string
  display_name: string
  is_primary: boolean
  coach: { name: string } | null
  lesson_type: string
  coach_id: string
}

interface MemberHomeClientProps {
  userId: string
  userName: string
}

export default function MemberHomeClient({ userId, userName }: MemberHomeClientProps) {
  const supabase = createClient()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [activeId, setActiveId] = useState(userId)
  const [slots, setSlots] = useState<LessonSlot[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const monthKey = format(new Date(), 'yyyy-MM')
  const startOfMonth = `${monthKey}-01T00:00:00`
  const endOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd') + 'T23:59:59'

  // 가족 목록 로드
  useEffect(() => {
    fetch('/api/family')
      .then(r => r.json())
      .then(d => {
        setMembers(d.members ?? [])
      })
  }, [])

  // 활성 구성원 변경 시 데이터 로드
  useEffect(() => {
    loadMemberData(activeId)
  }, [activeId])

  async function loadMemberData(memberId: string) {
    setLoading(true)
    try {
      const [slotsRes, planRes] = await Promise.all([
        supabase
          .from('lesson_slots')
          .select('*')
          .eq('member_id', memberId)
          .gte('scheduled_at', startOfMonth)
          .lte('scheduled_at', endOfMonth)
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('lesson_plans')
          .select('*')
          .eq('member_id', memberId)
          .gte('created_at', `${monthKey}-01`)
          .maybeSingle(),
      ])
      setSlots(slotsRes.data ?? [])
      setPlan(planRes.data)
    } finally {
      setLoading(false)
    }
  }

  const activeMember = members.find(m => m.id === activeId)
  const coachName = activeMember?.coach?.name ?? '미배정'
  const payStatus = plan?.payment_status ?? 'unpaid'
  const totalLessons = plan?.total_lessons ?? 0
  const usedLessons = plan?.used_lessons ?? 0
  const remainLessons = Math.max(totalLessons - usedLessons, 0)

  const payBadge =
    payStatus === 'paid'    ? { label: '완납',   cls: 'badge-green' } :
    payStatus === 'unpaid'  ? { label: '미납',   cls: 'badge-red'   } :
    payStatus === 'pending' ? { label: '대기중', cls: 'badge-gold'  } :
                              { label: '부분납', cls: 'badge-gold'  }

  return (
    <div className="flex flex-col">
      {/* 상단바 */}
      <div className="sticky top-0 z-50 bg-[#F0F7F0]/95 backdrop-blur-md border-b border-[#1B4D2E]/10 flex items-center justify-between px-4 h-14">
        <div>
          <div className="font-oswald text-base font-semibold tracking-[2px] text-[#1B4D2E]">WEST TENNIS</div>
          <div className="text-[9px] text-[#5A8A5A] tracking-[1.5px]">ACADEMY</div>
        </div>
        <a href="/profile" className="w-9 h-9 rounded-xl bg-[#1B4D2E]/8 border border-[#1B4D2E]/15 flex items-center justify-center text-[#1B4D2E]">👤</a>
      </div>

      {/* 가족 탭 */}
      <FamilyTabs members={members} activeId={activeId} onChange={setActiveId} />

      <div className="px-4 pt-3 pb-24 space-y-4">

        {/* 인사 배너 */}
        <div className="bg-gradient-to-br from-[#1B4D2E] to-[#163d24] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute right-0 top-0 text-[100px] opacity-10 leading-none select-none">🎾</div>
          <div className="text-xs text-white/60 mb-1 tracking-wider">
            {activeMember?.is_primary ? '안녕하세요' : `${userName}님의 가족`}
          </div>
          <div className="font-serif text-2xl font-semibold text-white mb-3">
            {activeMember?.display_name ?? activeMember?.name ?? userName} {activeMember?.is_primary ? '님 👋' : ''}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={payBadge.cls}>{payBadge.label}</span>
            <span className="badge-gray">{coachName} 코치</span>
            <span className="badge-blue">
              {activeMember?.lesson_type === 'individual' ? '개인레슨' :
               activeMember?.lesson_type === 'group_2' ? '단체 2:1' :
               activeMember?.lesson_type === 'group_3' ? '단체 3:1' : '단체'}
            </span>
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: totalLessons,          label: '이번달 레슨', color: 'text-[#1B4D2E]' },
            { val: remainLessons,         label: '잔여',        color: 'text-[#C85A1E]' },
            { val: plan?.carried_over ?? 0, label: '이월',      color: 'text-amber-600'  },
          ].map(s => (
            <div key={s.label} className="wta-card text-center">
              <div className={`font-oswald text-3xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-[#5A8A5A] mt-1 tracking-[.5px]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 미납 경고 */}
        {payStatus === 'unpaid' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-sm text-red-700">
            <span>⚠️</span>
            <span>이번 달 레슨비가 미납 상태입니다.</span>
          </div>
        )}

        {/* 레슨 슬롯 */}
        <div className="wta-card">
          <div className="flex items-center justify-between mb-4">
            <span className="font-oswald text-base font-medium tracking-wider text-[#0F2010]">
              {format(new Date(), 'M월', { locale: ko })} 레슨 현황
            </span>
            <span className="badge-gray">{monthKey}</span>
          </div>
          {loading ? (
            <div className="text-center py-8 text-sm text-[#5A8A5A]">로딩 중...</div>
          ) : (
            <LessonSlotGrid slots={slots} />
          )}
        </div>

        {/* 빠른 메뉴 */}
        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 빠른 메뉴</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🔄', title: '보강 신청', desc: '취소된 레슨 보강', href: `/makeup?memberId=${activeId}` },
              { icon: '💳', title: '결제 현황', desc: '납부 확인',         href: '/schedule' },
              { icon: '👨‍👩‍👧', title: '가족 관리', desc: '구성원 추가/수정',   href: '/profile/family' },
              { icon: '👤', title: '내 정보',   desc: '프로필 수정',       href: '/profile' },
            ].map(m => (
              <a key={m.title} href={m.href}
                className="wta-card cursor-pointer hover:border-[#1B4D2E]/25 hover:shadow-md transition-all">
                <div className="text-3xl mb-2">{m.icon}</div>
                <div className="text-sm font-semibold text-[#0F2010]">{m.title}</div>
                <div className="text-xs text-[#5A8A5A] mt-1">{m.desc}</div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
