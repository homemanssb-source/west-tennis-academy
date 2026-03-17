'use client'
// src/app/pay/fail/page.tsx
// 토스페이먼츠 결제 실패 후 리다이렉트되는 페이지

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PayFailPage() {
  const searchParams = useSearchParams()
  const message      = searchParams.get('message') ?? '결제가 취소되었습니다'
  const planId       = searchParams.get('planId')

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#1d4ed8' }}>WTA</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif' }}>웨스트 테니스 아카데미</div>
        </div>

        <div style={{ background: 'white', borderRadius: '1.25rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

          {/* 실패 헤더 */}
          <div style={{ background: 'linear-gradient(135deg, #b91c1c, #dc2626)', padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>❌</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>
              결제 실패
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif', lineHeight: 1.6 }}>
                {message}
              </div>
            </div>

            {/* 다시 시도 버튼 */}
            {planId && (
              <Link href={`/pay/${planId}`} style={{ textDecoration: 'none' }}>
                <button style={{
                  width: '100%', padding: '1rem', borderRadius: '0.875rem', border: 'none',
                  background: '#1d4ed8', color: 'white',
                  fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                  fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '0.75rem',
                }}>
                  다시 결제하기
                </button>
              </Link>
            )}

            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif' }}>
              문의: 웨스트 테니스 아카데미
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
