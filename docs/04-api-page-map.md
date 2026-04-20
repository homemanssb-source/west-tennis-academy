# 04. API ↔ 페이지 연결 맵

도메인별로 묶은 API 라우트와 호출 페이지 매핑.

## 인증 / 세션

| API | 메서드 | 호출 페이지/컴포넌트 |
|-----|--------|---------------------|
| `/api/auth/login` | POST | `components/LoginForm.tsx` (전 역할 로그인 페이지) |
| `/api/auth/logout` | POST | `components/LogoutButton.tsx` |
| `/api/auth/change-pin` | PATCH | `{role}/pin-change/page.tsx` (전 역할) |
| `/api/session` | GET | `coach/schedule/page.tsx` 등 현재 사용자 확인 |
| `/api/setup` | POST | `setup/page.tsx` |

## 레슨 신청 (lesson_applications)

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/lesson-applications` | GET | `member/apply`, `coach/applications`, `owner/lesson-applications` |
| `/api/lesson-applications` | POST | `member/apply` (회원 신청) |
| `/api/lesson-applications/[id]` | PATCH | `member/apply` (취소), `coach/applications` (1차 승인/거절), `owner/lesson-applications` · `admin/applications` (2차 승인/거절) |

> POST 시 `checkCoachBlock()`으로 휴무 충돌 검증 → 코치에게 push.

## 레슨 플랜 / 슬롯

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/lesson-plans` | GET/POST | `admin/lesson-plan`, `owner/lesson-plan`, `owner/planlist` |
| `/api/lesson-plans/[id]` | PATCH | `owner/lesson-plan/[id]` |
| `/api/lesson-plans/copy` | POST | `owner/lesson-copy` |
| `/api/lesson-plans/extra` | POST | 추가 레슨 생성 |
| `/api/lesson-plans/list` | GET | 내부 리스트 |
| `/api/lesson-slots` | GET/POST | `owner/lesson-plan/[id]`, `owner/planlist/[id]` |
| `/api/lesson-slots/[id]` | PATCH | `owner/lesson-plan/[id]` (완료/메모) |
| `/api/lesson-slots/cancel` | POST | `coach/schedule` (취소 + 회원 알림) |

## 스케줄 드래프트 / 주간

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/schedule-draft` | GET/POST | `owner/schedule-draft` (confirm_all / confirm_one / delete) |
| `/api/weekly-schedule` | GET | `admin/weekly`, `owner/weekly` |
| `/api/member-draft` | GET/POST | `member/schedule` (회원용 사전 드래프트) |

## 결제

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/payment` | GET | `owner/payment`, `admin/payment`, `payment/list`, `payment/receipts` |
| `/api/my-payment` | GET | `member/payment` |
| `/api/payment/toss/order` | POST | `member/payment`, `pay/[planId]` |
| `/api/payment/toss/confirm` | POST | `pay/success` |
| `/api/receipts` | POST | `payment/receipts` |
| `/api/coach/payment` | GET/PATCH | `coach/payment` (코치 정산) |

## 코치 / 휴무

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/coaches` | GET/POST | `admin/coaches`, `owner/coaches`, `member/apply` |
| `/api/coaches/[id]` | PATCH | `admin/coaches`, `owner/coaches` (PIN 리셋, 활성화 토글) |
| `/api/coach-blocks` | GET/POST/DELETE | `coach/blocks`, `owner/coaches` |
| `/api/coach-stats` | GET | `owner/coach-stats` |

## 회원 / 가족

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/members` | GET/POST | `admin/members`, `owner/members` |
| `/api/members/[id]` | PATCH | `admin/members`, `owner/members` |
| `/api/member-requests` | GET/PATCH | 회원 요청 처리 |
| `/api/family` | GET/POST | `member/family` |
| `/api/family/[id]` | PATCH | `member/family` |
| `/api/apply` | POST | `apply/page.tsx` (공개 신청) |
| `/api/unregistered` | GET | `owner/unregistered` |

## 프로그램 / 설정

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/programs` | GET/POST | `owner/programs`, `member/apply` |
| `/api/months` | GET/POST | 다수 페이지 (빌링 월 선택) |
| `/api/config` | GET/PATCH | `admin/lesson-plan`, `owner/programs`, `owner/settings` |
| `/api/staff` | GET/POST | `owner/settings` |

## 보충 수업

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/makeup` | GET/POST | `coach/schedule`, `owner/schedule` |
| `/api/makeup/pending` | GET | `owner/schedule` |

## 알림 / 푸시

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/notifications` | GET/PATCH | `components/notifications/NotificationBell.tsx` |
| `/api/notifications/[id]` | PATCH | 읽음 처리 |
| `/api/notifications/send` | POST | `owner/notifications`, `owner/unregistered` |
| `/api/push/subscribe` | POST/DELETE | `lib/usePush.ts` |
| `/api/push/send` | POST | 내부 호출 |

## 리포트 / 통계

| API | 메서드 | 호출 페이지 |
|-----|--------|-----------|
| `/api/dashboard` | GET | `owner/dashboard` |
| `/api/stats/monthly` | GET | `owner/stats` |
| `/api/revenue` | GET | `owner/revenue` |
| `/api/reports` | GET | `owner/reports` |

## 크론

| API | 스케줄/트리거 |
|-----|---------------|
| `/api/cron/auto-complete` | Vercel cron (매일 15:00) |
| `/api/cron/unpaid-notify` | 수동 |
| `/api/cron/lesson-remind` | 수동 |
| `/api/cron/lesson-fee-notify` | 수동 |
| `/api/cron/sync-next-month` | 수동 |

> 상세는 [07-cron-jobs.md](07-cron-jobs.md) 참조.
