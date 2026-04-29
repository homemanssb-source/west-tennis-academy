// src/app/login/page.tsx
// 회원 로그인 (canonical /login URL)
// 기존 /auth/{role} 페이지는 유지되며, 토스 심사용으로는 이 단순 URL 이 노출되기 좋음.
//
// SiteFooter 는 layout.tsx 에서 자동 노출.
import Link from 'next/link'
import LoginForm from '@/components/LoginForm'

const linksWrap: React.CSSProperties = {
  textAlign: 'center',
  padding: '0 1.5rem 1.5rem',
}

const termsRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '0.625rem',
  fontSize: '0.7rem',
  color: '#9ca3af',
  marginBottom: '0.625rem',
}

const termLink: React.CSSProperties = {
  color: '#6b7280',
  textDecoration: 'none',
}

const sep: React.CSSProperties = { color: '#d1d5db' }

const staffWrap: React.CSSProperties = {
  marginTop: '0.75rem',
  paddingTop: '0.875rem',
  borderTop: '1px solid #f3f4f6',
}

const staffLabel: React.CSSProperties = {
  fontSize: '0.62rem', color: '#9ca3af',
  letterSpacing: '3px', marginBottom: '0.5rem',
  fontFamily: 'Oswald, sans-serif',
  textAlign: 'center',
}

const staffRow: React.CSSProperties = {
  display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center',
}

const staffBtn: React.CSSProperties = {
  fontSize: '0.7rem', color: '#6b7280',
  padding: '3px 10px', background: 'white',
  border: '1px solid #e5e7eb', borderRadius: '4px',
  textDecoration: 'none',
  fontFamily: '"Noto Sans KR", sans-serif',
}

export default function LoginPage() {
  return (
    <>
      {/* 회원 PIN 로그인 (기존 LoginForm 재사용) */}
      <LoginForm role="member" label="회원 로그인" color="#7e22ce" emoji="👤" />

      {/* 약관 링크 + 직원 로그인 */}
      <div style={linksWrap}>
        <div style={termsRow}>
          <Link href="/terms"         style={termLink}>이용약관</Link>
          <span style={sep}>|</span>
          <Link href="/terms/refund"  style={termLink}>환불정책</Link>
          <span style={sep}>|</span>
          <Link href="/terms/privacy" style={termLink}>개인정보처리방침</Link>
        </div>

        <div style={staffWrap}>
          <div style={staffLabel}>STAFF LOGIN</div>
          <div style={staffRow}>
            <Link href="/auth/owner"   style={staffBtn}>운영자</Link>
            <Link href="/auth/admin"   style={staffBtn}>관리자</Link>
            <Link href="/auth/coach"   style={staffBtn}>코치</Link>
            <Link href="/auth/payment" style={staffBtn}>결제담당</Link>
          </div>
        </div>
      </div>
    </>
  )
}
