import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function PaymentDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!['payment_manager', 'admin'].includes(session.role)) redirect('/')

  const admin = await createAdminClient()
  const monthKey = format(new Date(), 'yyyy-MM')

  // 이번 달 납부 현황
  const { data: plans } = await admin
    .from('lesson_plans')
    .select('id, payment_status, price, member_id, member:member_id(name, display_name, coach_id, coach:coach_id(name))')
    .gte('created_at', `${monthKey}-01`)
    .order('payment_status', { ascending: true })

  const unpaid   = plans?.filter(p => p.payment_status === 'unpaid')   ?? []
  const partial  = plans?.filter(p => p.payment_status === 'partial')  ?? []
  const paid     = plans?.filter(p => p.payment_status === 'paid')     ?? []
  const pending  = plans?.filter(p => p.payment_status === 'pending')  ?? []

  const totalAmount  = plans?.reduce((s, p) => s + (p.price ?? 0), 0) ?? 0
  const paidAmount   = paid.reduce((s, p) => s + (p.price ?? 0), 0)
  const unpaidAmount = unpaid.reduce((s, p) => s + (p.price ?? 0), 0) + partial.reduce((s, p) => s + (p.price ?? 0), 0)

  // 대기 중인 수업 추가 요청
  const { count: extraPending } = await admin
    .from('extra_lessons')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // 최근 결제 내역
  const { data: recentPayments } = await admin
    .from('payments')
    .select('*, member:member_id(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="flex flex-col">
      <TopBar title="결제 대시보드" subtitle={`${monthKey}`} />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* 수금 현황 요약 */}
        <div className="bg-gradient-to-br from-[#1B4D2E] to-[#163d24] rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-1 tracking-wider">{monthKey} 수금 현황</div>
          <div className="font-oswald text-3xl font-bold text-white mb-1">
            {paidAmount.toLocaleString()}원
          </div>
          <div className="text-xs text-white/60">
            목표 {totalAmount.toLocaleString()}원 중 {totalAmount > 0 ? Math.round(paidAmount / totalAmount * 100) : 0}% 수금
          </div>
          {/* 프로그레스 바 */}
          <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3DB840] rounded-full transition-all"
              style={{ width: `${totalAmount > 0 ? Math.min(paidAmount / totalAmount * 100, 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-white/50">
            <span>미납 {unpaidAmount.toLocaleString()}원</span>
            <span>{plans?.length ?? 0}명 중 {paid.length}명 완납</span>
          </div>
        </div>

        {/* 납부 상태 통계 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '완납',  val: paid.length,    cls: 'text-green-600',  bg: 'bg-green-50'  },
            { label: '미납',  val: unpaid.length,  cls: 'text-red-600',    bg: 'bg-red-50'    },
            { label: '부분',  val: partial.length, cls: 'text-amber-600',  bg: 'bg-amber-50'  },
            { label: '대기',  val: pending.length, cls: 'text-blue-600',   bg: 'bg-blue-50'   },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <div className={`font-oswald text-2xl font-bold ${s.cls}`}>{s.val}</div>
              <div className="text-[10px] text-[#5A8A5A] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 수업 추가 대기 알림 */}
        {(extraPending ?? 0) > 0 && (
          <a href="/payment/extra-approve"
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#0F2010]">
                수업 추가 요청 {extraPending}건 대기 중
              </div>
              <div className="text-xs text-[#5A8A5A] mt-0.5">코치 요청 승인이 필요합니다</div>
            </div>
            <span className="text-amber-600">→</span>
          </a>
        )}

        {/* 미납 회원 */}
        {unpaid.length > 0 && (
          <>
            <div className="wta-section-label"><span className="opacity-40">//</span> 미납 회원 ({unpaid.length})</div>
            <div className="space-y-2">
              {unpaid.slice(0, 5).map(plan => {
                const member = plan.member as any
                const coach = member?.coach as any
                return (
                  <a key={plan.id} href={`/payment/members?planId=${plan.id}`}
                    className="wta-card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center font-bold text-red-600 text-sm">
                        {(member?.display_name ?? member?.name ?? '?').charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#0F2010]">
                          {member?.display_name ?? member?.name}
                        </div>
                        <div className="text-xs text-[#5A8A5A]">{coach?.name} 코치</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-semibold text-red-600">
                        {(plan.price ?? 0).toLocaleString()}원
                      </div>
                      <span className="badge-red">미납</span>
                    </div>
                  </a>
                )
              })}
              {unpaid.length > 5 && (
                <a href="/payment/members" className="block text-center text-sm text-[#5A8A5A] py-2 underline">
                  +{unpaid.length - 5}명 더 보기
                </a>
              )}
            </div>
          </>
        )}

        {/* 최근 결제 내역 */}
        {(recentPayments?.length ?? 0) > 0 && (
          <>
            <div className="wta-section-label"><span className="opacity-40">//</span> 최근 결제</div>
            <div className="wta-card divide-y divide-[#1B4D2E]/6">
              {recentPayments?.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-[#0F2010]">{(p.member as any)?.name}</div>
                    <div className="text-xs text-[#5A8A5A] font-mono">
                      {format(new Date(p.created_at), 'M/d HH:mm', { locale: ko })}
                      {p.method ? ` · ${p.method}` : ''}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold text-[#1B4D2E]">
                    +{p.amount.toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
