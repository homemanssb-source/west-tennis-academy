-- =============================================================================
-- Migration: lesson_applications.lesson_plan_id 컬럼 도입 + RPC 교체 + Backfill
-- =============================================================================
-- 배경:
--   코드(B3 수정 포함)가 lesson_applications.lesson_plan_id 를 참조하지만
--   실제 DB 에는 해당 컬럼이 없는 상태(백필 SQL 에서 42703 에러 발생으로 확인).
--   이 때문에 /api/lesson-applications/[id] PATCH 가 프로덕션에서 실패할 수 있음.
--
-- 실행 순서: Supabase Studio → SQL Editor 에 전체 복사 후 한 번에 RUN.
-- 이 파일은 idempotent (여러 번 실행해도 안전) 하게 작성되어 있음.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 1] 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE lesson_applications
  ADD COLUMN IF NOT EXISTS lesson_plan_id uuid
  REFERENCES lesson_plans(id) ON DELETE SET NULL;

-- 조회 성능 (app → plan 역참조)
CREATE INDEX IF NOT EXISTS idx_lesson_applications_lesson_plan_id
  ON lesson_applications(lesson_plan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 2] 기존 approved app 을 해당 family 의 plan 에 연결 (backfill)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE lesson_applications la
SET lesson_plan_id = lp.id
FROM lesson_plans lp
WHERE la.lesson_plan_id IS NULL
  AND la.status = 'approved'
  AND la.member_id = lp.member_id
  AND la.coach_id  = lp.coach_id
  AND la.month_id  = lp.month_id
  AND (
    (la.family_member_id IS NULL AND lp.family_member_id IS NULL)
    OR la.family_member_id = lp.family_member_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 3] RPC 재생성 (R1/R2/R3 개선 포함)
--   - family-key advisory lock 추가
--   - 중복 방지 heuristic 을 lesson_plan_id IS NULL 로 교체 (리스케줄 안전)
--   - 함수 말미에 lesson_applications.lesson_plan_id 세팅
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_lesson_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  app              lesson_applications%ROWTYPE;
  existing_plan_id uuid;
  all_apps_count   int;
  family_key       text;
BEGIN
  -- app_id 단위 lock (같은 app 재호출 차단)
  PERFORM pg_advisory_xact_lock(hashtext(app_id::text));

  SELECT * INTO app FROM lesson_applications WHERE id = app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson_application % not found', app_id;
  END IF;

  -- family 단위 lock (같은 가족 다른 app 동시 승인 시 plan 중복 차단)
  family_key := app.member_id::text || '|' ||
                app.coach_id::text  || '|' ||
                app.month_id::text  || '|' ||
                COALESCE(app.family_member_id::text, 'self');
  PERFORM pg_advisory_xact_lock(hashtext(family_key));

  -- family 단위 approved app 총 개수 (plan.total_count 초기값용)
  SELECT COUNT(*) INTO all_apps_count
  FROM lesson_applications
  WHERE member_id = app.member_id
    AND coach_id  = app.coach_id
    AND month_id  = app.month_id
    AND status    = 'approved'
    AND (
      (family_member_id IS NULL AND app.family_member_id IS NULL)
      OR family_member_id = app.family_member_id
    );

  -- 기존 plan 검색 (family 단위)
  SELECT id INTO existing_plan_id
  FROM lesson_plans
  WHERE member_id = app.member_id
    AND coach_id  = app.coach_id
    AND month_id  = app.month_id
    AND (
      (family_member_id IS NULL AND app.family_member_id IS NULL)
      OR family_member_id = app.family_member_id
    )
  LIMIT 1
  FOR UPDATE;

  IF existing_plan_id IS NOT NULL THEN
    -- 아직 plan 에 연결 안 된 approved app 만 슬롯 생성
    -- (리스케줄로 scheduled_at 이 바뀌어도 영향 없음)
    INSERT INTO lesson_slots (lesson_plan_id, scheduled_at, duration_minutes, status, slot_type, is_makeup)
    SELECT
      existing_plan_id,
      a.requested_at,
      a.duration_minutes,
      'scheduled',
      'lesson',
      false
    FROM lesson_applications a
    WHERE a.member_id = app.member_id
      AND a.coach_id  = app.coach_id
      AND a.month_id  = app.month_id
      AND a.status    = 'approved'
      AND (
        (a.family_member_id IS NULL AND app.family_member_id IS NULL)
        OR a.family_member_id = app.family_member_id
      )
      AND a.lesson_plan_id IS NULL;

    -- 활성 슬롯 수로 total_count 재계산
    UPDATE lesson_plans
    SET total_count = (
      SELECT COUNT(*) FROM lesson_slots
      WHERE lesson_plan_id = existing_plan_id
        AND status IN ('scheduled', 'completed')
    )
    WHERE id = existing_plan_id;

  ELSE
    -- 신규 plan 생성
    INSERT INTO lesson_plans
      (member_id, coach_id, month_id, lesson_type, unit_minutes, total_count,
       completed_count, payment_status, amount, family_member_id)
    VALUES
      (app.member_id, app.coach_id, app.month_id, app.lesson_type, app.duration_minutes,
       all_apps_count, 0, 'unpaid', 0, app.family_member_id)
    RETURNING id INTO existing_plan_id;

    -- family 의 모든 approved app 에 대해 초기 슬롯 생성
    INSERT INTO lesson_slots (lesson_plan_id, scheduled_at, duration_minutes, status, slot_type, is_makeup)
    SELECT
      existing_plan_id,
      a.requested_at,
      a.duration_minutes,
      'scheduled',
      'lesson',
      false
    FROM lesson_applications a
    WHERE a.member_id = app.member_id
      AND a.coach_id  = app.coach_id
      AND a.month_id  = app.month_id
      AND a.status    = 'approved'
      AND (
        (a.family_member_id IS NULL AND app.family_member_id IS NULL)
        OR a.family_member_id = app.family_member_id
      );
  END IF;

  -- family 내 모든 approved app 에 lesson_plan_id 세팅
  -- (B3 상위 API 의 멱등성 secondary 가드 활성화 + 다음 승인 시 중복 INSERT 차단)
  UPDATE lesson_applications
  SET lesson_plan_id = existing_plan_id
  WHERE member_id = app.member_id
    AND coach_id  = app.coach_id
    AND month_id  = app.month_id
    AND status    = 'approved'
    AND lesson_plan_id IS NULL
    AND (
      (family_member_id IS NULL AND app.family_member_id IS NULL)
      OR family_member_id = app.family_member_id
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증 쿼리 (선택): 실행 후 상태 확인용
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM lesson_applications WHERE status='approved' AND lesson_plan_id IS NULL;
-- → 0 이어야 정상 (backfill 완료)

-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='lesson_applications' AND column_name='lesson_plan_id';
-- → 1 row 반환해야 정상

-- SELECT pg_get_functiondef('approve_lesson_application(uuid)'::regprocedure);
-- → RPC 본문에 'family_key' 문자열이 포함돼 있어야 함 (신 버전 적용 확인)
