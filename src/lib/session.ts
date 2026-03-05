import { cookies } from 'next/headers'

export interface WtaSession {
  userId: string
  role: string
  name: string
  exp: number
}

export async function getSession(): Promise<WtaSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('wta_session')?.value
  if (!raw) return null
  try {
    const session = JSON.parse(Buffer.from(raw, 'base64').toString()) as WtaSession
    if (session.exp < Date.now()) return null
    return session
  } catch {
    return null
  }
}
