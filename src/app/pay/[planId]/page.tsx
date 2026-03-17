'use client'
// src/app/pay/[planId]/page.tsx
// 카톡 링크로 접근하는 결제 페이지 (로그인 불필요)
// URL: /pay/[planId]?orderId=wta_xxx
//
// 흐름:
// 1. GET /api/payment/toss?plan_id=xxx  → 플랜 정보 + 기존 orderId 조회
// 2. orderId 없으면 → POST /api/payment/toss/order 로 새로 생성
// 3. 토스 결제창 호출

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Script from 'next/script'

interface PlanInfo {
  plan_id:     string
  amount:      number
  order_id:    string
  member_name: string
  month:       string
  lesson:      string
}

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      requestPayment: (method: string, opts: object) => Promise<void>
    }
  }
}

export default function PayCheckoutPage() {
  const { planId }    = useParams<{ planId: string }>()
  const searchParams  = useSearchParams()
  const urlOrderId    = searchParams.get('orderId')  // 운영자가 생성한 orderId

  const [info,     setInfo]     = useState<PlanInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [paying,   setPaying]   = useState(false)
  const [error,    setError]    = useState('')
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    // 1. 공개 API로 플랜 정보 조회
    fetch(`/api/payment/toss?plan_id=${planId}`)
      .then(r => r.json())
      .then(async d => {
        if (d.error) { setError(d.error); setLoading(false); return }

        // 2. orderId 확정: URL > DB 기존 pending > 새로 생성
        let orderId = urlOrderId ?? d.order_id

        if (!orderId) {
          // 새 orderId 생성 (공개 order 생성 API)
          const orderRes  = await fetch('/api/payment/toss/order', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ plan_id: planId }),
          })
          const orderData = await orderRes.json()
          if (orderData.error) { setError(orderData.error); setLoading(false); return }
          orderId = orderData.order_id
        }

        setInfo({
          plan_id:     d.plan_id,
          amount:      d.amount,
          order_id:    orderId,
          member_name: d.member_name,
          month:       d.month,
          lesson:      d.lesson,
        })
        setLoading(false)
      })
      .catch(() => { setError('정보를 불러오지 못했습니다'); setLoading(false) })
  }, [planId, urlOrderId])

  const handlePay = async () => {
    if (!info || !sdkReady) return
    setPaying(true)
    setError('')

    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!
      const toss      = window.TossPayments(clientKey)
      const baseUrl   = 'https://west-tennis-academy-1.vercel.app'

      await toss.requestPayment('카드', {
        amount:       info.amount,
        orderId:      info.order_id,
        orderName:    `WTA ${info.month} 레슨비`,
        customerName: info.member_name,
        successUrl:   `${baseUrl}/pay/success?planId=${planId}`,
        failUrl:      `${baseUrl}/pay/fail?planId=${planId}`,
      })
    } catch (e: any) {
      if (e?.code !== 'USER_CANCEL') {
        setError(e?.message ?? '결제 중 오류가 발생했습니다')
      }
      setPaying(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v1/payment"
        onLoad={() => setSdkReady(true)}
      />

      <div style={{ background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* 로고 */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#1d4ed8' }}>WTA</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif' }}>웨스트 테니스 아카데미</div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif' }}>
              불러오는 중...
            </div>
          ) : error ? (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
              <div style={{ color: '#b91c1c', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>{error}</div>
            </div>
          ) : info ? (
            <div style={{ background: 'white', borderRadius: '1.25rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

              {/* 헤더 */}
              <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', fontFamily: 'Noto Sans KR, sans-serif' }}>레슨비 청구서</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: 'white' }}>
                  {fmt(info.amount)}원
                </div>
              </div>

              {/* 내용 */}
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: '회원명',    value: info.member_name },
                    { label: '수업 월',   value: info.month },
                    { label: '수업 내용', value: info.lesson },
                    { label: '결제 금액', value: `${fmt(info.amount)}원` },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '0.82rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>{row.label}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={paying || !sdkReady}
                  style={{
                    width: '100%', padding: '1rem', borderRadius: '0.875rem', border: 'none',
                    background: paying || !sdkReady ? '#e5e7eb' : '#1d4ed8',
                    color:      paying || !sdkReady ? '#9ca3af' : 'white',
                    fontWeight: 700, fontSize: '1rem',
                    cursor:     paying || !sdkReady ? 'not-allowed' : 'pointer',
                    fontFamily: 'Noto Sans KR, sans-serif',
                  }}>
                  {paying ? '결제 진행 중...' : !sdkReady ? '준비 중...' : `💳 ${fmt(info.amount)}원 카드 결제`}
                </button>

                <div style={{ marginTop: '0.875rem', fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif', lineHeight: 1.6 }}>
                  카드 · 카카오페이 · 네이버페이 등 결제 가능<br/>
                  결제 정보는 토스페이먼츠에서 안전하게 처리됩니다
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
