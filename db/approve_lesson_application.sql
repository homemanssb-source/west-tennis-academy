-- =============================================================================
-- RPC: approve_lesson_application (수정판)
-- =============================================================================
-- 개선점:
--   [1] 가족(family) 단위 advisory lock 추가
--       → 서로 다른 app_id 라도 같은 가족이면 직렬화되어 ELSE 분기 레이스 차단
--   [2] 슬롯 중복 INSERT 방지 heuristic 개선
--       → 기존: NOT IN scheduled_at (리스케줄 시 requested_at 과 괴리되어 중복 생성)
--       → 개선: 이미 lesson_plan_id 가 세팅된 app 은 스킵 (app-level 소비 추적)
--   [3] 마지막에 UPDATE lesson_applications SET lesson_plan_id = ...
--       → B3 상위 API 의 lesson_plan_id 멱등성 secondary 가드 활성화
--
-- 사용 전 필요:
--   (선택) lesson_applications.lesson_plan_id 컬럼이 없다면:
--     ALTER TABLE lesson_applications ADD COLUMN IF NOT EXISTS lesson_plan_id uuid
--       REFERENCES lesson_plans(id) ON DELETE SET NULL;
-- =============================================================================

CREATE OR REPLACE FUNCTION approve_lesson_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  app             lesson_applications%ROWTYPE;
  existing_plan_id uuid;
  all_apps_count  int;
  family_key      text;
BEGIN
  -- [1a] app_id 단위 lock (같은 app 재호출 차단)
  PERFORM pg_advisory_xact_lock(hashtext(app_id::text));

  SELECT * INTO app FROM lesson_applications WHERE id = app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson_application % not found', app_id;
  END IF;

  -- [1b] family 단위 lock (같은 가족의 서로 다른 app 동시 승인 시 plan 중복 생성 차단)
  family_key := app.member_id::text || '|' ||
                app.coach_id::text  || '|' ||
                app.month_id::text  || '|' ||
                COALESCE(app.family_member_id::text, 'self');
  PERFORM pg_advisory_xact_lock(hashtext(family_key));

  -- 가족 단위 approved app 총 개수 (plan.total_count 초기값 용)
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
    -- [2] 아직 plan 에 연결 안 된 approved app 만 슬롯 생성
    --     (requested_at 기반이 아닌 lesson_plan_id IS NULL 기반이라 리스케줄 영향 없음)
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
      AND a.lesson_plan_id IS NULL;  -- 아직 소비되지 않은 app 만

    -- total_count 재계산
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

    -- 초기 슬롯 생성 — family 의 모든 approved app
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

  -- [3] family 내 모든 approved app 에 lesson_plan_id 세팅
  --     → B3 상위 API 의 멱등성 secondary 가드 활성화
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
