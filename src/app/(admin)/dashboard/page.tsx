import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function AdminDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const admin = await createAdminClient()
  const monthKey = format(new Date(), 'yyyy-MM')

  const [
    { count: totalMembers },
    { count: totalCoaches },
    { count: activeMembers },
    { data: plans },
    { count: pendingMakeups },
    { count: pendingExtras },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true).is('parent_id', null),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'coach').eq('is_active', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true),
    admin.from('lesson_plans').select('payment_status, price').gte('created_at', `${monthKey}-01`),
    admin.from('makeup_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('extra_lessons').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const paidPlans   = plans?.filter(p => p.payment_status === 'paid')   ?? []
  const unpaidPlans = plans?.filter(p => p.payment_status === 'unpaid') ?? []
  const totalRevenue = paidPlans.reduce((s, p) => s + (p.price ?? 0), 0)
  const unpaidRevenue = unpaidPlans.reduce((s, p) => s + (p.price ?? 0), 0)

  const { data: recentMembers } = await admin
    .from('profiles')
    .select('id, name, role, created_at, coach:coach_id(name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="flex flex-col">
      <TopBar title="관리자" subtitle={format(new Date(), 'yyyy년 M월', { locale: ko })} />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* 핵심 지표 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '👥', val: totalMembers ?? 0,  label: '활성 회원',    color: 'text-[#1B4D2E]' },
            { icon: '🎾', val: totalCoaches ?? 0,  label: '코치',         color: 'text-[#1B4D2E]' },
            { icon: '🔄', val: pendingMakeups ?? 0, label: '보강 대기',   color: 'text-[#C85A1E]' },
            { icon: '➕', val: pendingExtras ?? 0,  label: '수업추가 대기', color: 'text-amber-600' },
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

        {/* 이달 수금 현황 */}
        <div className="bg-gradient-to-br from-[#1B4D2E] to-[#163d24] rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-1">{monthKey} 수금</div>
          <div className="font-oswald text-3xl font-bold text-white mb-3">
            {totalRevenue.toLocaleString()}원
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs text-white/60 mb-1">완납</div>
              <div className="font-oswald text-xl font-bold text-[#3DB840]">{paidPlans.length}명</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs text-white/60 mb-1">미납 잔액</div>
              <div className="font-oswald text-xl font-bold text-[#C85A1E]">
                {unpaidRevenue.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>

        {/* 알림 배너 */}
        {((pendingMakeups ?? 0) > 0 || (pendingExtras ?? 0) > 0) && (
          <div className="space-y-2">
            {(pendingMakeups ?? 0) > 0 && (
              <a href="/admin/members" className="flex items-center gap-3 bg-[#C85A1E]/8 border border-[#C85A1E]/20 rounded-xl p-3">
                <span>🔄</span>
                <span className="text-sm text-[#0F2010]">보강 요청 {pendingMakeups}건 대기 중</span>
                <span className="ml-auto text-[#C85A1E]">→</span>
              </a>
            )}
            {(pendingExtras ?? 0) > 0 && (
              <a href="/payment/extra-approve" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <span>➕</span>
                <span className="text-sm text-[#0F2010]">수업 추가 {pendingExtras}건 승인 대기</span>
                <span className="ml-auto text-amber-600">→</span>
              </a>
            )}
          </div>
        )}

        {/* 빠른 메뉴 */}
        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 관리 메뉴</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '👥', title: '회원 관리',    desc: '등록/수정/비활성화', href: '/admin/members'           },
              { icon: '🎾', title: '코치 관리',    desc: 'PIN 발급/역할 설정', href: '/admin/coaches'           },
              { icon: '📋', title: '약관 관리',    desc: '약관 버전 등록',     href: '/admin/terms'             },
              { icon: '💳', title: '결제 대시보드', desc: '수금 현황 조회',     href: '/payment/dashboard'       },
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

        {/* 최근 가입 */}
        {(recentMembers?.length ?? 0) > 0 && (
          <>
            <div className="wta-section-label"><span className="opacity-40">//</span> 최근 가입</div>
            <div className="wta-card divide-y divide-[#1B4D2E]/6">
              {recentMembers?.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-[#0F2010]">{m.name}</div>
                    <div className="text-xs text-[#5A8A5A]">
                      {(m.coach as any)?.name ? `${(m.coach as any).name} 코치 · ` : ''}
                      {format(new Date(m.created_at), 'M/d', { locale: ko })} 가입
                    </div>
                  </div>
                  <span className={m.role === 'coach' ? 'badge-blue' : m.role === 'admin' ? 'badge-red' : 'badge-gray'}>
                    {m.role === 'member' ? '회원' : m.role === 'coach' ? '코치' : m.role === 'admin' ? '관리자' : '결제'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
