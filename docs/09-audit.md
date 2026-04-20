# 09. 구조 감사 (Audit)

실제 코드를 검증해 추린 구조적 문제 · 일관성 이슈. 심각도 표기:
🔴 **버그/보안** · 🟡 **일관성/리스크** · 🟢 **정리 권장**

> **적용 현황 (2026-04-19)**: 🔴 3건 및 일부 🟡/🟢 항목 반영 완료. 각 항목 하단 **✅ 적용** 블록 참고.

---

## 🔴 1. Rate Limit 미적용 (로그인·PIN 변경·공개신청)

- `package.json`에 `@upstash/ratelimit`, `@upstash/redis`가 의존성으로 포함되어 있지만, **`src/` 어디에서도 import하지 않음** (grep 결과 0건).
- 영향 경로:
  - [src/app/api/auth/login/route.ts](../src/app/api/auth/login/route.ts) — 6자리 PIN 브루트포스 가능
  - [src/app/api/auth/change-pin/route.ts](../src/app/api/auth/change-pin/route.ts)
  - [src/app/api/apply/route.ts](../src/app/api/apply/route.ts) — 공개 신청 스팸 가능
- **수정**: Upstash Ratelimit 래퍼(`src/lib/ratelimit.ts`)를 만들어 3개 엔드포인트 맨 앞에 적용.

> ✅ **적용** — [src/lib/ratelimit.ts](../src/lib/ratelimit.ts) 신규. `checkRate(RL.login|pinChange|apply, req)` 을 login / change-pin / apply 라우트 맨 앞에 호출. Upstash 환경변수가 없으면 자동 패스.

## 🔴 2. `supabase-admin.ts`에 `'server-only'` 가드 없음

- [src/lib/supabase-admin.ts:3](../src/lib/supabase-admin.ts) — 주석만 있고 빌드타임 보호 장치 없음.
- 실수로 `'use client'` 파일에서 import하면 service_role key가 클라이언트 번들에 포함됨.
- **수정**: 파일 최상단에 `import 'server-only'` 추가.

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
```

> ✅ **적용** — [src/lib/supabase-admin.ts:1](../src/lib/supabase-admin.ts)에 `import 'server-only'` 추가. 이후 클라이언트 파일에서 이 모듈을 import하면 빌드가 실패.

## 🔴 3. `temp_pin`이 HTTP 응답 body로 노출

- 회원/코치 계정 생성·PIN 리셋 시 생성된 6자리 임시 PIN을 그대로 JSON 응답에 담아 반환.
- 해당 코드: [api/members/route.ts:52](../src/app/api/members/route.ts), [api/members/[id]/route.ts:67](../src/app/api/members/[id]/route.ts), [api/coaches/route.ts:51](../src/app/api/coaches/route.ts), [api/coaches/[id]/route.ts:20](../src/app/api/coaches/[id]/route.ts), [api/staff/route.ts:46](../src/app/api/staff/route.ts), [api/staff/[id]/route.ts:20](../src/app/api/staff/[id]/route.ts), [api/applications/[id]/route.ts:99](../src/app/api/applications/[id]/route.ts)
- 의도(관리자가 화면에서 확인 후 구두로 전달)는 이해되지만, **브라우저 네트워크 탭·서버 액세스 로그·프록시 로그에 평문으로 남음**.
- **수정 옵션**
  - (최소) 응답 헤더에 `Cache-Control: no-store` 명시
  - (권장) 생성 직후 별도 `/api/admin/temp-pin/[id]` 엔드포인트로 1회만 조회 가능 + 자동 만료
  - (이상) SMS/카톡으로 out-of-band 전달

> ✅ **적용(최소)** — 7개 응답에 `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` + `Pragma: no-cache` 헤더 추가. 브라우저·프록시 캐싱 방지. OOB 전달(권장안)은 SMS/카톡 연동 전까지 보류.

---

## 🟡 4. 응답 shape 제각각

같은 앱 안에서 3가지 포맷이 섞여 있음:

| 패턴 | 예시 |
|------|------|
| `{ ok: true, ... }` | `/api/auth/login`, `/api/coach-blocks` |
| 데이터 스프레드 + 부가필드 | `{ ...data, temp_pin }` — `/api/members`, `/api/coaches` |
| 배열 직접 반환 | `/api/coach-blocks` GET → `[]` |
| 객체 직접 반환 | 여러 GET 라우트 |

- **영향**: 프론트에서 `data.ok`, `data.data`, `data`를 혼용해야 함 → 에러 처리 일관성 저해.
- **수정**: 공용 헬퍼 `src/lib/respond.ts`에 `ok(data)` / `fail(msg, status)` 두 가지로 통일.

> ✅ **헬퍼 생성** — [src/lib/respond.ts](../src/lib/respond.ts). 기존 라우트 마이그레이션은 클라이언트 호출 규약 변경이 필요하므로 **점진 적용**(새 라우트부터).

## 🟡 5. Role 가드 체크 중복 (DRY 위반)

- API 라우트 52개 중 대부분이 `['owner','admin'].includes(session.role)` 식의 인라인 체크.
- 역할 집합에 오타가 생기면 권한 경계가 실리하게 깨지지만 타입으로는 안 잡힘.
- **수정**: `src/lib/authz.ts`에 헬퍼 추가.

```ts
// src/lib/authz.ts
import { getSession } from './session'
import { Role } from './types'

export async function requireRole(...allowed: Role[]) {
  const s = await getSession()
  if (!s || !allowed.includes(s.role)) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return s
}
```

> ✅ **헬퍼 생성** — [src/lib/authz.ts](../src/lib/authz.ts). `requireRole(...roles)` / `requireSession()` 제공. 기존 52개 라우트 마이그레이션은 **점진 적용** 권장.

## 🟡 6. 중복/중첩된 페이지 3종 (관리자 vs 오너)

다음 세 페이지가 유사한 데이터를 다룸:

| 경로 | 용도 (추정) |
|------|------|
| [admin/applications](../src/app/admin/applications) | ? |
| [owner/applications](../src/app/owner/applications) | ? |
| [owner/lesson-applications](../src/app/owner/lesson-applications) | 레슨 신청 2차 승인 |

- 비슷한 이름이라 **어느 화면이 authoritative한지 불명확**. 오너가 양쪽을 쓸 수 있어 데이터 싱크 이슈 유발.
- 비슷하게 `admin/lesson-plan` vs `owner/lesson-plan` 중복.
- **수정**: 용도 구분을 이름에 반영(예: `member-join-applications` vs `lesson-requests`)하고 한쪽을 제거.

## 🟡 7. `/api/applications` 쿼리 파라미터 불일치

- 같은 엔드포인트를 두 페이지가 다른 파라미터로 호출:
  - `/admin/applications` → `?status=X`
  - `/owner/applications` → `?type=member_join&status=X`
- 서버는 둘 다 처리하지만, 프론트 호출 규칙이 달라 문서화되지 않으면 회귀 버그 위험.
- **수정**: 클라이언트 공용 훅(`useApplications`)으로 호출 규약 고정.

## 🟡 8. 미들웨어는 `/api/*`를 보호하지 않음

- [middleware.ts:39](../middleware.ts) — `pathname.startsWith('/api')`면 `NextResponse.next()`.
- 즉 모든 API는 스스로 `getSession()`을 호출해야 함. 현재 `getSession()`을 사용하는 라우트는 52개.
- 나머지는 public(auth, apply, setup, cron) 혹은 setup/webhook이지만, **신규 라우트 추가 시 빼먹기 쉬운 구조**.
- **수정**: `src/lib/authz.ts` 도입 + ESLint 룰로 "API route는 `requireRole`/`requireSession` 중 하나를 반드시 호출" 강제.

## 🟡 9. 돌연변이 후 `revalidatePath` 미호출

- Next.js App Router의 Server Component는 기본 캐시됨. PATCH/POST 후 `revalidatePath()`를 부르지 않으면 관리자 페이지 등에서 **새로고침 전까지 stale 데이터 표시**.
- 예: 레슨 승인 → `/owner/lesson-applications`, `/member/schedule` 등 재검증 필요.
- **수정**: 각 PATCH/POST 말미에 관련 path 리스트를 `revalidatePath`.

> ⚠️ **검증 결과 — 적용 보류**: 실제 점검해보니 거의 모든 데이터 페이지가 `'use client'` + `useEffect` fetch 패턴. SSR 캐싱 대상이 아니라 `revalidatePath`가 no-op. 향후 Server Component 로 이관하는 페이지가 생기면 그때 적용.

## 🟡 10. 푸시 알림 발송 정책 불명확

- 일부 돌연변이 API는 `sendPushToUser` + `notifications` insert를 둘 다 수행, 일부는 한쪽만.
- `/api/coach-blocks` POST → DB/Push 모두 없음
- `/api/family/*` POST → 알림 없음
- **영향**: 어떤 액션이 알림을 유발하는지 사용자/개발자 예측 어려움.
- **수정**: 공용 헬퍼 `notify(userId, {title, body, link})`를 만들고 "알림 유발 이벤트" 목록을 [06-push-notifications.md](06-push-notifications.md)에 추가.

> ✅ **헬퍼 생성** — [src/lib/notify.ts](../src/lib/notify.ts). `notify(userId, {title, body, link, pushOnly?, dbOnly?})`로 DB+Push 동시 발송.

## 🟡 11. 알림 link 경로 하드코딩

- `/api/lesson-applications/route.ts:207` 등에서 `'/coach/applications'` 같은 문자열 직접 삽입.
- 라우트 변경 시 알림 링크가 404로 깨짐.
- **수정**: `src/lib/routes.ts`에 경로 상수 모아두고 참조.

> ✅ **헬퍼 생성** — [src/lib/routes.ts](../src/lib/routes.ts). `ROUTES.coach.applications` 형태로 참조. 기존 하드코딩 문자열은 점진 치환.

---

## 🟢 12. BOM(UTF-8 Byte Order Mark) 섞여 있음

- 여러 `page.tsx` 파일 첫 줄 앞에 `﻿` 보임: `admin/page.tsx`, `owner/page.tsx`, `coach/page.tsx` 등.
- Windows에서 저장한 흔적. 런타임 문제는 거의 없지만 diff 노이즈·일부 도구에서 파싱 에러.
- **수정**: VSCode에서 "Save with Encoding: UTF-8 (no BOM)"으로 일괄 재저장.

> ✅ **적용** — `src/` 하위 `.ts`/`.tsx` 34개 파일 BOM 제거 완료.

## 🟢 13. 파일 크기 비대

- `wta-snapshot/`, `wta_part*.txt`, `wta_push_output.txt` — 스냅샷/로그가 repo에 커밋된 상태.
- `.gitignore`에 추가하거나 `archive/` 폴더로 이동 권장.

> ✅ **적용** — [.gitignore](../.gitignore)에 `/wta-snapshot/`, `wta_part*.txt`, `wta_push_output.txt`, `export-wta-snapshot.ps1` 추가. (기존에 커밋된 파일은 `git rm --cached`로 별도 정리 필요.)

## 🟢 14. PIN 관련 dev 로그

- [api/auth/login/route.ts:21](../src/app/api/auth/login/route.ts) — 개발 모드에서 `pinLen` 로깅.
- PIN 자체는 아니지만 메타데이터 최소화 원칙상 제거 권장.

> ✅ **적용** — login route에서 `pinLen` 로그 및 디버그 문구 제거.

## 🟢 15. Bottom Nav 비대칭

- `MemberBottomNav`, `CoachBottomNav`만 존재. Admin/Owner는 하단탭 없음 → PC 전용 UX 가정으로 보이나 문서화되어 있지 않음.
- **수정**: 의도면 [03-roles-routing.md](03-roles-routing.md)에 "admin/owner는 데스크톱 중심" 명시.

---

## 우선순위 제안 / 적용 현황

| 순위 | 작업 | 상태 |
|------|------|------|
| 1 | `'server-only'` 가드 추가 (#2) | ✅ 완료 |
| 2 | Rate limit 적용 (#1) | ✅ 완료 (login · change-pin · apply) |
| 3 | `requireRole` 헬퍼 도입 (#5, #8) | ✅ 헬퍼 생성, 라우트 마이그레이션은 점진 적용 |
| 4 | `temp_pin` 노출 완화 (#3) | ✅ no-store 헤더 적용 (OOB 전달은 보류) |
| 5 | 응답 shape 통일 (#4) | ✅ 헬퍼 생성, 기존 라우트 마이그레이션은 점진 적용 |
| 6 | 중복 페이지 정리 (#6, #7) | ⏳ 담당자 확정 후 진행 |
| 7 | `revalidatePath` 도입 (#9) | ⏭ N/A (전 페이지 'use client' → 무효) |
| 8 | 알림 헬퍼 (#10) · 경로 상수 (#11) | ✅ 헬퍼 생성, 기존 라우트 마이그레이션은 점진 적용 |
| 9 | BOM/스냅샷 정리 (#12, #13) | ✅ 완료 (34 파일 BOM 제거, .gitignore 업데이트) |
| 10 | PIN dev 로그 제거 (#14) | ✅ 완료 |
| 11 | Bottom Nav 비대칭 문서화 (#15) | ⏳ 의도 확인 후 진행 |

### 신규 생성 파일
- [src/lib/ratelimit.ts](../src/lib/ratelimit.ts) — Upstash 래퍼 + `RL.login/pinChange/apply`
- [src/lib/authz.ts](../src/lib/authz.ts) — `requireRole(...roles)` / `requireSession()`
- [src/lib/respond.ts](../src/lib/respond.ts) — `ok(data, {sensitive})` / `fail(msg, status)`
- [src/lib/routes.ts](../src/lib/routes.ts) — 페이지 경로 상수 `ROUTES.*`
- [src/lib/notify.ts](../src/lib/notify.ts) — `notify(userId, {title, body, link})`

### 다음 단계 (점진 마이그레이션)
1. 신규 API 라우트부터 `requireRole` · `ok/fail` · `notify` 사용 표준화
2. 기존 라우트는 수정이 생길 때마다 헬퍼로 전환
3. `/admin/applications` vs `/owner/applications` vs `/owner/lesson-applications` — 담당자와 UX 정리 후 한쪽 제거
4. `temp_pin` OOB 전달(SMS/카톡) 연동 시 API 응답에서 완전히 제거

---

## 주의: 실제로 문제 없는 항목 (감사 과정에서 걸러짐)

- **Server Component에서 `supabaseAdmin` 사용 (`src/app/*/page.tsx`)** — `'use client'` 없는 서버 전용 파일이라 Next.js 표준 패턴. 다만 이를 유지하려면 #2의 `'server-only'` 가드가 전제.
- **Status string 일관성** — `pending_coach` / `pending_admin` / `approved` 표기가 전 코드베이스에서 균일함.
- **middleware의 owner 슈퍼유저 구조** — 의도적으로 설계된 것이며 버그 아님.
