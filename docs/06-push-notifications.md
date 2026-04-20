# 06. 푸시 알림 구조

Web Push(VAPID) 기반. 인앱 알림(`notifications` 테이블) + 브라우저 푸시(`push_subscriptions`) 2트랙.

## 파일 연결

| 레이어 | 파일 | 역할 |
|--------|------|------|
| Service Worker | [public/sw.js](../public/sw.js) | push 이벤트 수신 · 클릭 라우팅 |
| Client Hook | [src/lib/usePush.ts](../src/lib/usePush.ts) | 구독 / 해제 / 상태 확인 |
| Client UI | [src/components/notifications/](../src/components/notifications) | NotificationBell (읽음 처리) |
| Server Helper | [src/lib/push.ts](../src/lib/push.ts) | `sendPushToUser(profile_id, title, body, link)` |
| API | [src/app/api/push/subscribe](../src/app/api/push/subscribe) | endpoint 등록/해제 |
| API | [src/app/api/push/send](../src/app/api/push/send) | 내부 발송 트리거 |
| API | [src/app/api/notifications](../src/app/api/notifications) | 인앱 알림 리스트 |

## 구독 플로우 (브라우저)

```
usePush.subscribe()
  │
  ├─ navigator.serviceWorker.register('/sw.js')
  ├─ PushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })
  └─ POST /api/push/subscribe { endpoint, keys }
        └─ upsert into push_subscriptions
```

해제는 `usePush.unsubscribe()` → DELETE `/api/push/subscribe`.

## 발송 플로우 (서버)

```
lib/push.ts
  sendPushToUser(profileId, title, body, link)
      │
      ├─ SELECT * FROM push_subscriptions WHERE profile_id = ?
      ├─ for each sub: webpush.sendNotification(sub, payload)
      └─ (실패 시 구독 제거)

동시에 INSERT INTO notifications (user_id, title, body, link, is_read=false)
```

## 푸시 트리거 지점

| 이벤트 | 트리거 API | 수신자 |
|--------|-----------|--------|
| 회원이 레슨 신청 | POST `/api/lesson-applications` | 코치 |
| 코치 1차 승인/거절 | PATCH `/api/lesson-applications/[id]` (`coach_approve`) | 관리자 + 회원 |
| 관리자 2차 승인/거절 | PATCH `/api/lesson-applications/[id]` (`admin_approve`) | 회원 |
| 코치가 슬롯 취소 | POST `/api/lesson-slots/cancel` | 회원 |
| 내일 레슨 리마인더 | cron `/api/cron/lesson-remind` | 회원 / 코치 |
| 미납 통지 | cron `/api/cron/unpaid-notify` | 회원 |
| 월말 수당 통지 | cron `/api/cron/lesson-fee-notify` | 코치 |
| 전체 공지 | POST `/api/notifications/send` | 지정 대상 |

## VAPID 환경변수

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY   # 브라우저 subscribe 용
VAPID_PRIVATE_KEY              # 서버 서명
VAPID_SUBJECT                  # 예: mailto:admin@example.com
```

## Service Worker 주의사항

- 알림 클릭 시 payload의 `link` 필드로 이동 → 서버에서 `sendPushToUser` 호출 시 올바른 경로 세팅 필수.
- SW 업데이트 후에는 `skipWaiting` 필요.
