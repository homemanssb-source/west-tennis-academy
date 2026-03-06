import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { targets, title, body, type, link } = await req.json()
  // targets: 'all' | 'members' | 'coaches' | string[] (profile_ids)

  let profileIds: string[] = []

  if (targets === 'all') {
    const { data } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true)
    profileIds = (data ?? []).map((p: any) => p.id)
  } else if (targets === 'members') {
    const { data } = await supabaseAdmin.from('profiles').select('id').eq('role', 'member').eq('is_active', true)
    profileIds = (data ?? []).map((p: any) => p.id)
  } else if (targets === 'coaches') {
    const { data } = await supabaseAdmin.from('profiles').select('id').eq('role', 'coach').eq('is_active', true)
    profileIds = (data ?? []).map((p: any) => p.id)
  } else if (Array.isArray(targets)) {
    profileIds = targets
  }

  if (!profileIds.length) return NextResponse.json({ error: '대상 없음' }, { status: 400 })

  const inserts = profileIds.map(id => ({ profile_id: id, title, body, type: type || 'info', link: link || null }))
  const { error } = await supabaseAdmin.from('notifications').insert(inserts)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, sent: profileIds.length })
}
