import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function CoachDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['coach', 'admin'].includes(session.role)) redirect('/')

  const admin = await createAdminClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const monthKey = format(new Date(), 'yyyy-MM')

  // 오늘 레슨 슬롯
  const { data: todaySlots } = await admin
    .from('lesson_slots')
    .select('*, member:member_id(name, display_name)')
    .eq('coach_id', session.userId)
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })

  // 담당 회원 수
  const { count: memberCount } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', session.userId)
    .eq('is_active', true)
    .eq('is_primary', true)

  // 대기 중인 보강 요청
  const { data: pendingMakeups } = await admin
    .from('makeup_requests')
    .select('*, member:member_id(name)')
    .eq('coach_id', session.userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // 이번 달 완료 레슨
  const { count: completedCount } = await admin
    .from('lesson_slots')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', session.userId)
    .eq('status', 'completed')
    .gte('scheduled_at', `${monthKey}-01T00:00:00`)

  return (
    <div className="flex flex-col">
      <TopBar title="코치 대시보드" subtitle={session.name} />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '👥', val: memberCount ?? 0,    label: '담당 회원',     color: 'text-[#1B4D2E]' },
            { icon: '🔄', val: pendingMakeups?.length ?? 0, label: '보강 대기',  color: 'text-[#C85A1E]' },
            { icon: '📅', val: todaySlots?.length ?? 0,     label: '오늘 레슨',  color: 'text-[#1B4D2E]' },
            { icon: '✅', val: completedCount ?? 0,  label: '이달 완료',    color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="wta-card flex items-center gap-3">
              <div className="text-2xl">{s.icon}</div>
              <div>
                <div className={`font-oswald text-2xl font-bold ${s.color}`}>{s.val}</div>
                <div className="text-[10px] text-[#5A8A5A]">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 보강 대기 알림 */}
        {(pendingMakeups?.length ?? 0) > 0 && (
          <a href="/coach/makeup-requests"
            className="flex items-center gap-3 bg-[#C85A1E]/8 border border-[#C85A1E]/20 rounded-xl p-4">
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#0F2010]">
                보강 요청 {pendingMakeups?.length}건 대기 중
              </div>
              <div className="text-xs text-[#5A8A5A] mt-0.5">24시간 내 응답해 주세요</div>
            </div>
            <span className="text-[#C85A1E]">→</span>
          </a>
        )}

        {/* 오늘 레슨 일정 */}
        <div>
          <div className="wta-section-label">
            <span className="opacity-40">//</span>
            오늘 레슨 — {format(new Date(), 'M월 d일 (EEE)', { locale: ko })}
          </div>
          {(todaySlots?.length ?? 0) === 0 ? (
            <div className="wta-card text-center py-8 text-sm text-[#5A8A5A]">
              오늘 예정된 레슨이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {todaySlots?.map(slot => {
                const member = slot.member as any
                const time = format(new Date(slot.scheduled_at), 'HH:mm')
                return (
                  <div key={slot.id} className="wta-card flex items-center gap-4">
                    <div className="font-mono text-lg font-bold text-[#1B4D2E] w-14">{time}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#0F2010]">
                        {member?.display_name ?? member?.name ?? '알 수 없음'}
                      </div>
                      <div className="text-xs text-[#5A8A5A] mt-0.5">
                        {slot.duration_min}분
                        {slot.is_makeup && <span className="ml-1 text-[#C85A1E]">· 보강</span>}
                        {slot.is_extra && <span className="ml-1 text-amber-600">· 추가</span>}
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-lg ${
                      slot.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-[#EAF3EA] text-[#1B4D2E]'
                    }`}>
                      {slot.status === 'completed' ? '완료' : '예정'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 빠른 메뉴 */}
        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 빠른 메뉴</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🔄', title: '보강 요청',   desc: '승인 / 거절',     href: '/coach/makeup-requests' },
              { icon: '➕', title: '수업 추가',   desc: '결제담당에게 요청', href: '/coach/extra-lesson'    },
              { icon: '👥', title: '담당 회원',   desc: '회원 현황 조회',   href: '/coach/members'         },
              { icon: '🚫', title: '휴무 등록',   desc: '일괄 취소 처리',   href: '/coach/block'           },
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
