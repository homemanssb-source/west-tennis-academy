# 11. RPC `approve_lesson_application` 감사 + 수정안

실제 DB 함수 소스를 검토한 결과.

## 1. 함수 책임 요약

`admin_approve` 액션이 호출하는 DB RPC. `lesson_applications` 의 특정 row 를 기반으로:
1. (family 단위) 기존 `lesson_plans` 가 있으면 재사용, 없으면 새로 생성
2. 같은 family 의 approved app 을 순회해 `lesson_slots` 생성
3. `lesson_plans.total_count` 를 실제 슬롯 수에 맞춤

## 2. 잘 설계된 부분 ✅

| 요소 | 의도 |
|------|------|
| `pg_advisory_xact_lock(hashtext(app_id::text))` | 같은 app 동시 재호출 차단 (재시도·중복 클릭 방어) |
| `SELECT ... FOR UPDATE` on lesson_plans | 같은 플랜 동시 수정 직렬화 |
| `family_member_id IS NULL` 분기 | 부모 vs 각 자녀마다 별개 plan |
| `NOT IN scheduled_at` 체크 | 같은 시간 슬롯 재생성 방지 (단, 후술 버그) |

## 3. 발견된 문제

### 🔴 R1 — 리스케줄 후 재승인 시 중복 슬롯 생성

**시나리오**
1. 회원 John: 4월 10:00, 11:00 신청
2. admin_approve(10:00 app) → plan 생성 + slot @10:00
3. 관리자가 `PUT /api/lesson-slots/:id` 로 slot 을 **10:30 으로 이동**
   - `lesson_slots.scheduled_at` = `'10:30'`
   - `lesson_applications.requested_at` = `'10:00'` (변경 안 됨)
4. admin_approve(11:00 app) → IF 분기
   - `NOT IN (SELECT scheduled_at ...)` = `NOT IN ('10:30')`
   - 10:00 app 의 `requested_at` = `'10:00'` → NOT IN ('10:30') = **TRUE** → 슬롯 재삽입!
   - 결과: John 의 plan 에 `[10:30, 10:00 (복제), 11:00]` 3개 슬롯

**근본 원인**: `lesson_applications.requested_at` ↔ `lesson_slots.scheduled_at` 간 직접 FK 부재. 리스케줄 시 두 값 괴리.

### 🟡 R2 — ELSE 분기 가족 레이스

advisory lock 이 `app_id` 만 키로 잡혀, 같은 가족의 서로 다른 app 을 동시에 승인하면:
- 두 스레드 모두 `existing_plan_id = NULL` 읽음 → 둘 다 ELSE 분기 → **같은 family 에 plan 이 2개 생성**

### 🟡 R3 — `lesson_applications.lesson_plan_id` 미세팅

RPC 가 app row 의 `lesson_plan_id` 를 갱신하지 않음. 
→ B3 상위 API 의 **secondary 멱등성 가드**(`if (current.lesson_plan_id)` 차단) 영원히 비활성.
→ 단, primary 가드(상태전이 그래프: `approved → []`) 가 재호출을 409 로 막으므로 실제 보호는 유지됨.

## 4. 수정 SQL

[db/approve_lesson_application.sql](../db/approve_lesson_application.sql) 참조.

### 수정 포인트

1. **family-key advisory lock 추가**
   ```sql
   family_key := member_id || '|' || coach_id || '|' || month_id || '|' ||
                 COALESCE(family_member_id, 'self');
   PERFORM pg_advisory_xact_lock(hashtext(family_key));
   ```
   → R2 해결

2. **중복 방지 heuristic 교체**
   - 기존: `AND a.requested_at NOT IN (SELECT scheduled_at FROM lesson_slots ...)`
   - 개선: `AND a.lesson_plan_id IS NULL`  (아직 plan 에 소비되지 않은 app 만)
   → R1 해결

3. **함수 말미에 app.lesson_plan_id 세팅**
   ```sql
   UPDATE lesson_applications
   SET lesson_plan_id = existing_plan_id
   WHERE (family 조건) AND status='approved' AND lesson_plan_id IS NULL;
   ```
   → R3 해결 + 2번 개선 전제 조건

## 5. 선행 스키마 확인

`lesson_applications` 테이블에 `lesson_plan_id uuid` 컬럼이 없다면:
```sql
ALTER TABLE lesson_applications
  ADD COLUMN IF NOT EXISTS lesson_plan_id uuid
  REFERENCES lesson_plans(id) ON DELETE SET NULL;
```
(B3 코드에서 이 필드를 읽는 것으로 보아 컬럼은 이미 있을 가능성 높음. 확인만 하세요.)

## 6. 적용 절차

1. Supabase Studio → Database → Functions → `approve_lesson_application` 선택
2. `db/approve_lesson_application.sql` 의 함수 본문 복사 붙여넣기
3. Save
4. 테스트: 동일한 app 에 대해 admin_approve 두 번 호출하면 두 번째가 **app_id advisory lock 대기 후 NOP** 처리됨 (멱등성 확인)
5. 리스케줄 테스트:
   - app1, app2 신청 → app1 승인 (슬롯 @10:00 생성)
   - 해당 슬롯을 10:30 으로 이동
   - app2 승인 → **app1 의 새 슬롯이 복제되지 않아야 함** (lesson_plan_id 체크로 차단)

## 7. 장기 개선 (선택)

현재 구조는 `lesson_applications` 와 `lesson_slots` 를 `lesson_plan_id` 만으로 간접 연결. 다음 스키마 개선 고려:

```sql
ALTER TABLE lesson_slots
  ADD COLUMN lesson_application_id uuid
  REFERENCES lesson_applications(id) ON DELETE SET NULL;
```

→ 슬롯과 원 신청 간 직접 FK. 리스케줄·취소 시 cascade 처리가 명확해짐.
→ 단, 마이그레이션 + 기존 슬롯 backfill 필요.

지금 적용할 필요는 없지만 다음 리팩터 사이클에 검토 권장.
