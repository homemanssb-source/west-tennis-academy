import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import TopBar from '@/components/ui/TopBar'
import LessonSlotGrid from '@/components/member/LessonSlotGrid'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function SchedulePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = await createAdminClient()
  const monthKey = format(new Date(), 'yyyy-MM')

  const { data: slots } = await admin
    .from('lesson_slots')
    .select('*')
    .eq('member_id', session.userId)
    .gte('scheduled_at', `${monthKey}-01T00:00:00`)
    .order('scheduled_at', { ascending: true })

  return (
    <div className="flex flex-col">
      <TopBar title="레슨 일정" subtitle={format(new Date(), 'yyyy년 M월', { locale: ko })} />
      <div className="px-4 pt-4 pb-24">
        <LessonSlotGrid slots={slots ?? []} />
      </div>
    </div>
  )
}
