import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import TopBar from '@/components/ui/TopBar'

export default async function AdminCoachesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const admin = await createAdminClient()

  const { data: coaches } = await admin
    .from('profiles')
    .select('id, name, phone, is_active, pin_code, created_at')
    .eq('role', 'coach')
    .order('name', { ascending: true })

  // 각 코치의 담당 회원 수
  const coachIds = coaches?.map(c => c.id) ?? []
  const memberCounts: Record<string, number> = {}
  if (coachIds.length > 0) {
    const { data: counts } = await admin
      .from('profiles')
      .select('coach_id')
      .in('coach_id', coachIds)
      .eq('is_active', true)
      .eq('role', 'member')
    counts?.forEach(r => {
      if (r.coach_id) memberCounts[r.coach_id] = (memberCounts[r.coach_id] ?? 0) + 1
    })
  }

  return (
    <div className="flex flex-col">
      <TopBar title="코치 관리" subtitle={`${coaches?.length ?? 0}명`} showBack />

      <div className="px-4 pt-4 pb-24 space-y-3">

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          💡 PIN 초기화는 회원 관리 → 해당 코치 선택 후 가능합니다.
        </div>

        {coaches?.length === 0 ? (
          <div className="wta-card text-center py-12 text-sm text-[#5A8A5A]">등록된 코치가 없습니다.</div>
        ) : (
          coaches?.map(coach => (
            <div key={coach.id} className="wta-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    coach.is_active ? 'bg-[#EAF3EA] text-[#1B4D2E]' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {coach.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0F2010]">{coach.name} 코치</div>
                    <div className="text-xs text-[#5A8A5A] font-mono">{coach.phone}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-oswald text-xl font-bold text-[#1B4D2E]">
                    {memberCounts[coach.id] ?? 0}
                  </div>
                  <div className="text-[10px] text-[#5A8A5A]">담당 회원</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#1B4D2E]/6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${coach.pin_code ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-xs text-[#5A8A5A]">
                    {coach.pin_code ? 'PIN 설정됨' : 'PIN 미설정'}
                  </span>
                </div>
                <a href={`/admin/members?search=${coach.name}`}
                  className="px-3 py-1.5 rounded-xl bg-[#EAF3EA] text-[#1B4D2E] text-xs font-medium border border-[#1B4D2E]/15">
                  관리 →
                </a>
              </div>
            </div>
          ))
        )}

        {/* 코치 추가 안내 */}
        <div className="wta-card border-dashed text-center py-6">
          <div className="text-2xl mb-2">🎾</div>
          <div className="text-sm text-[#5A8A5A] mb-3">코치 추가는 회원 가입 후<br />역할을 코치로 변경하세요</div>
          <a href="/admin/members"
            className="inline-block px-4 py-2 rounded-xl bg-[#1B4D2E] text-white text-xs font-medium">
            회원 관리 →
          </a>
        </div>
      </div>
    </div>
  )
}
