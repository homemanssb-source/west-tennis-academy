# 07. Cron Jobs

Vercel Cron 1건 + 수동 트리거 4건. 모든 cron 라우트는 `Authorization: Bearer $CRON_SECRET` 검증.

## 스케줄 설정

[vercel.json](../vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/auto-complete", "schedule": "0 15 * * *" }
  ]
}
```

## Cron 목록

### 1. `auto-complete` (⏰ 매일 15:00)
[src/app/api/cron/auto-complete/route.ts](../src/app/api/cron/auto-complete/route.ts)

- 목적: 종료 시간이 지난 `lesson_slots`를 자동으로 `completed` 처리
- 로직:
  1. `SELECT * FROM lesson_slots WHERE status='scheduled' AND end_at < now()`
  2. `UPDATE ... SET status='completed'`
  3. RPC `increment_completed_by`로 `lesson_plans.completed_count` 증가
- Vercel Cron으로 자동 실행

### 2. `unpaid-notify` (수동)
[src/app/api/cron/unpaid-notify/route.ts](../src/app/api/cron/unpaid-notify/route.ts)

- 목적: 미납 회원에게 결제 독촉
- 대상: `lesson_plans.payment_status = 'unpaid'`
- 동작: `notifications` insert + push 발송
- 호출 방법: 외부 스케줄러(또는 관리자)가 Bearer 토큰으로 POST

### 3. `lesson-remind` (수동)
[src/app/api/cron/lesson-remind/route.ts](../src/app/api/cron/lesson-remind/route.ts)

- 목적: 내일 있을 레슨 리마인더
- 대상: `lesson_slots`의 내일자 scheduled 건
- 수신자: 회원 + 코치

### 4. `lesson-fee-notify` (수동)
[src/app/api/cron/lesson-fee-notify/route.ts](../src/app/api/cron/lesson-fee-notify/route.ts)

- 목적: 코치별 월 수당 요약 통지
- 대상: 이번 달 completed 슬롯을 가진 코치

### 5. `sync-next-month` (수동)
[src/app/api/cron/sync-next-month/route.ts](../src/app/api/cron/sync-next-month/route.ts)

- 목적: 다음 달 `lesson_plans` 복제 + `lesson_slots` 자동 생성
- 주의: `coach_blocks.repeat_weekly`를 고려해 휴무일은 건너뜀
- 보통 월말에 수동 실행

## 호출 예시 (수동 cron)

```bash
curl -X POST "https://wta.example.com/api/cron/sync-next-month" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 추가 고려사항

- 자동 cron은 Vercel Hobby 플랜에서 제한이 있을 수 있음 → 유료 플랜 권장
- 수동 cron 4건은 외부 스케줄러(Upstash QStash 등)나 관리자 UI 버튼에서 호출하면 자동화 가능
- `CRON_SECRET` 환경변수 필수
