# 03. 역할별 페이지 구조

## Owner (`/owner`)
[src/app/owner](../src/app/owner)

| 경로 | 페이지 목적 |
|------|------|
| `/owner` | 오너 홈 (대시보드 진입) |
| `/owner/dashboard` | 핵심 지표 요약 |
| `/owner/lesson-plan` | 월별 레슨 플랜 목록 |
| `/owner/lesson-plan/[id]` | 레슨 플랜 상세 (슬롯 관리) |
| `/owner/lesson-copy` | 이전 달 플랜 복사 |
| `/owner/planlist` | 플랜 리스트 뷰 |
| `/owner/lesson-applications` | 회원 레슨 신청 목록 (2차 승인) |
| `/owner/applications` | (별도) 신청 관리 |
| `/owner/members` | 회원 목록 |
| `/owner/coaches` | 코치 목록 · 휴무 승인 |
| `/owner/coach-stats` | 코치별 통계 |
| `/owner/schedule` | 최종 스케줄 |
| `/owner/schedule-draft` | 드래프트 승인 (일괄/개별) |
| `/owner/weekly` | 주간 스케줄 |
| `/owner/programs` | 레슨 프로그램(그룹/1:1, 정원) |
| `/owner/payment` | 결제 현황 |
| `/owner/revenue` | 연간 매출 |
| `/owner/reports` | 리포트 |
| `/owner/stats` | 종합 통계 |
| `/owner/unregistered` | 공개 신청 미등록자 처리 |
| `/owner/notifications` | 전체 공지 발송 |
| `/owner/settings` | 전역 설정 · 스태프 관리 |
| `/owner/pin-change` | PIN 변경 |

## Admin (`/admin`)
[src/app/admin](../src/app/admin)

| 경로 | 페이지 목적 |
|------|------|
| `/admin` | 관리자 홈 |
| `/admin/applications` | 레슨 신청 2차 승인 |
| `/admin/members` | 회원 관리 |
| `/admin/members/[id]` | 회원 상세 |
| `/admin/coaches` | 코치 관리 |
| `/admin/lesson-plan` | 레슨 플랜 생성/관리 |
| `/admin/weekly` | 주간 스케줄 |
| `/admin/payment` | 결제 조회 |
| `/admin/settings` | 설정 |
| `/admin/pin-change` | PIN 변경 |

## Coach (`/coach`)
[src/app/coach](../src/app/coach)

| 경로 | 페이지 목적 |
|------|------|
| `/coach` | 코치 홈 |
| `/coach/applications` | 본인 앞 신청 1차 승인/거절 |
| `/coach/schedule` | 본인 스케줄 · 결석/취소 처리 |
| `/coach/blocks` | 휴무 등록 (단일일 / 매주 반복) |
| `/coach/payment` | 본인 레슨 수당 정산 |
| `/coach/pin-change` | PIN 변경 |

## Member (`/member`)
[src/app/member](../src/app/member)

| 경로 | 페이지 목적 |
|------|------|
| `/member` | 회원 홈 |
| `/member/apply` | 레슨 신청 |
| `/member/schedule` | 내 스케줄 |
| `/member/family` | 자녀 계정 관리 |
| `/member/makeup` | 보충수업 예약 |
| `/member/payment` | 내 결제 |
| `/member/pin-change` | PIN 변경 |

## Payment (`/payment`)
[src/app/payment](../src/app/payment)

| 경로 | 페이지 목적 |
|------|------|
| `/payment` | 수납 홈 |
| `/payment/list` | 결제 대기 목록 |
| `/payment/receipts` | 영수증 발행 |
| `/payment/pin-change` | PIN 변경 |

## Public (로그인 불필요)

| 경로 | 목적 |
|------|------|
| `/` | 루트 (로그인 유도) |
| `/apply` | 공개 회원가입 신청 |
| `/auth/{role}` | 역할별 로그인 |
| `/setup` | 최초 오너 계정 생성 |
| `/pay/[planId]` | Toss 결제 진입 |
| `/pay/success` | Toss 결제 완료 처리 |
| `/pay/fail` | 결제 실패 |

## 공용 네비게이션 컴포넌트

- [src/components/MemberBottomNav.tsx](../src/components/MemberBottomNav.tsx) — 회원용 하단 탭
- [src/components/CoachBottomNav.tsx](../src/components/CoachBottomNav.tsx) — 코치용 하단 탭
- [src/components/notifications/](../src/components/notifications) — 상단 알림 벨 (모든 역할 공용)
