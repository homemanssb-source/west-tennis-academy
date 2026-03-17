'use client'
// src/app/pay/success/page.tsx
// 토스페이먼츠 결제 성공 후 리다이렉트되는 페이지
// URL: /pay/success?paymentKey=xxx&orderId=xxx&amount=xxx&planId=xxx

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface SuccessInfo {
  member_name: string
  amount:      number
  month:       string
  lesson:      string
  method:      string
  approved_at: string
}

export default function PaySuccessPage() {
  const searchParams = useSearchParams()
  const paymentKey   = searchParams.get('paymentKey')
  const orderId      = searchParams.get('orderId')
  const amount       = Number(searchParams.get('amount'))
  const planId       = searchParams.get('planId')

  const [info,    setInfo]    = useState<SuccessInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보가 올바르지 않습니다')
      setLoading(false)
      return
    }

    // 서버에 승인 요청
    fetch('/api/payment/toss/confirm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setInfo(d)
        setLoading(false)
      })
      .catch(() => { setError('승인 처리 중 오류가 발생했습니다'); setLoading(false) })
  }, [paymentKey, orderId, amount])

  const fmt    = (n: number) => n.toLocaleString('ko-KR')
  const fmtDt  = (dt: string) => {
    if (!dt) return ''
    const d = new Date(dt)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#1d4ed8' }}>WTA</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif' }}>웨스트 테니스 아카데미</div>
        </div>

        {loading ? (
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '3rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>결제 승인 처리 중...</div>
          </div>
        ) : error ? (
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</div>
            <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif' }}>결제 처리 실패</div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>{error}</div>
          </div>
        ) : info ? (
          <div style={{ background: 'white', borderRadius: '1.25rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

            {/* 성공 헤더 */}
            <div style={{ background: 'linear-gradient(135deg, #15803d, #16A34A)', padding: '2rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                결제 완료
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: 'white' }}>
                {fmt(info.amount)}원
              </div>
            </div>

            {/* 영수증 내용 */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                결제 영수증
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
                {[
                  { label: '회원명',    value: info.member_name },
                  { label: '수업 월',   value: info.month },
                  { label: '수업 내용', value: info.lesson },
                  { label: '결제 수단', value: info.method },
                  { label: '결제 금액', value: `${fmt(info.amount)}원` },
                  { label: '결제 일시', value: fmtDt(info.approved_at) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>{row.label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: row.label === '결제 금액' ? '#15803d' : '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.82rem', color: '#15803d', fontFamily: 'Noto Sans KR, sans-serif', lineHeight: 1.6 }}>
                  결제가 정상적으로 처리되었습니다.<br/>
                  감사합니다 🎾
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  )
}
