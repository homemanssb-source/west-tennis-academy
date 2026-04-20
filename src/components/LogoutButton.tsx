'use client'

const ROLE_AUTH: Record<string, string> = {
  owner:   '/auth/owner',
  admin:   '/auth/admin',
  coach:   '/auth/coach',
  payment: '/auth/payment',
  member:  '/auth/member',
}

interface Props {
  role?: string
}

export default function LogoutButton({ role }: Props) {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    // ✅ 역할별 로그인 페이지로 이동 (기존: 항상 /auth/owner 고정)
    const path = role ? (ROLE_AUTH[role] ?? '/auth/owner') : '/auth/owner'
    window.location.href = path
  }
  return (
    <button
      onClick={handleLogout}
      style={{ background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.625rem 1.5rem', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}
    >
      로그아웃
    </button>
  )
}