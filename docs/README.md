# WTA 코드 연결고리 문서

WTA(테니스 레슨 관리 앱)의 코드 구조와 연결 관계를 정리한 문서입니다.

## 기술 스택
- Next.js 16 (App Router)
- React 19
- Supabase (Postgres + Auth + RPC)
- Web Push (VAPID)
- Upstash Redis (rate limit)
- Toss Payments
- Vercel (호스팅 + Cron)

## 문서 인덱스

| # | 문서 | 내용 |
|---|------|------|
| 1 | [01-architecture.md](01-architecture.md) | 전체 아키텍처 개요 |
| 2 | [02-auth-session.md](02-auth-session.md) | 인증 / 세션 / 미들웨어 |
| 3 | [03-roles-routing.md](03-roles-routing.md) | 4개 역할별 페이지 구조 |
| 4 | [04-api-page-map.md](04-api-page-map.md) | API ↔ 페이지 연결 맵 |
| 5 | [05-database.md](05-database.md) | Supabase 테이블 목록 |
| 6 | [06-push-notifications.md](06-push-notifications.md) | 푸시 알림 구조 |
| 7 | [07-cron-jobs.md](07-cron-jobs.md) | 크론 잡 목록 |
| 8 | [08-cross-role-flows.md](08-cross-role-flows.md) | 역할 간 E2E 플로우 |
| 9 | [09-audit.md](09-audit.md) | 구조 감사 (일관성 · 문제 · 보안) |
| 10 | [10-simulation.md](10-simulation.md) | 14개 시나리오 시뮬레이션 · 버그 리포트 |
| 11 | [11-rpc-analysis.md](11-rpc-analysis.md) | `approve_lesson_application` RPC 감사 + 수정안 |

## 역할(Role) 개요

| 역할 | 홈 | 핵심 권한 |
|------|-----|----------|
| **owner** | `/owner` | 전체 관리자 (admin/coach/payment 영역 접근 가능) |
| **admin** | `/admin` | 회원·레슨·승인 관리 |
| **coach** | `/coach` | 본인 스케줄 / 신청 승인 / 휴무 |
| **payment** | `/payment` | 결제 수납 전담 |
| **member** | `/member` | 레슨 신청 / 결제 / 가족 관리 |

## 핵심 도메인 플로우

```
회원 신청 → 코치 1차 승인 → 관리자 2차 승인 → lesson_plans + lesson_slots 생성
  → 회원 Toss 결제 → 레슨 진행 → 자동 완료(cron) → 통계 집계
```
