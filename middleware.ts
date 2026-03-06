import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'wta-session'

// 역할별 허용 경로
const ROLE_PATHS: Record<string, string[]> = {
  owner:   ['/owner', '/admin', '/coach', '/payment'],
  admin:   ['/admin'],
  coach:   ['/coach'],
  payment: ['/payment'],
  member:  ['/member'],
}

// 역할별 로그인 후 기본 이동 경로
const ROLE_HOME: Record<string, string> = {
  owner:   '/owner',
  admin:   '/admin',
  coach:   '/coach',
  payment: '/payment',
  member:  '/member',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── /setup 보호: 쿠키 있으면 차단 ──
  if (pathname === '/setup') {
    const session = req.cookies.get(COOKIE)?.value
    if (session) {
      try {
        const user = JSON.parse(Buffer.from(session, 'base64').toString())
        return NextResponse.redirect(new URL(ROLE_HOME[user.role] ?? '/', req.url))
      } catch {}
    }
    return NextResponse.next()
  }

  // ── /auth/* 는 통과 ──
  if (pathname.startsWith('/auth') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // ── 보호 경로 체크 ──
  const isProtected = Object.values(ROLE_PATHS).flat()
    .some(p => pathname.startsWith(p))

  if (!isProtected) return NextResponse.next()

  // ── 세션 확인 ──
  const raw = req.cookies.get(COOKIE)?.value
  if (!raw) {
    const role = pathname.split('/')[1]
    return NextResponse.redirect(new URL(`/auth/${role}`, req.url))
  }

  try {
    const user = JSON.parse(Buffer.from(raw, 'base64').toString())
    const allowed = ROLE_PATHS[user.role] ?? []

    // 해당 역할이 접근 가능한 경로인지 확인
    const canAccess = allowed.some(p => pathname.startsWith(p))
    if (!canAccess) {
      return NextResponse.redirect(new URL(ROLE_HOME[user.role] ?? '/', req.url))
    }

    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/', req.url))
  }
}

export const config = {
  matcher: [
    '/setup',
    '/owner/:path*',
    '/admin/:path*',
    '/coach/:path*',
    '/payment/:path*',
    '/member/:path*',
  ],
}
