import { NextResponse } from 'next/server'

/** 성공 응답. 민감 정보 응답이면 sensitive=true 로 호출 → Cache-Control: no-store 적용. */
export function ok<T>(data: T, init?: { sensitive?: boolean; status?: number }) {
  const headers: Record<string, string> = {}
  if (init?.sensitive) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    headers['Pragma'] = 'no-cache'
  }
  return NextResponse.json(data, { status: init?.status ?? 200, headers })
}

/** 실패 응답. */
export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
