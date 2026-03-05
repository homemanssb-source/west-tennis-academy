import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/onboarding', '/set-pin', '/api/auth']

const ROLE_HOME: Record<string, string> = {
  member:          '/home',
  coach:           '/coach/dashboard',
  payment_manager: '/payment/dashboard',
  admin:           '/admin/dashboard',
}

const ROLE_ROUTES: Record<string, string[]> = {
  member:          ['/home', '/makeup', '/schedule', '/profile'],
  coach:           ['/coach'],
  payment_manager: ['/payment'],
  admin:           ['/admin', '/coach', '/payment', '/home'],
}

function parseSession(raw: string | undefined) {
  if (!raw) return null
  try {
    const session = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (session.exp < Date.now()) return null
    return session
  } catch { return null }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/_next') || path.startsWith('/favicon')) return NextResponse.next()
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return NextResponse.next()

  const session = parseSession(request.cookies.get('wta_session')?.value)
  if (!session) return NextResponse.redirect(new URL('/login', request.url))

  const role = session.role as string
  if (path === '/') return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url))

  const allowed = ROLE_ROUTES[role] ?? []
  if (!allowed.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
