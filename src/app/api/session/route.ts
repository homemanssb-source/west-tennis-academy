// src/app/api/session/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  return NextResponse.json({
    id:   session.id,
    name: session.name,
    role: session.role,
  })
}
