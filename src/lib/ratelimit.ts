import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

// Upstash Redis 환경변수 미설정이어도 앱이 죽지 않도록 안전 래핑
let redis: Redis | null = null
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv()
  }
} catch {
  redis = null
}

function makeLimiter(tokens: number, window: `${number} ${'s' | 'm' | 'h'}`) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: 'wta:rl',
  })
}

// 프리셋
export const RL = {
  login:     makeLimiter(5,  '1 m'),  // IP당 1분 5회 (PIN 브루트포스 차단)
  pinChange: makeLimiter(5,  '5 m'),
  apply:     makeLimiter(3,  '10 m'), // 공개 신청 스팸 차단
  generic:   makeLimiter(60, '1 m'),
} as const

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xr = req.headers.get('x-real-ip')
  if (xr) return xr
  return 'unknown'
}

/**
 * 제한 초과 시 NextResponse 를 반환. 통과면 null.
 * 사용 예: const block = await checkRate(RL.login, req); if (block) return block
 */
export async function checkRate(
  limiter: Ratelimit | null,
  req: NextRequest,
  extraKey = ''
): Promise<NextResponse | null> {
  if (!limiter) return null // Redis 미설정 환경에서는 통과
  const ip = getClientIp(req)
  const key = extraKey ? `${ip}:${extraKey}` : ip
  const { success, reset } = await limiter.limit(key)
  if (success) return null
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
