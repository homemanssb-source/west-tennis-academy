'use client'
// src/app/member/payment/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MemberBottomNav from '@/components/MemberBottomNav'
import Script from 'next/script'

interface Plan {
  id: string
  payment_status: string
  amount: number
  lesson_type: string
  total_count: number
  completed_count: number
  unit_minutes: number
  coach: { name: string }
  month: { year: number; month: number }
}

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      requestPayment: (method: string, opts: object) => Promise<void>
    }
  }
}

export default function MemberPaymentPage() {
  const router = useRouter()
  const [plans,    setPlans]    = useState<Plan[]>([])
  const [loading,  setLoading]  = useState(true)
  const [paying,   setPaying]   = useState<string | null>(null) // 결제 중인 plan_id
  const [sdkReady, setSdkReady] = useState(false)

  const load = () => {
    fetch('/api/my-payment').then(r => r.json()).then(d => {
      setPlans(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  const handlePay = async (plan: Plan) => {
    if (!sdkReady) { alert('결제 모듈 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return }
    if (plan.amount <= 0) { alert('결제 금액이 설정되지 않았습니다. 운영자에게 문의해주세요.'); return }

    setPaying(plan.id)

    try {
      // 1. orderId 생성 (공개 API)
      const orderRes  = await fetch('/api/payment/toss/order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan_id: plan.id }),
      })
      const orderData = await orderRes.json()
      if (orderData.error) { alert(orderData.error); setPaying(null); return }

      // 2. 토스 결제창 호출
      const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!
      const toss      = window.TossPayments(clientKey)
      const baseUrl   = 'https://west-tennis-academy-1.vercel.app'

      await toss.requestPayment('카드', {
        amount:       plan.amount,
        orderId:      orderData.order_id,
        orderName:    `WTA ${plan.month?.year}년 ${plan.month?.month}월 레슨비`,
        successUrl:   `${baseUrl}/pay/success?planId=${plan.id}`,
        failUrl:      `${baseUrl}/pay/fail?planId=${plan.id}`,
      })
    } catch (e: any) {
      if (e?.code !== 'USER_CANCEL') {
        alert(e?.message ?? '결제 중 오류가 발생했습니다')
      }
    } finally {
      setPaying(null)
      load() // 결제 후 상태 새로고침
    }
  }

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v1/payment"
        onLoad={() => setSdkReady(true)}
      />

      <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>납부 현황</div>
        </div>

        <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💰</div>
              <p style={{ fontSize: '0.875rem' }}>납부 내역이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {plans.map(p => (
                <div key={p.id} style={{
                  background: 'white',
                  border: `1.5px solid ${p.payment_status === 'paid' ? '#86efac' : '#fecaca'}`,
                  borderRadius: '1rem', padding: '1.25rem'
                }}>
                  {/* 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                        {p.month?.year}년 {p.month?.month}월
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                        {p.lesson_type} · {p.coach?.name} 코치
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '9999px',
                      background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                      color:      p.payment_status === 'paid' ? '#15803d' : '#b91c1c'
                    }}>
                      {p.payment_status === 'paid' ? '완납' : '미납'}
                    </span>
                  </div>

                  {/* 수강료 / 수업 진행 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: p.payment_status === 'unpaid' ? '0.875rem' : '0' }}>
                    <div style={{ background: '#f9fafb', borderRadius: '0.625rem', padding: '0.625rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '2px' }}>수강료</div>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
                        {fmt(p.amount)}원
                      </div>
                    </div>
                    <div style={{ background: '#f9fafb', borderRadius: '0.625rem', padding: '0.625rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '2px' }}>수업 진행</div>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
                        {p.completed_count}/{p.total_count}회
                      </div>
                    </div>
                  </div>

                  {/* ✅ 미납 플랜만 결제 버튼 표시 */}
                  {p.payment_status === 'unpaid' && (
                    <button
                      onClick={() => handlePay(p)}
                      disabled={paying === p.id || !sdkReady || p.amount <= 0}
                      style={{
                        width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
                        background: paying === p.id || !sdkReady || p.amount <= 0 ? '#e5e7eb' : '#1d4ed8',
                        color:      paying === p.id || !sdkReady || p.amount <= 0 ? '#9ca3af' : 'white',
                        fontWeight: 700, fontSize: '0.9rem',
                        cursor:     paying === p.id || !sdkReady || p.amount <= 0 ? 'not-allowed' : 'pointer',
                        fontFamily: 'Noto Sans KR, sans-serif',
                      }}>
                      {paying === p.id
                        ? '결제 진행 중...'
                        : p.amount <= 0
                        ? '금액 미설정 (운영자 문의)'
                        : `💳 ${fmt(p.amount)}원 카드 결제`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <MemberBottomNav />
      </div>
    </>
  )
}