import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

export async function POST(req: NextRequest) {
  const { profile_id, title, body, link } = await req.json()
  await sendPushToUser(profile_id, title, body, link)
  return NextResponse.json({ ok: true })
}
