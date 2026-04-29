import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'

export default async function RootPage() {
  const session = await getSession()
  if (session) {
    const roleHome: Record<string, string> = {
      owner: '/owner', admin: '/admin', coach: '/coach',
      payment: '/payment', member: '/member',
    }
    redirect(roleHome[session.role] ?? '/auth/owner')
  }
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
  if ((count ?? 0) === 0) redirect('/setup')

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafaf8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 2rem 3rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
        background: '#16A34A',
      }} />
      <div style={{
        position: 'absolute', top: '-40px', right: '-60px',
        width: '220px', height: '220px', borderRadius: '50%',
        border: '50px solid rgba(22,163,74,0.06)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-80px', left: '-40px',
        width: '180px', height: '180px', borderRadius: '50%',
        border: '40px solid rgba(22,163,74,0.04)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '5px',
          color: '#16A34A', marginBottom: '1rem',
          fontFamily: 'Oswald, sans-serif',
        }}>
          TENNIS ACADEMY
        </div>

        <div style={{
          borderLeft: '5px solid #16A34A',
          paddingLeft: '1rem',
          marginBottom: '2.25rem',
        }}>
          <div style={{
            fontFamily: '"Black Han Sans", "Noto Sans KR", sans-serif',
            fontSize: '2.25rem',
            color: '#0a0a0a',
            lineHeight: 1.1,
            fontWeight: 900,
          }}>
            서부테니스<br />아카데미
          </div>
          <div style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '0.75rem',
            color: '#9ca3af',
            letterSpacing: '4px',
            fontWeight: 400,
            marginTop: '6px',
          }}>
            WEST TENNIS ACADEMY
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          marginBottom: '1.25rem',
        }}>
          <span style={{ fontSize: '1.75rem' }}>🎾</span>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#16A34A', flexShrink: 0,
          }} />
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        </div>

        {/* ── 학원 간단 소개 ── */}
        <div style={{
          marginBottom: '1.75rem',
          padding: '0.875rem 1rem',
          background: 'white',
          border: '1px solid #f3f4f6',
          borderRadius: '0.875rem',
          fontFamily: '"Noto Sans KR", sans-serif',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
            제주 서부 테니스 아카데미
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.6 }}>
            회원 전용 레슨 관리 서비스
            <br />
            제주특별자치도 제주시 한경면 청수리
          </div>
          <div style={{
            marginTop: '0.625rem',
            paddingTop: '0.625rem',
            borderTop: '1px dashed #e5e7eb',
            fontSize: '0.7rem', color: '#9ca3af',
          }}>
            ⓘ 본 서비스는 학원 회원 전용 시스템입니다.
          </div>
        </div>

        <div style={{
          background: '#16A34A',
          borderRadius: '1rem',
          padding: '2px',
          marginBottom: '0.625rem',
          boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
        }}>
          <Link href="/auth/member" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.125rem 1.25rem',
              borderRadius: '0.875rem',
            }}>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.75rem', fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                flexShrink: 0, width: '32px',
              }}>01</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 700, fontSize: '0.925rem', color: 'white',
                  fontFamily: '"Noto Sans KR", sans-serif',
                }}>회원 로그인</div>
                <div style={{
                  fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)',
                  marginTop: '1px', fontFamily: '"Noto Sans KR", sans-serif',
                }}>기존 회원</div>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.25rem' }}>›</span>
            </div>
          </Link>
        </div>

        <Link href="/apply" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1.125rem 1.25rem',
            borderLeft: '3px solid #e5e7eb',
            marginBottom: '0.25rem',
          }}>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1.75rem', fontWeight: 700,
              color: '#e5e7eb', flexShrink: 0, width: '32px',
            }}>02</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 700, fontSize: '0.925rem', color: '#111827',
                fontFamily: '"Noto Sans KR", sans-serif',
              }}>회원 가입 신청</div>
              <div style={{
                fontSize: '0.7rem', color: '#9ca3af',
                marginTop: '1px', fontFamily: '"Noto Sans KR", sans-serif',
              }}>신규 회원 등록</div>
            </div>
            <span style={{ color: '#d1d5db', fontSize: '1.25rem' }}>›</span>
          </div>
        </Link>

        <div style={{
          marginTop: '2rem', paddingTop: '1.25rem',
          borderTop: '1px solid #f3f4f6',
        }}>
          <div style={{
            fontSize: '0.65rem', color: '#9ca3af',
            letterSpacing: '3px', marginBottom: '0.625rem',
            fontFamily: 'Oswald, sans-serif',
          }}>STAFF LOGIN</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {([
              { label: '운영자',   href: '/auth/owner' },
              { label: '관리자',   href: '/auth/admin' },
              { label: '코치',     href: '/auth/coach' },
              { label: '결제담당', href: '/auth/payment' },
            ] as const).map(s => (
              <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  fontSize: '0.7rem', color: '#6b7280',
                  padding: '3px 10px', background: 'white',
                  border: '1px solid #e5e7eb', borderRadius: '4px',
                  fontFamily: '"Noto Sans KR", sans-serif',
                }}>{s.label}</div>
              </Link>
            ))}
          </div>

          {/* ── 약관 링크 (토스 심사 대비) ── */}
          <div style={{
            marginTop: '1.25rem',
            paddingTop: '0.875rem',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'center',
            gap: '0.625rem',
            fontSize: '0.7rem',
            color: '#9ca3af',
            fontFamily: '"Noto Sans KR", sans-serif',
          }}>
            <Link href="/terms"         style={{ color: '#6b7280', textDecoration: 'none' }}>이용약관</Link>
            <span style={{ color: '#d1d5db' }}>|</span>
            <Link href="/terms/refund"  style={{ color: '#6b7280', textDecoration: 'none' }}>환불정책</Link>
            <span style={{ color: '#d1d5db' }}>|</span>
            <Link href="/terms/privacy" style={{ color: '#6b7280', textDecoration: 'none' }}>개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </div>
  )
}