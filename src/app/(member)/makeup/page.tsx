'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { LessonSlot } from '@/types'

const TIMES = ['07:00','08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']

export default function MakeupPage() {
  const supabase = createClient()
  const [cancelledSlots, setCancelledSlots] = useState<LessonSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<LessonSlot | null>(null)
  const [requestDate, setRequestDate] = useState('')
  const [requestTime, setRequestTime] = useState('')
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState<{ ok: boolean; checks: string[]; code?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('lesson_slots')
        .select('*')
        .eq('member_id', user.id)
        .eq('status', 'cancelled')
        .order('scheduled_at', { ascending: false })
        .limit(10)
      setCancelledSlots(data ?? [])
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedSlot || !requestDate || !requestTime) { setValidation(null); return }
    checkConditions()
  }, [selectedSlot, requestDate, requestTime])

  async function checkConditions() {
    if (!selectedSlot) return
    const checks: string[] = []
    let ok = true

    const { data: plan } = await supabase
      .from('lesson_plans')
      .select('payment_status')
      .eq('id', selectedSlot.lesson_plan_id)
      .single()

    const isPaid = plan?.payment_status === 'paid'
    if (isPaid) checks.push('✅ 결제 완납 상태')
    else { checks.push('⚠️ 미납 상태 (코치 재량 필요)'); ok = false }

    const scheduledAt = new Date(selectedSlot.scheduled_at)
    const cancelledAt = selectedSlot.cancelled_at ? new Date(selectedSlot.cancelled_at) : null
    const isSameDay = cancelledAt && cancelledAt.toDateString() === scheduledAt.toDateString()

    if (!isSameDay) checks.push('✅ D-1 이전 취소')
    else { checks.push('⚠️ 당일 취소 (코치 재량 필요)') }

    if (isSameDay && !isPaid) {
      setValidation({ ok: false, checks: [...checks, '❌ 당일 취소 + 미납 — 보강 불가'], code: 'BLOCKED' })
      return
    }

    setValidation({ ok, checks })
  }

  async function handleSubmit() {
    if (!selectedSlot || !requestDate || !requestTime) {
      setError('취소된 레슨과 희망 일정을 선택해 주세요.')
      return
    }
    if (validation?.code === 'BLOCKED') {
      setError('당일 취소 + 미납 상태에서는 보강 신청이 불가합니다.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/makeup/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalSlotId: selectedSlot.id, requestedAt: `${requestDate}T${requestTime}:00`, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">🔔</div>
        <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-3">보강 신청 완료!</h2>
        <p className="text-sm text-[#5A8A5A] leading-relaxed mb-8">
          담당 코치에게 SMS + 앱 푸시로 전송되었습니다.<br />
          <strong className="text-forest">24시간 이내</strong> 응답이 없으면 자동 만료됩니다.
        </p>
        <a href="/home" className="wta-btn-primary inline-block max-w-xs w-full text-center py-4">홈으로 돌아가기</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <TopBar title="보강 신청" showBack />
      <div className="px-4 pt-4 pb-24 space-y-5">
        <div className="bg-clay/8 border border-clay/20 rounded-xl p-3 text-xs text-[#5A2A0A] leading-relaxed">
          ⚠️ <strong>핵심 규칙:</strong> 코치 승인 없이는 보강 확정이 불가합니다. 미응답 24시간 후 자동 만료됩니다.
        </div>

        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 취소된 레슨 선택</div>
          {cancelledSlots.length === 0 ? (
            <div className="wta-card text-center text-sm text-[#5A8A5A] py-6">취소된 레슨이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {cancelledSlots.map(slot => {
                const isSelected = selectedSlot?.id === slot.id
                return (
                  <button key={slot.id} onClick={() => setSelectedSlot(isSelected ? null : slot)}
                    className={`w-full text-left p-4 rounded-xl border-[1.5px] transition-all ${
                      isSelected ? 'bg-lime/8 border-lime' : 'bg-white border-forest/10 hover:border-forest/25'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm font-medium text-forest">
                          {format(new Date(slot.scheduled_at), 'yyyy.MM.dd (EEE)', { locale: ko })}
                        </div>
                        <div className="text-xs text-[#5A8A5A] mt-1">
                          {format(new Date(slot.scheduled_at), 'HH:mm')} · {slot.cancel_reason ?? '사유 없음'}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center ${
                        isSelected ? 'bg-lime border-lime text-white text-[11px]' : 'bg-[#EAF3EA] border-forest/20'
                      }`}>
                        {isSelected && '✓'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 보강 희망 일정</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">희망 날짜</label>
              <input type="date" className="wta-input" value={requestDate}
                min={format(new Date(), 'yyyy-MM-dd')} onChange={e => setRequestDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">희망 시간</label>
              <select className="wta-input" value={requestTime} onChange={e => setRequestTime(e.target.value)}>
                <option value="">시간 선택</option>
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">신청 사유</label>
            <textarea className="wta-input resize-none" rows={2}
              placeholder="보강 신청 사유를 입력해 주세요"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>

        {validation && (
          <div className="wta-card">
            <div className="text-xs font-semibold text-[#0F2010] mb-2">🔍 신청 조건 확인</div>
            <div className="space-y-1.5">
              {validation.checks.map((c, i) => <div key={i} className="text-xs text-[#2A5A2A]">{c}</div>)}
            </div>
            <div className={`mt-3 pt-2.5 border-t border-forest/8 text-xs font-medium ${
              validation.ok ? 'text-green-700' : validation.code === 'BLOCKED' ? 'text-red-700' : 'text-amber-700'
            }`}>
              {validation.ok ? '✅ 코치 승인 요청 가능' : validation.code === 'BLOCKED' ? '❌ 보강 신청 불가' : '⚠️ 코치 재량 처리로 진행됩니다'}
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || !selectedSlot || !requestDate || !requestTime || validation?.code === 'BLOCKED'}
          className="wta-btn-primary disabled:opacity-40"
        >
          {loading ? '전송 중...' : '📤 보강 신청 (코치에게 전송)'}
        </button>
      </div>
    </div>
  )
}
