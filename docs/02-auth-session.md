# 02. 인증 / 세션 / 미들웨어

## 로그인 플로우

```
[User] ─POST /api/auth/login──▶ profiles 테이블 조회
                                 │
                                 │ bcrypt.compare(pin, pin_hash)
                                 ▼
                        Set-Cookie: wta-session=base64(JSON)
                                 │
                                 ▼
                   redirect /{role} (owner/admin/coach/member/payment)
```

## 세션 쿠키

- 쿠키명: **`wta-session`**
- 값: `base64(JSON({ id, name, role, is_owner }))`
- 속성: `httpOnly`, `secure`, `sameSite=lax`, `maxAge=7d`
- 디코딩: [src/lib/session.ts](../src/lib/session.ts) `getSession()`

### SessionUser 타입
[src/lib/types.ts](../src/lib/types.ts)
```ts
type SessionUser = {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'coach' | 'member' | 'payment';
  is_owner?: boolean;
};
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| [middleware.ts](../middleware.ts) | 역할별 경로 가드 |
| [src/lib/session.ts](../src/lib/session.ts) | 서버/서버컴포넌트에서 세션 조회 |
| [src/lib/supabase-admin.ts](../src/lib/supabase-admin.ts) | service_role 클라이언트 |
| [src/lib/supabase-browser.ts](../src/lib/supabase-browser.ts) | anon 클라이언트 |
| [src/lib/supabase-server.ts](../src/lib/supabase-server.ts) | SSR 쿠키 연동 클라이언트 |
| [src/app/api/auth/login/route.ts](../src/app/api/auth/login/route.ts) | 로그인 (PIN 검증) |
| [src/app/api/auth/logout/route.ts](../src/app/api/auth/logout/route.ts) | 세션 쿠키 제거 |
| [src/app/api/auth/change-pin/route.ts](../src/app/api/auth/change-pin/route.ts) | PIN 변경 |
| [src/app/api/session/route.ts](../src/app/api/session/route.ts) | 현재 로그인 사용자 정보 반환 |
| [src/app/setup/page.tsx](../src/app/setup/page.tsx) | 최초 오너 계정 생성 |
| [src/app/api/setup/route.ts](../src/app/api/setup/route.ts) | setup 처리 |

## 로그인 페이지 (역할별)

| 경로 | 로그인 대상 |
|------|------|
| `/auth/owner` | 오너 |
| `/auth/admin` | 관리자 |
| `/auth/coach` | 코치 |
| `/auth/payment` | 수납 담당 |
| `/auth/member` | 회원 |

모든 로그인 페이지는 `components/LoginForm.tsx`를 공용으로 사용하고 `role` prop만 달리 전달.

## 미들웨어 권한 매트릭스

[middleware.ts](../middleware.ts)

| 경로 prefix | 허용 역할 |
|-------------|-----------|
| `/owner/*` | owner |
| `/admin/*` | owner, admin |
| `/coach/*` | owner, coach |
| `/payment/*` | owner, payment |
| `/member/*` | member |

> **owner**는 admin/coach/payment 영역까지 진입 가능한 슈퍼유저.

## PIN 강제 변경 플로우

1. 관리자가 회원/코치의 PIN을 리셋 → `profiles.pin_must_change = true`
2. 다음 로그인 시 미들웨어/페이지가 이 플래그를 감지 → `/{role}/pin-change`로 강제 이동
3. `/api/auth/change-pin` PATCH → 새 PIN 해시 저장 + 플래그 해제

## Rate Limit

- `@upstash/ratelimit` + `@upstash/redis` → 로그인 엔드포인트 보호
- 환경변수: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## 환경변수 체크리스트

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CRON_SECRET
TOSS_CLIENT_KEY / TOSS_SECRET_KEY
```
