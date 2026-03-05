import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/ui/TopBar'
import { DAY_LABELS, LESSON_TYPE_LABELS } from '@/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, coach:coach_id(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const coachName = (profile.coach as any)?.name ?? '미배정'

  const rows = [
    { key: '전화번호',    val: profile.phone,        mono: true  },
    { key: '성별',        val: profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '-' },
    { key: '생년월일',    val: profile.birth_date ?? '-' },
    { key: '테니스 경력', val: profile.tennis_career ?? '-' },
    { key: '레슨 타입',   val: profile.lesson_type ? LESSON_TYPE_LABELS[profile.lesson_type as keyof typeof LESSON_TYPE_LABELS] : '-' },
    { key: '담당 코치',   val: `${coachName} 코치` },
    { key: '희망 요일',   val: (profile.preferred_days ?? []).map((d: string) => DAY_LABELS[d] ?? d).join(', ') || '-' },
    { key: '희망 시간',   val: (profile.preferred_times ?? []).join(', ') || '-', mono: true },
    { key: '자동 이월',   val: profile.auto_rollover ? '동의' : '비동의', green: profile.auto_rollover },
  ]

  return (
    <div className="flex flex-col">
      <TopBar title="내 정보" showBack />

      <div className="px-4 pt-4 pb-24">
        <div className="text-center py-6">
          <div className="w-[72px] h-[72px] rounded-2xl bg-forest border-2 border-forest/30 flex items-center justify-center font-oswald text-3xl text-white mx-auto mb-3">
            {profile.name.charAt(0)}
          </div>
          <div className="font-serif text-2xl font-semibold text-[#0F2010]">{profile.name}</div>
          <div className="text-xs text-[#5A8A5A] mt-1">Since {profile.created_at.slice(0, 7)}</div>
          <div className="flex gap-2 justify-center mt-2">
            <span className="badge-gray">{coachName} 코치</span>
            <span className="badge-blue">{profile.lesson_type ? LESSON_TYPE_LABELS[profile.lesson_type as keyof typeof LESSON_TYPE_LABELS] : '-'}</span>
          </div>
        </div>

        <div className="wta-card divide-y divide-forest/6">
          {rows.map(row => (
            <div key={row.key} className="flex justify-between items-center py-3">
              <span className="text-xs text-[#5A8A5A]">{row.key}</span>
              <span className={`text-sm font-medium text-[#0F2010] ${row.mono ? 'font-mono' : ''} ${row.green ? 'text-green-700' : ''}`}>
                {row.val}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="wta-btn-secondary text-center">로그아웃</button>
          </form>
        </div>

        <div className="mt-3">
          <button className="wta-btn-secondary text-clay border-clay/20 w-full">탈퇴하기</button>
        </div>
      </div>
    </div>
  )
}
