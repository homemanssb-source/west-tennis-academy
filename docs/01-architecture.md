# 01. 전체 아키텍처

## 디렉토리 레이아웃

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # 약 65개 API 라우트 (서버 전용)
│   ├── auth/                 # 로그인 페이지 (역할별)
│   ├── admin/                # 관리자 화면
│   ├── owner/                # 오너 화면 (최상위 권한)
│   ├── coach/                # 코치 화면
│   ├── member/               # 회원 화면
│   ├── payment/              # 결제 수납 담당자 화면
│   ├── pay/                  # Toss 결제 redirect 페이지
│   ├── apply/                # 공개 회원가입 신청
│   ├── setup/                # 초기 Admin 계정 생성
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── LoginForm.tsx
│   ├── LogoutButton.tsx
│   ├── MemberBottomNav.tsx
│   ├── CoachBottomNav.tsx
│   └── notifications/        # 알림 벨 컴포넌트
└── lib/
    ├── session.ts            # 세션 쿠키 디코딩
    ├── supabase-admin.ts     # service_role 클라이언트 (서버)
    ├── supabase-browser.ts   # anon 클라이언트 (브라우저)
    ├── supabase-server.ts    # SSR 클라이언트
    ├── push.ts               # web-push 서버 헬퍼
    ├── usePush.ts            # 브라우저 push 훅
    ├── calcAmount.ts         # 결제 금액 계산
    ├── checkCoachBlock.ts    # 코치 휴무 검증
    └── types.ts              # SessionUser 등 공용 타입
middleware.ts                 # 역할 기반 라우트 가드
vercel.json                   # cron 스케줄
```

## 계층 구조

```
┌────────────────────────────────────────────────┐
│  Browser (React Client Components)             │
│   ├── /auth/{role} 로그인                      │
│   ├── /{role}/... 역할별 페이지                │
│   └── usePush / NotificationBell               │
└──────────────┬─────────────────────────────────┘
               │ fetch('/api/...')
┌──────────────▼─────────────────────────────────┐
│  middleware.ts (역할 가드)                      │
│   └── wta-session 쿠키 검증 → role 매칭         │
└──────────────┬─────────────────────────────────┘
┌──────────────▼─────────────────────────────────┐
│  Next.js Server / API Routes                   │
│   ├── session.ts → getSession()                │
│   ├── supabase-admin.ts (service_role)         │
│   ├── push.ts → sendPushToUser()               │
│   └── Upstash ratelimit (로그인 등)            │
└──────────────┬─────────────────────────────────┘
┌──────────────▼─────────────────────────────────┐
│  Supabase Postgres                             │
│   └── profiles / lesson_plans / lesson_slots   │
│        / lesson_applications / coach_blocks    │
│        / months / payments / notifications ...  │
└────────────────────────────────────────────────┘
```

## 공용 라이브러리 역할

| 파일 | 용도 |
|------|------|
| `src/lib/session.ts` | `wta-session` 쿠키 → `SessionUser` 복원 |
| `src/lib/supabase-admin.ts` | 서버에서 RLS 우회용 (service_role) |
| `src/lib/supabase-browser.ts` | 클라이언트에서 anon key 사용 |
| `src/lib/supabase-server.ts` | SSR 쿠키 연동 |
| `src/lib/push.ts` | `sendPushToUser()` → `web-push` 호출 |
| `src/lib/usePush.ts` | 브라우저 PushManager 구독/해제 |
| `src/lib/checkCoachBlock.ts` | 신청 시 코치 휴무 여부 검증 (단일일/매주 반복) |
| `src/lib/calcAmount.ts` | 결제 금액 계산 (단가·할인) |
| `src/lib/types.ts` | `SessionUser`, 상태 enum 등 공용 타입 |

## 외부 서비스 연동

| 서비스 | 위치 | 목적 |
|--------|------|------|
| Supabase | 전역 | DB / RPC |
| Toss Payments | `/api/payment/toss/*`, `/pay/*` | 결제 위젯·확정 |
| Web Push (VAPID) | `/api/push/*`, `public/sw.js` | 알림 푸시 |
| Upstash Redis | `@upstash/ratelimit` | 로그인 rate limit |
| Vercel Cron | `vercel.json` | 자동 완료 처리 |

## 통계 수치

- API 라우트: 약 65개
- Supabase 테이블: 약 14개
- Cron 잡: 5개 (1개 자동, 4개 수동 트리거)
- 역할: 5개 (owner / admin / coach / payment / member)
