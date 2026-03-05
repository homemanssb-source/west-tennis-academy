'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Plan {
  id: string
  payment_status: string
  price: number
  total_lessons: number
  used_lessons: number
  member: { id: string; name: string; display_name: string; coach: { name: string } }
}

const METHODS = ['현금', '계좌이체', '카드', '기타']
const STATUS_FILTER = ['전체', '미납', '부분납', '대기중', '완납']

export default function PaymentMembersPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [filter, setFilter] = useState('전체')
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('계좌이체')
  const [payMemo, setPayMemo] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    setLoading(true)
    const res = await fetch('/api/payment/plans')
    const data = await res.json()
    setPlans(data.plans ?? [])
    setLoading(false)
  }

  const filtered = plans.filter(p => {
    if (filter === '전체') return true
    if (filter === '미납')  return p.payment_status === 'unpaid'
    if (filter === '부분납') return p.payment_status === 'partial'
    if (filter === '대기중') return p.payment_status === 'pending'
    if (filter === '완납')  return p.payment_status === 'paid'
    return true
  })

  async function handleConfirmPayment() {
    if (!selectedPlan || !payAmount) { setError('금액을 입력해 주세요.'); return }
    setProcessing(true); setError('')
    try {
      const res = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          memberId: selectedPlan.member.id,
          amount: parseInt(payAmount),
          method: payMethod,
          memo: payMemo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSelectedPlan(null)
      setPayAmount('')
      setPayMemo('')
      await loadPlans()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const payBadge = (status: string) =>
    status === 'paid'    ? { label: '완납',   cls: 'badge-green' } :
    status === 'unpaid'  ? { label: '미납',   cls: 'badge-red'   } :
    status === 'partial' ? { label: '부분납', cls: 'badge-gold'  } :
                           { label: '대기중', cls: 'badge-blue'  }

  return (
    <div className="flex flex-col">
      <TopBar title="회원 납부 관리" subtitle={`${filtered.length}명`} showBack />

      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTER.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === f
                  ? 'bg-[#1B4D2E] text-white border-[#1B4D2E]'
                  : 'bg-white text-[#2A5A2A] border-[#1B4D2E]/15'
              }`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-[#5A8A5A]">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="wta-card text-center py-12 text-sm text-[#5A8A5A]">해당하는 회원이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(plan => {
              const badge = payBadge(plan.payment_status)
              const member = plan.member as any
              const coach = member?.coach as any
              const isSelected = selectedPlan?.id === plan.id

              return (
                <div key={plan.id} className="wta-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        plan.payment_status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {(member?.display_name ?? member?.name ?? '?').charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#0F2010]">
                          {member?.display_name ?? member?.name}
                        </div>
                        <div className="text-xs text-[#5A8A5A]">
                          {coach?.name} 코치 · {plan.used_lessons}/{plan.total_lessons}회
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-[#0F2010]">
                        {(plan.price ?? 0).toLocaleString()}원
                      </div>
                      <span className={badge.cls}>{badge.label}</span>
                    </div>
                  </div>

                  {plan.payment_status !== 'paid' && (
                    <button
                      onClick={() => setSelectedPlan(isSelected ? null : plan)}
                      className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-[#EAF3EA] text-[#1B4D2E] border border-[#1B4D2E]/20'
                          : 'bg-[#1B4D2E] text-white'
                      }`}>
                      {isSelected ? '▲ 닫기' : '💳 납부 처리'}
                    </button>
                  )}

                  {isSelected && (
                    <div className="bg-[#F5FAF5] rounded-xl p-3 space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-1.5">납부 금액</label>
                        <input
                          type="number"
                          className="wta-input font-mono"
                          placeholder={`${(plan.price ?? 0).toLocaleString()}`}
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-1.5">납부 방법</label>
                        <div className="flex gap-2 flex-wrap">
                          {METHODS.map(m => (
                            <button key={m} onClick={() => setPayMethod(m)}
                              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                                payMethod === m
                                  ? 'bg-[#1B4D2E] text-white border-[#1B4D2E]'
                                  : 'bg-white text-[#2A5A2A] border-[#1B4D2E]/15'
                              }`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-1.5">메모</label>
                        <input className="wta-input" placeholder="메모 (선택)" value={payMemo}
                          onChange={e => setPayMemo(e.target.value)} />
                      </div>
                      {error && <div className="text-xs text-red-600">{error}</div>}
                      <button onClick={handleConfirmPayment} disabled={processing}
                        className="w-full py-3 rounded-xl bg-[#1B4D2E] text-white text-sm font-semibold disabled:opacity-50">
                        {processing ? '처리 중...' : '✅ 납부 확인'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
