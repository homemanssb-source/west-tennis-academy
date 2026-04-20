# 05. Supabase 테이블 / RPC

코드에서 참조하는 테이블 목록 (`.from('...')` 기준).

## 테이블

| 테이블 | 역할 | 주 참조 API |
|--------|------|------------|
| `profiles` | 사용자 (owner/admin/coach/member/payment 공통) | `/api/auth/*`, `/api/members`, `/api/coaches`, `/api/staff` |
| `lesson_plans` | 월별 레슨 플랜 (회원 × 코치 × 월) | `/api/lesson-plans/*`, `/api/payment`, `/api/my-payment` |
| `lesson_slots` | 개별 레슨 슬롯 (draft / scheduled / completed / absent / makeup) | `/api/lesson-slots/*`, `/api/schedule-draft`, `/api/weekly-schedule` |
| `lesson_applications` | 신청 (pending_coach → pending_admin → approved/rejected) | `/api/lesson-applications/*` |
| `lesson_programs` | 레슨 프로그램 템플릿 (그룹/1:1, 정원) | `/api/programs`, `/api/lesson-applications` |
| `months` | 빌링 월 (연/월 메타) | `/api/months` |
| `coach_blocks` | 코치 휴무 (단일일 / 매주 반복) | `/api/coach-blocks`, `lib/checkCoachBlock.ts` |
| `family_members` | 회원의 자녀 계정 | `/api/family/*` |
| `member_applications` | 공개 회원가입 신청 | `/api/apply`, `/api/unregistered` |
| `notifications` | 인앱 알림 피드 | `/api/notifications/*` |
| `push_subscriptions` | Web Push 구독 endpoint + keys | `/api/push/*`, `lib/push.ts` |
| `payments` | Toss 결제 기록 | `/api/payment/toss/*` |
| `makeup_bookings` | 보충 수업 예약 | `/api/makeup/*` |
| `wta_config` | 전역 설정 (단가, 할인 등) | `/api/config`, `lib/calcAmount.ts` |
| `coach_stats` | 코치 통계 (파생/집계) | `/api/coach-stats` |

## 상태(Enum) 참고

### `lesson_applications.status`
```
pending_coach → pending_admin → approved
              ↘              ↘
                rejected_by_coach | rejected_by_admin
```

### `lesson_slots.status`
```
draft → scheduled → completed
                 ↘ absent
                 ↘ makeup
                 ↘ cancelled
```

### `lesson_plans.payment_status`
```
unpaid → paid
       ↘ waived
```

## RPC 함수

| 함수 | 호출 위치 | 용도 |
|------|-----------|------|
| `approve_lesson_application` | `/api/lesson-applications/[id]` PATCH (admin_approve) | 트랜잭션: 승인 + `lesson_plans` + 초기 `lesson_slots` 생성 |
| `increment_completed_by` | `/api/cron/auto-complete` | 완료 시 `lesson_plans.completed_count` 증가 |

## 클라이언트 종류

| 파일 | Key | 사용처 |
|------|-----|-------|
| [src/lib/supabase-admin.ts](../src/lib/supabase-admin.ts) | `SERVICE_ROLE` | API 라우트 · cron (RLS 우회) |
| [src/lib/supabase-server.ts](../src/lib/supabase-server.ts) | anon | Server Component / SSR (쿠키 연동) |
| [src/lib/supabase-browser.ts](../src/lib/supabase-browser.ts) | anon | Client Component |

## 테이블 간 관계 (요약)

```
profiles (1) ──< lesson_applications >── (1) profiles
           coach                     member
                   │
                   │ approve
                   ▼
             lesson_plans ──< lesson_slots
                   │
                   │ 결제
                   ▼
                payments

profiles (coach) ──< coach_blocks
profiles (member) ──< family_members
member_applications ──→ profiles (승인 시 생성)
profiles ──< push_subscriptions
profiles ──< notifications
```
