import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const accountId = req.nextUrl.searchParams.get('account_id')
  if (!accountId) return NextResponse.json([], { status: 200 })

  const { data, error } = await supabaseAdmin
    .from('family_members')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
