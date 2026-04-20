# 10. 시나리오 시뮬레이션 결과

정적 시뮬레이션(DB 없이 코드 경로 추적)으로 14개 시나리오를 돌리며 발견한 버그·엣지케이스·경계 조건을 정리.
직접 코드와 교차검증한 항목만 수록.

범례: 🔴 **버그** · 🟡 **엣지/설계 이슈** · 🟢 **관찰**

---

## 요약: 우선순위 상위 Top

| # | 위치 | 한줄 요약 | 심각도 |
|---|------|----------|--------|
| B1 | [lesson-applications/route.ts:117-128](../src/app/api/lesson-applications/route.ts) | ~~회원이 서로 다른 코치로 같은 시간대 중복 신청 가능~~ — **의도된 동작(가족계정 등)으로 수용** | ⏭ |
| B2 | [lesson-applications/route.ts:130-165](../src/app/api/lesson-applications/route.ts) | ~~그룹레슨 정원 체크의 false-positive(안 찼는데 찼다고) / false-negative~~ — **수정 완료** | ✅ |
| B3 | [lesson-applications/[id]/route.ts:22-42](../src/app/api/lesson-applications/[id]/route.ts) | ~~`admin_approve` 멱등성 없음~~ — **수정 완료** (상태 전이 검증 + `lesson_plan_id` 가드) | ✅ |
| B4 | [coach-blocks/route.ts:39-55](../src/app/api/coach-blocks/route.ts) | 휴무 등록 시 **이미 예정된 lesson_slots**에 대한 소급 검증/처리 없음 | 🔴 |
| B5 | [lesson-slots/[id]/route.ts:33-92](../src/app/api/lesson-slots/[id]/route.ts) | 일정 변경(`scheduled_at` PUT) 시 `checkCoachBlock` 미호출 — 휴무일로 이동 가능 | 🔴 |
| B6 | [src/lib/checkCoachBlock.ts:40-45](../src/lib/checkCoachBlock.ts) | 레슨이 자정을 넘기면(23:30-00:30) 문자열 비교로 블록 오탐/누락 | 🟡 |
| B7 | [lesson-applications/[id]/route.ts:141-151](../src/app/api/lesson-applications/[id]/route.ts) | 회원이 신청 취소해도 이미 생성된 `lesson_plans`/`lesson_slots`가 남을 수 있음 | 🟡 |
| B8 | [src/lib/notify.ts](../src/lib/notify.ts) | ~~`user_id` 사용~~ → **수정 완료** (실제 컬럼 `profile_id`로 교체) | ✅ |

---

## Scenario A — 1:1 레슨 신청 → 코치 승인 → 관리자 승인

### Trace
1. `POST /api/lesson-applications` — [route.ts:100-195](../src/app/api/lesson-applications/route.ts)
2. 본인 중복 체크 → 휴무 체크 → 1:1 충돌 체크 → INSERT status='pending_coach'
3. 코치 알림 + 푸시 전송
4. `PATCH /api/lesson-applications/[id]` action='coach_approve' → status='pending_admin'
5. `PATCH /api/lesson-applications/[id]` action='admin_approve' → RPC `approve_lesson_application(app_id)` → `lesson_plans` + `lesson_slots` 생성

### 결과 상태
- `lesson_applications.status='approved'` + `lesson_plan_id` 링크
- `lesson_plans`: completed_count=0, payment_status='unpaid'
- `lesson_slots`: status='scheduled'

### 발견
- 🟢 정상 플로우, 알림 확정.

---

## Scenario B — 그룹레슨 정원 (max_students=4)

### ✅ 수정 완료 (2026-04-20)

#### 원인 분석
기존 로직은 `lesson_applications.requested_at`만으로 카운트. 하지만:
- **false-positive (안 찼는데 찼다고 표시)**: 승인 후 관리자가 `/owner/lesson-plan`에서 **`lesson_slots.scheduled_at` 을 다른 시간으로 이동**한 경우, `lesson_applications.requested_at`은 **원래 시간 그대로**. 원래 시간에 새 회원이 신청하면 이미 이동한 회원의 row 까지 세어 정원이 부풀어 보임.
- **false-negative (초과 발생)**: 동시 신청 시 TOCTOU + 1:1 확정 슬롯 존재여부 미고려.

#### 수정 내용
[lesson-applications/route.ts:130-165](../src/app/api/lesson-applications/route.ts) — 카운트 소스를 상태별로 분리:
- **pending_coach / pending_admin**: `lesson_applications.requested_at` (아직 슬롯 없음)
- **approved(확정됨)**: `lesson_slots.scheduled_at` + `lesson_plans.coach_id` (+ 가능하면 `program_id`) — **실제 확정 시간 기준**

이렇게 하면 "시간 이동된 확정 수업"은 원래 시간 카운트에서 빠지고, 이동한 시간에 올바로 카운트됨.

#### 미해결: TOCTOU 레이스
동시 신청 시 count→insert 사이 갭은 여전히 존재. 완전 차단은 DB 레벨 트리거 또는 RPC 필요. 향후 과제.

```
T0    req A: count=3
T0+1  req B: count=3   ← 두 요청이 동시에 조회
T0+2  req A: INSERT 성공 (4명째)
T0+3  req B: INSERT 성공 (5명째) ← 정원 초과!
```

#### 향후 보강안
1. DB 트리거로 INSERT 전 count 재확인
2. RPC로 count+insert 원자 트랜잭션화
3. 복합 UNIQUE + 카운터 row

---

## Scenario C — 시간 충돌 (다른 코치)

### Trace
```
회원 김철수: 05-10 14:00-15:00 코치 A 신청 → 승인
회원 김철수: 05-10 14:30-15:30 코치 B 신청
```
- [route.ts:117-128](../src/app/api/lesson-applications/route.ts) — 충돌 체크는 **같은 코치**만 검사. `s.lesson_plan.coach_id === coach_id`
- 본인 중복 체크(line 102-108)는 `requested_at` 정확히 일치하는 경우만 → 14:00과 14:30은 다름

### 🔴 결과
두 신청 모두 승인 가능. 회원이 **자신을 동시간 중복 예약**함.

### 수정안
```ts
// session.id(회원)의 lesson_slots를 시간 범위로 체크
const start = new Date(requested_at)
const end = new Date(start.getTime() + dur * 60000)
const { data: overlapping } = await supabaseAdmin
  .from('lesson_slots')
  .select('id, lesson_plan:lesson_plan_id!inner(member_id)')
  .in('status', ['scheduled'])
  .eq('lesson_plan.member_id', session.id)
  .lt('scheduled_at', end.toISOString())
  .gte('scheduled_at', new Date(start.getTime() - 3600_000).toISOString())
// 실제 겹침 여부는 코드에서 최종 판정
```

---

## Scenario D — 단일일 코치 휴무

### Trace
1. 코치 A: `block_date='2026-05-10'`, `block_start=null`, `block_end=null` 등록
2. 회원 신청: 2026-05-10 14:00 코치 A
3. [checkCoachBlock.ts:41](../src/lib/checkCoachBlock.ts) — `!b.block_start && !b.block_end` → 즉시 block 반환

### 결과
✅ 정상적으로 거절 ("코치 휴무").

---

## Scenario E — 매주 반복 휴무 (월요일 09:00-12:00)

### Trace
1. `repeat_weekly=true, day_of_week=1, block_start='09:00', block_end='12:00'`
2. 회원 신청 월요일 2026-05-11 10:00-11:00
3. [checkCoachBlock.ts:44](../src/lib/checkCoachBlock.ts) — `"10:00" < "12:00" && "11:00" > "09:00"` = TRUE → 거절 ✅
4. 회원 신청 월요일 2026-05-11 13:00-14:00 → `"13:00" < "12:00"` = FALSE → 통과 ✅

### 🟡 문자열 비교의 함정 (Scenario J와 연계)
문자열 `"23:30" > "22:00"` = TRUE (옳음)  
문자열 `"00:30" > "22:00"` = **FALSE** (자정 넘어가면 오판)

---

## Scenario F — 예약된 레슨에 나중에 휴무 등록

### Trace
1. 이미 `lesson_slots` 2026-05-10 14:00 scheduled 상태
2. 코치가 나중에 2026-05-10 휴무 등록
3. [coach-blocks/route.ts:39-55](../src/app/api/coach-blocks/route.ts) — INSERT만 하고 **기존 슬롯 조회/처리 안 함**

### 🔴 결과
- 충돌 상태로 DB에 공존 (슬롯은 scheduled, 코치는 휴무)
- 회원 앱에는 수업 그대로 표시, 코치 앱에는 휴무 표시
- 당일 실제 충돌 발생

### 수정안 (coach-blocks/route.ts POST 말미에)
```ts
// 블록 시간대와 겹치는 기존 슬롯 조회 → has_conflict=true 플래그
// 또는 관리자 알림 발송
```

---

## Scenario G — 취소·거절 경로

### G1. 회원 본인 취소
[route.ts:121-167](../src/app/api/lesson-applications/[id]/route.ts) — `pending_coach`/`pending_admin`만 허용, `approved`는 불가 ✅  
신청 row를 **DELETE**하고 코치에게 알림.

### G2. 코치 거절 (action=coach_reject)
status='rejected' 업데이트. 데이터 정리는 하지 않음 (soft delete).

### G3. 관리자 거절 (action=admin_reject)
동일하게 status='rejected'. **코치 단계에서 approved였던 RPC가 호출된 상태는 아님** (admin_approve에서만 RPC) — 데이터 일관성 OK.

### ✅ G5. 거절 → 재승인 멱등성 (수정 완료, 2026-04-20)

[lesson-applications/[id]/route.ts](../src/app/api/lesson-applications/[id]/route.ts) — PATCH 진입 시점에:
1. **현재 상태 조회** (`status`, `lesson_plan_id`)
2. **상태 전이 그래프 검증** — 허용되지 않은 전이는 409 반환
3. **멱등성 가드** — `admin_approve` 인데 `lesson_plan_id` 가 이미 채워져 있으면 차단

```ts
const ALLOWED: Record<string, string[]> = {
  pending_coach: ['pending_admin', 'rejected'],
  pending_admin: ['approved', 'rejected', 'pending_coach'],  // 관리자가 코치 재확인 요청 가능
  approved:      [],  // 확정 후 변경 불가
  rejected:      [],  // 거절 후 재승인 불가 — 필요 시 새 신청
}
```

이제:
- `rejected` 상태 → `admin_approve` 호출 시 409 ("상태 전이 불가")
- `approved` 상태 → 어떤 action도 409
- `admin_approve` 재호출 → 409 ("이미 확정 처리된 신청입니다")
- RPC `approve_lesson_application`이 한 번만 호출됨을 보장

---

## Scenario H — 그룹레슨 중 1명 취소

### 구조
각 회원이 **별개의 lesson_plans**를 가짐 (plan 1인당 1개, 같은 코치·시간·프로그램 공유).

### Trace
1. 회원1 plan P1, 회원2 plan P2, 회원3 plan P3 — 모두 approved
2. 회원1이 취소 요청(DELETE):
   - [route.ts:148-151](../src/app/api/lesson-applications/[id]/route.ts) — `lesson_applications` row DELETE
3. 하지만 P1(lesson_plans) 및 해당 lesson_slots는 **삭제되지 않음**

### 🟡 결과
- 회원1의 결제 페이지(`/member/payment`)에는 P1이 그대로 남음
- 회원2·3의 수업은 영향 없음 (개별 plan이므로 정상)

### 수정안
DELETE 시 `lesson_plan_id`를 조회해 해당 plan·slot도 삭제 (또는 `cancelled_at` 컬럼 추가).

---

## Scenario I — 다음 달 동기화 (`/api/cron/sync-next-month`)

### Trace
1. 25일 이후 수동 호출 (또는 외부 스케줄러)
2. `CRON_SECRET` 검증
3. 다음 달 `months` row 없으면 생성
4. 현재 달 lesson_plans (`next_month_synced=false`) 조회
5. 각 plan의 lesson_slots에서 **요일+시간 패턴 추출** (50% 이상 등장한 패턴만)
6. 패턴별로 다음 달 날짜에 매핑, `coach_blocks` 충돌 시 `has_conflict=true` 마킹
7. 새 plan + draft slot INSERT, 원본 plan에 `next_month_synced=true`

### 🟡 관찰
- **50% 임계값 과도** — 월 4회 수업 중 3회 월요일+1회 금요일이면 금요일 패턴이 누락
- **유틸리티 함수의 KST 변환이 `new Date() + 9h`** — DST나 서버 TZ 변경에 취약
- **충돌 슬롯은 draft로만 생성** — 관리자가 `/owner/schedule-draft`에서 수동 확인 필요. 누락 위험.

### 멱등성
- 이미 `next_month_synced=true`면 스킵 ✅
- 그러나 RPC/INSERT 실패 중간 상태는 롤백 안 됨 → 부분 생성 후 재실행 시 중복 생성 가능

---

## Scenario J — 월 경계 + 타임존

### 상황: 2026-04-30 23:00 KST 시작 60분 수업

### auto-complete cron 동작
[cron/auto-complete/route.ts](../src/app/api/cron/auto-complete/route.ts) — `vercel.json`에 `"0 15 * * *"` = **UTC 15:00 = KST 00:00** (자정).
- 2026-04-30 23:00 KST에 시작한 수업 종료 시각: 2026-05-01 00:00 KST
- 그날 자정 (2026-05-01 00:00 KST) cron 실행 → 종료 직후라 status='completed' 전이 정확 ✅

### 🟡 그러나
- 수업이 자정을 넘기면 `checkCoachBlock.ts`의 문자열 비교가 오작동 (Scenario E 참조)
- 23:30-00:30 수업은 `hhmm="23:30"`, `endHhmm="00:30"` — 블록 22:00-23:59 검사 시:
  - `"23:30" < "23:59"` = TRUE
  - `"00:30" > "22:00"` = FALSE ← 잘못된 판정
- 실제는 겹치지만 코드는 "안 겹침"으로 판단.

### 수정 (checkCoachBlock)
```ts
// 분 단위 정수로 변환
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
// 자정 넘기면 end가 start보다 작을 수 있음 → 두 구간으로 분리
const startMin = toMin(hhmm)
const endMinRaw = toMin(endHhmm)
const endMin = endMinRaw < startMin ? endMinRaw + 24*60 : endMinRaw
const bStartMin = toMin(bStart)
const bEndMin = toMin(bEnd)
if (startMin < bEndMin && endMin > bStartMin) return b
```

---

## Scenario K — 결제 + 완료 상호작용

### Trace
1. plan: total_count=4, completed_count=0, payment_status='unpaid'
2. 회원 결제 → 'paid'
3. 2회 자동 완료 → completed_count=2 (RPC increment_completed)
4. 1회 absent 처리 → [lesson-slots/[id]/route.ts:94-110](../src/app/api/lesson-slots/[id]/route.ts) — `if (status === 'completed')` 만 증가. absent는 미증가.
5. 보강수업 생성 → [makeup/route.ts](../src/app/api/makeup/route.ts) — 새 slot INSERT, 원본 slot 'absent'로 전환

### 🟡 관찰
- **결석(absent)이 completed_count에 안 들어감** — 만약 결석도 출석으로 간주하는 정책이면 잘못됨. 정책 명시 필요.
- **보강 slot이 total_count에 추가 안 됨** — 회원은 4회 결제, 실제 slot은 5개(원본 4 + 보강 1). `total_count`가 실제 수업 수를 반영하지 않음.

---

## Scenario L — RPC `approve_lesson_application`

### 제약
RPC는 DB 내부에 존재해서 코드로는 행동만 추정.
호출 측 [route.ts:42](../src/app/api/lesson-applications/[id]/route.ts) — `rpc('approve_lesson_application', { app_id: id })`

### 🟡 우려사항
- RPC 구현 확인 불가 → 트랜잭션 여부, ON CONFLICT 처리, 오류 복구 동작 불명
- 이미 승인된 app에 재호출 시 중복 `lesson_plans` 생성 방지책이 RPC 내부에 있어야 함 (없으면 중복)

### 조치
- Supabase Studio에서 RPC 정의를 확인하고 **idempotent 보장** 여부 검증 필요
- 권장: `INSERT INTO lesson_plans (...) ON CONFLICT (app_id) DO NOTHING RETURNING id`

---

## Scenario M — 공개 `/api/apply` 레이스

### Trace
1. 두 요청이 동일 전화번호로 동시 POST
2. [apply/route.ts:19-24](../src/app/api/apply/route.ts) — `maybeSingle()`로 조회
3. 둘 다 null → 둘 다 INSERT 시도
4. 두 번째는 `profiles.phone` UNIQUE 제약 위반 → `error.code === '23505'` → "이미 등록된 전화번호" 반환

### 🟢 결과
TOCTOU 존재하지만 DB 제약으로 방어됨. 정상 동작.

---

## Scenario N — Rate Limit 동작

### Redis 환경변수 미설정
[src/lib/ratelimit.ts:9-15](../src/lib/ratelimit.ts) — `redis = null` → `checkRate` 즉시 `null` 반환 (통과) ✅

### IP 추출 폴백
[ratelimit.ts:34-40](../src/lib/ratelimit.ts)
1. `x-forwarded-for` 첫 값
2. `x-real-ip`
3. `'unknown'`

### 🟡 우려
- 둘 다 없으면 'unknown' 공용 버킷 → 모든 해당 요청이 한 버킷 공유
- Vercel은 항상 `x-forwarded-for`를 세팅하므로 실환경에서는 문제 없음
- 로컬 개발 시에는 버킷 충돌 가능 (무시해도 됨)

### NAT 뒤 합법적 병렬 로그인
- 같은 IP에서 1분 5회 제한이므로 가족 3-4명이 동시에 로그인해도 OK
- 그러나 학원 PC방 등 다수 환경에서는 제한 근접 가능 → 합리적 수준

---

## 추가 발견 (코드 크로스 체크)

### N1. 🔴 notifications 테이블 컬럼명 혼동 (수정 완료)
- 전 코드베이스가 `profile_id` 사용
- 제가 만든 `src/lib/notify.ts`가 `user_id`로 작성되어 있었음 → **수정 완료**

### N2. 🟡 `lesson-slots/[id]` DELETE의 RLS 관련
[route.ts:121-142](../src/app/api/lesson-slots/[id]/route.ts) — admin/owner만 가능.
삭제 시 `lesson_applications.original_slot_id`를 null로 먼저 바꾸고 삭제. **그러나 연관 `lesson_plans`는 그대로**. 또다시 고아 상태 가능.

### N3. 🟡 `lesson-slots/cancel`의 `decrement_total_count` RPC
[cancel/route.ts:40-43](../src/app/api/lesson-slots/cancel/route.ts) — 음수 체크 없음. total_count=0인 plan에 취소 시 -1이 될 수 있음.

### N4. 🟡 그룹레슨 시간 `requested_at` 정확 일치 매칭
[route.ts:141](../src/app/api/lesson-applications/route.ts) — `.eq('requested_at', slotStart)` — 밀리초 단위까지 정확해야 매칭. 클라이언트가 서로 다른 밀리초로 요청하면 **같은 시간대**로 묶이지 않음.

---

## 체크리스트 (액션 아이템)

### 즉시 패치 필요 🔴
- [⏭] 회원 본인 시간 겹침 검증 (Scenario C) — **사용자 판단으로 수용**
- [x] 그룹 정원 카운트 로직 (Scenario B) — **수정 완료** (TOCTOU 방지는 DB 트리거로 후속)
- [x] 상태 전이 그래프 검증 + admin_approve 멱등성 (Scenario G) — **수정 완료**
- [ ] 휴무 등록 시 기존 slot 충돌 경고 (Scenario F)
- [ ] 슬롯 일정 변경(PUT) 시 `checkCoachBlock` 호출 (Scenario F 후속)
- [x] `notify.ts`의 `profile_id` 수정 (N1 — 완료)

### 개선 권장 🟡
- [ ] `checkCoachBlock` 분 단위 정수 비교로 교체 (자정 크로싱 대응)
- [ ] 보강/결석이 `total_count`·`completed_count`에 반영되는 정책 명문화
- [ ] `decrement_total_count` RPC 음수 가드
- [ ] RPC `approve_lesson_application` idempotency 검증 (DB 측)
- [ ] sync-next-month 패턴 임계값 재조정 (50% → max(50%, ≥2))

### 문서/관찰 🟢
- 타임존 처리는 전반적으로 `+9h` 수동 계산 → 장기적으로 `date-fns-tz`/`dayjs tz` 도입 검토
- 그룹레슨 정확한 시작시각(`requested_at`)을 클라이언트에서 동일하게 생성하는지 QA 필요

---

## 참고: 시뮬레이션 기반 가정

- 이 문서는 **정적 분석**(코드 경로 추적) 기반. 실제 Supabase RPC 내부 동작, DB 제약, 트리거는 별도 확인 필요.
- Supabase Studio에서 다음을 확인 권장:
  1. `notifications` 테이블 스키마 (특히 `profile_id`, `type`, `is_read` 컬럼)
  2. RPC `approve_lesson_application` 정의
  3. RPC `increment_completed`, `decrement_total_count` 구현
  4. `lesson_applications` 테이블 UNIQUE/CHECK 제약 유무
  5. `profiles.phone` UNIQUE 제약 확인
