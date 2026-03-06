import { cookies } from 'next/headers'
import { SessionUser } from './types'

const COOKIE_NAME = 'wta-session'

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as SessionUser
  } catch {
    return null
  }
}

export function makeSessionCookie(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64')
}

export const SESSION_COOKIE = COOKIE_NAME
