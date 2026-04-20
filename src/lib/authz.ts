import 'server-only'
import { NextResponse } from 'next/server'
import { getSession } from './session'
import { Role, SessionUser } from './types'

/**
 * 세션이 없거나 허용 역할이 아니면 NextResponse 반환(401/403), 아니면 세션 반환.
 * 사용 예:
 *   const g = await requireRole('owner', 'admin')
 *   if (g instanceof NextResponse) return g
 *   // g: SessionUser
 */
export async function requireRole(
  ...allowed: Role[]
): Promise<SessionUser | NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }
  if (allowed.length > 0 && !allowed.includes(session.role)) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }
  return session
}

/** 로그인만 확인 (역할 무관). */
export async function requireSession(): Promise<SessionUser | NextResponse> {
  return requireRole()
}
