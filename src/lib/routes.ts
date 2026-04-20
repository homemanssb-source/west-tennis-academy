/**
 * 푸시 알림 · 리다이렉트 등에 사용하는 페이지 경로 상수.
 * 폴더 구조를 바꿀 때 이 파일만 수정하면 알림 링크가 자동으로 맞춰진다.
 */
export const ROUTES = {
  member: {
    home:     '/member',
    schedule: '/member/schedule',
    payment:  '/member/payment',
    apply:    '/member/apply',
    family:   '/member/family',
    makeup:   '/member/makeup',
  },
  coach: {
    home:         '/coach',
    applications: '/coach/applications',
    schedule:     '/coach/schedule',
    blocks:       '/coach/blocks',
    payment:      '/coach/payment',
  },
  admin: {
    home:         '/admin',
    applications: '/admin/applications',
    members:      '/admin/members',
    coaches:      '/admin/coaches',
    weekly:       '/admin/weekly',
  },
  owner: {
    home:                '/owner',
    lessonApplications:  '/owner/lesson-applications',
    members:             '/owner/members',
    coaches:             '/owner/coaches',
    scheduleDraft:       '/owner/schedule-draft',
    unregistered:        '/owner/unregistered',
  },
  payment: {
    home: '/payment',
    list: '/payment/list',
  },
  auth: (role: string) => `/auth/${role}`,
} as const
