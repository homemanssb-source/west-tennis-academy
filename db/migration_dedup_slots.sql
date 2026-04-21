-- =============================================================================
-- Migration: 중복 lesson_slots 정리 + 재발 방지 (UNIQUE index + RPC 패치)
-- =============================================================================
-- 원인: 이전 백필 마이그레이션의 RPC ELSE/IF 분기에서
--      "같은 plan 의 같은 scheduled_at" 에 대한 가드가 없어 중복 slot INSERT 발생.
-- 조치: 중복 제거 + partial unique index 로 DB 레벨 재발 차단 + RPC 에 ON CONFLICT
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 1] 삭제 예정 slot 에서 FK 참조(lesson_applications.original_slot_id) 해제
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE lesson_applications
SET original_slot_id = NULL
WHERE original_slot_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY lesson_plan_id, scheduled_at
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'scheduled' THEN 1
          ELSE 2
        END,
        created_at ASC
    ) AS rn
    FROM lesson_slots
    WHERE is_makeup = false
  ) t
  WHERE t.rn > 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 2] 중복 slot 삭제 (plan_id × scheduled_at 기준, 가장 오래된 + 완료 우선 유지)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM lesson_slots
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY lesson_plan_id, scheduled_at
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'scheduled' THEN 1
          ELSE 2
        END,
        created_at ASC
    ) AS rn
    FROM lesson_slots
    WHERE is_makeup = false
  ) t
  WHERE t.rn > 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 3] 영향받은 plan 들의 total_count 일괄 재계산
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE lesson_plans lp
SET total_count = COALESCE((
  SELECT COUNT(*)
  FROM lesson_slots ls
  WHERE ls.lesson_plan_id = lp.id
    AND ls.status IN ('scheduled', 'completed')
), 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 4] 재발 방지 partial unique index
--   - 활성 상태(scheduled/completed)의 본 수업만 대상
--   - 보강(is_makeup=true) 슬롯은 같은 시간에 있어도 허용
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lesson_slots_plan_time_active
  ON lesson_slots (lesson_plan_id, scheduled_at)
  WHERE status IN ('scheduled', 'completed') AND is_makeup = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- [STEP 5] RPC 재생성: INSERT 에 ON CONFLICT DO NOTHING 추가
--   (혹시 race 로 중복 시도되어도 DB 가 조용히 skip)
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
  PERFORM pg_advisory_xact_lock(hashtext(app_id::text));

  SELECT * INTO app FROM lesson_applications WHERE id = app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson_application % not found', app_id;
  END IF;

  family_key := app.member_id::text || '|' ||
                app.coach_id::text  || '|' ||
                app.month_id::text  || '|' ||
                COALESCE(app.family_member_id::text, 'self');
  PERFORM pg_advisory_xact_lock(hashtext(family_key));

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
    -- 중복 (plan_id, scheduled_at) 조합은 DO NOTHING
    INSERT INTO lesson_slots (lesson_plan_id, scheduled_at, duration_minutes, status, slot_type, is_makeup)
    SELECT existing_plan_id, a.requested_at, a.duration_minutes, 'scheduled', 'lesson', false
    FROM lesson_applications a
    WHERE a.member_id = app.member_id
      AND a.coach_id  = app.coach_id
      AND a.month_id  = app.month_id
      AND a.status    = 'approved'
      AND (
        (a.family_member_id IS NULL AND app.family_member_id IS NULL)
        OR a.family_member_id = app.family_member_id
      )
      AND a.lesson_plan_id IS NULL
    ON CONFLICT DO NOTHING;

    UPDATE lesson_plans
    SET total_count = (
      SELECT COUNT(*) FROM lesson_slots
      WHERE lesson_plan_id = existing_plan_id
        AND status IN ('scheduled', 'completed')
    )
    WHERE id = existing_plan_id;

  ELSE
    INSERT INTO lesson_plans
      (member_id, coach_id, month_id, lesson_type, unit_minutes, total_count,
       completed_count, payment_status, amount, family_member_id)
    VALUES
      (app.member_id, app.coach_id, app.month_id, app.lesson_type, app.duration_minutes,
       all_apps_count, 0, 'unpaid', 0, app.family_member_id)
    RETURNING id INTO existing_plan_id;

    -- 신규 plan 이지만 중복 app 가 있을 수 있어 DO NOTHING
    INSERT INTO lesson_slots (lesson_plan_id, scheduled_at, duration_minutes, status, slot_type, is_makeup)
    SELECT existing_plan_id, a.requested_at, a.duration_minutes, 'scheduled', 'lesson', false
    FROM lesson_applications a
    WHERE a.member_id = app.member_id
      AND a.coach_id  = app.coach_id
      AND a.month_id  = app.month_id
      AND a.status    = 'approved'
      AND (
        (a.family_member_id IS NULL AND app.family_member_id IS NULL)
        OR a.family_member_id = app.family_member_id
      )
    ON CONFLICT DO NOTHING;

    -- total_count 를 실제 INSERT 된 slot 수로 재계산
    UPDATE lesson_plans
    SET total_count = (
      SELECT COUNT(*) FROM lesson_slots
      WHERE lesson_plan_id = existing_plan_id
        AND status IN ('scheduled', 'completed')
    )
    WHERE id = existing_plan_id;
  END IF;

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
-- [STEP 6] 검증 쿼리 (선택)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT lesson_plan_id, scheduled_at, COUNT(*)
-- FROM lesson_slots
-- WHERE is_makeup = false AND status IN ('scheduled', 'completed')
-- GROUP BY lesson_plan_id, scheduled_at
-- HAVING COUNT(*) > 1;
-- → 0 rows 여야 정상 (중복 제거 완료 + index 로 재발 방지)
