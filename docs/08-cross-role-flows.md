# 08. 역할 간 E2E 플로우

역할 경계를 넘나드는 핵심 플로우 4가지.

## 플로우 1. 레슨 신청 → 승인

```
Member                   Coach                   Admin/Owner
  │                        │                         │
  │ 1. /member/apply       │                         │
  │    POST /api/lesson-applications                 │
  │                        │                         │
  │── pending_coach ──────▶│                         │
  │                        │ 2. /coach/applications  │
  │                        │    PATCH ...(coach_approve)
  │                        │── pending_admin ───────▶│
  │                        │                         │ 3. /owner/lesson-applications
  │                        │                         │    PATCH ...(admin_approve)
  │                        │                         │    ↓
  │                        │                         │    RPC approve_lesson_application
  │                        │                         │    → lesson_plans + lesson_slots
  │◀── push: ✅ 승인 ───────────────────────────────│
  │                                                  │
  ▼                                                  ▼
/member/schedule에 반영                         /owner/schedule-draft에 draft로 등장
```

**관련 파일**
- [src/app/api/lesson-applications/route.ts](../src/app/api/lesson-applications/route.ts)
- [src/app/api/lesson-applications/[id]/route.ts](../src/app/api/lesson-applications/[id]/route.ts)
- [src/lib/checkCoachBlock.ts](../src/lib/checkCoachBlock.ts) — 휴무 검증
- RPC `approve_lesson_application` (DB 측)

**상태 전이**
`pending_coach → pending_admin → approved` (또는 `rejected_by_coach` / `rejected_by_admin`)

## 플로우 2. 결제 (Toss)

```
Member                               Server                     Toss
  │                                    │                          │
  │ /member/payment                    │                          │
  │  GET /api/my-payment ─────────────▶│                          │
  │◀── unpaid plan 리스트 ──────────────                           │
  │                                                               │
  │ [결제 버튼]                                                    │
  │  POST /api/payment/toss/order ───▶│                           │
  │                                    │── payments insert        │
  │◀── orderId + amount ───────────────│                          │
  │                                                               │
  │  Toss Widget 호출 ──────────────────────────────────────────▶ │
  │◀── successUrl redirect ─────────────────────────────────────── │
  │                                                               │
  │ /pay/success                                                  │
  │  POST /api/payment/toss/confirm ─▶│                          │
  │                                    │─ Toss confirm API ─────▶ │
  │                                    │◀─ done ───────────────── │
  │                                    │─ payments.status='done'  │
  │                                    │─ lesson_plans.payment_status='paid'
  │◀── 성공 ────────────────────────────                          │
```

**관련 파일**
- [src/app/api/payment/toss/order/route.ts](../src/app/api/payment/toss/order/route.ts)
- [src/app/api/payment/toss/confirm/route.ts](../src/app/api/payment/toss/confirm/route.ts)
- [src/app/pay](../src/app/pay) (success / fail / [planId])
- [src/lib/calcAmount.ts](../src/lib/calcAmount.ts) — 금액 계산
- [src/app/api/receipts/route.ts](../src/app/api/receipts/route.ts) — 영수증 발행

## 플로우 3. 스케줄 드래프트 → 공개

```
Admin                          Owner                     Member
  │                              │                         │
  │ /admin/lesson-plan           │                         │
  │  신청 승인 → draft slot 생성  │                         │
  │                              │                         │
  │                              │ /owner/schedule-draft   │
  │                              │  전체 리스트 확인         │
  │                              │  confirm_one / confirm_all
  │                              │  POST /api/schedule-draft
  │                              │   (status: draft→scheduled)
  │                              │                         │
  │                              │── push/notifications ──▶│
  │                                                        │
  │                                                        ▼
  │                                        /member/schedule 에 최종 반영
```

**관련 파일**
- [src/app/api/schedule-draft/route.ts](../src/app/api/schedule-draft/route.ts)
- [src/app/owner/schedule-draft/page.tsx](../src/app/owner/schedule-draft/page.tsx)

**충돌 처리**: confirm_all은 충돌이 없는 슬롯만 일괄 confirm. 충돌 슬롯은 개별 confirm 필요.

## 플로우 4. 코치 휴무 등록 → 신청 차단

```
Coach                      Owner/Admin               Member
  │                           │                         │
  │ /coach/blocks             │                         │
  │  POST /api/coach-blocks   │                         │
  │   (single / repeat_weekly)│                         │
  │                           │                         │
  │                           │ /owner/coaches         │
  │                           │  휴무 조회 / 삭제       │
  │                                                     │
  │                                                     │ /member/apply
  │                                                     │ POST /api/lesson-applications
  │                                                     │   │
  │                                                     │   ▼
  │                                                     │ checkCoachBlock()
  │                                                     │   → 휴무 매칭 시 거절
  │                                                     │
  │                                                     ◀── 에러: "코치 휴무"
```

**관련 파일**
- [src/app/api/coach-blocks/route.ts](../src/app/api/coach-blocks/route.ts)
- [src/lib/checkCoachBlock.ts](../src/lib/checkCoachBlock.ts)

**검증 규칙**
- `single`: 특정 날짜 매칭
- `repeat_weekly`: `day_of_week` + 시간 범위 매칭
- 시간 범위가 겹치면 차단

## 플로우 5 (보너스). 공개 회원가입 → 활성화

```
비회원                       Admin/Owner
  │                             │
  │ /apply                      │
  │  POST /api/apply           │
  │   → member_applications     │
  │     (pending)               │
  │                             │
  │                             │ /owner/unregistered
  │                             │  승인 → profiles 생성
  │                             │
  │◀── 알림 (SMS/푸시) ─────────│
```

**관련 파일**
- [src/app/api/apply/route.ts](../src/app/api/apply/route.ts)
- [src/app/api/unregistered/route.ts](../src/app/api/unregistered/route.ts)

## 데이터 수명주기 한눈에 보기

```
member_applications ──(승인)──▶ profiles
                                    │
                                    │ /member/apply
                                    ▼
                          lesson_applications
                                    │ coach 1차 → admin 2차
                                    ▼
                    lesson_plans + lesson_slots(draft)
                                    │
                                    │ schedule-draft confirm
                                    ▼
                          lesson_slots(scheduled)
                                    │
                      ┌─────────────┼──────────────┐
                      ▼             ▼              ▼
                  결제(Toss)    완료(cron)      결석/취소
                      │             │              │
                      ▼             ▼              ▼
                 payments     completed        absent/cancelled
                              + completed_count++   │
                                                    │
                                                    ▼
                                            makeup_bookings
```
