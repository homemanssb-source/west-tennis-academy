import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import MemberHomeClient from '@/components/member/MemberHomeClient'

export default async function MemberHomePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = await createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, name, role')
    .eq('id', session.userId)
    .single()

  if (!profile) redirect('/login')
  if (profile.role !== 'member') redirect('/')

  return (
    <MemberHomeClient
      userId={session.userId}
      userName={profile.name}
    />
  )
}
