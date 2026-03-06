'use client'
export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/owner'
  }
  return (
    <button
      onClick={handleLogout}
      style={{ background: 'transparent', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.625rem 1.5rem', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}
    >
      ·Î±×¾Æ¿ô
    </button>
  )
}
