import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import TopBar from '@/components/ui/TopBar'

export default async function CoachMembersPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = await createAdminClient()
  const monthKey = new Date().toISOString().slice(0, 7)

  const { data: members } = await admin
    .from('profiles')
    .select(`
      id, name, display_name, lesson_type, preferred_days, preferred_times,
      parent_id, is_primary,
      lesson_plans!inner(payment_status, total_lessons, used_lessons)
    `)
    .eq('coach_id', session.userId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const grouped: Record<string, typeof members> = {}
  members?.forEach(m => {
    const key = m.parent_id ?? m.id
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(m)
  })

  const LESSON_LABELS: Record<string, string> = {
    individual: '개인', group_2: '2:1', group_3: '3:1', group_4: '4:1', group_other: '그룹',
  }
  const DAY_LABELS: Record<string, string> = {
    mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
  }

  return (
    <div className="flex flex-col">
      <TopBar title="담당 회원" subtitle={`총 ${members?.length ?? 0}명`} showBack />

      <div className="px-4 pt-4 pb-24 space-y-3">
        {members?.length === 0 ? (
          <div className="wta-card text-center py-12 text-sm text-[#5A8A5A]">
            담당 회원이 없습니다.
          </div>
        ) : (
          Object.entries(grouped).map(([groupKey, groupMembers]) => {
            const primary = groupMembers?.find(m => m.is_primary) ?? groupMembers?.[0]
            const children = groupMembers?.filter(m => !m.is_primary) ?? []
            if (!primary) return null

            const plan = (primary as any).lesson_plans?.[0]
            const payStatus = plan?.payment_status ?? 'unpaid'

            return (
              <div key={groupKey} className="wta-card space-y-3">
                {/* 주 회원 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1B4D2E] flex items-center justify-center font-oswald text-white font-bold">
                      {primary.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-[#0F2010] text-sm">{primary.name}</div>
                      <div className="text-xs text-[#5A8A5A] mt-0.5">
                        {LESSON_LABELS[primary.lesson_type ?? ''] ?? '-'} ·{' '}
                        {(primary.preferred_days ?? []).map((d: string) => DAY_LABELS[d] ?? d).join('')} ·{' '}
                        {(primary.preferred_times ?? []).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={
                      payStatus === 'paid'    ? 'badge-green' :
                      payStatus === 'unpaid'  ? 'badge-red'   : 'badge-gold'
                    }>
                      {payStatus === 'paid' ? '완납' : payStatus === 'unpaid' ? '미납' : '부분'}
                    </span>
                    {plan && (
                      <div className="text-xs text-[#5A8A5A] mt-1 font-mono">
                        {plan.used_lessons}/{plan.total_lessons}회
                      </div>
                    )}
                  </div>
                </div>

                {/* 가족 구성원 */}
                {children.length > 0 && (
                  <div className="pl-3 border-l-2 border-[#EAF3EA] space-y-2 mt-1">
                    {children.map(child => {
                      const childPlan = (child as any).lesson_plans?.[0]
                      return (
                        <div key={child.id} className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium text-[#2A5A2A]">
                              {child.display_name ?? child.name}
                            </span>
                            <span className="text-xs text-[#5A8A5A] ml-1">
                              · {LESSON_LABELS[child.lesson_type ?? ''] ?? '-'}
                            </span>
                          </div>
                          {childPlan && (
                            <span className={
                              childPlan.payment_status === 'paid' ? 'badge-green' :
                              childPlan.payment_status === 'unpaid' ? 'badge-red' : 'badge-gold'
                            }>
                              {childPlan.payment_status === 'paid' ? '완납' : '미납'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
