import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const res = NextResponse.redirect(new URL('/auth/owner', process.env.NEXT_PUBLIC_BASE_URL || 'https://west-tennis-academy.vercel.app'))
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
  return res
}