'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Member {
  id: string
  name: string
  display_name: string
  lesson_plan_id?: string
}

export default function ExtraLessonPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [extraDate, setExtraDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [extraCount, setExtraCount] = useState(1)
  const [extraAmount, setExtraAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    loadMembers()
    loadHistory()
  }, [])

  async function loadMembers() {
    const res = await fetch('/api/coach/members')
    const data = await res.json()
    setMembers(data.members ?? [])
  }

  async function loadHistory() {
    const res = await fetch('/api/coach/extra-lessons')
    const data = await res.json()
    setHistory(data.extras ?? [])
  }

  async function handleSubmit() {
    if (!selectedMember) { setError('회원을 선택해 주세요.'); return }
    if (!extraDate) { setError('날짜를 선택해 주세요.'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/coach/extra-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          extraDate,
          extraCount,
          extraAmount: extraAmount ? parseInt(extraAmount) : null,
          memo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
      loadHistory()
    } catch (e: any) {
      setError(e.message ?? '요청에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">📤</div>
        <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-3">요청 완료!</h2>
        <p className="text-sm text-[#5A8A5A] leading-relaxed mb-8">
          결제 담당자에게 알림이 전송되었습니다.<br />
          승인 후 자동으로 레슨이 추가됩니다.
        </p>
        <button onClick={() => setSubmitted(false)} className="wta-btn-primary max-w-xs">
          추가 요청하기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <TopBar title="수업 추가" subtitle="결제담당 승인 필요" showBack />

      <div className="px-4 pt-4 pb-24 space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          💡 추가 레슨은 결제 담당자 승인 후 확정됩니다. 승인 전까지는 <strong>미확정</strong> 상태입니다.
        </div>

        {/* 회원 선택 */}
        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 회원 선택</div>
          <div className="space-y-2">
            {members.length === 0 ? (
              <div className="text-sm text-[#5A8A5A] text-center py-4">담당 회원이 없습니다.</div>
            ) : (
              members.map(m => {
                const isSelected = selectedMember?.id === m.id
                return (
                  <button key={m.id} onClick={() => setSelectedMember(isSelected ? null : m)}
                    className={`w-full text-left p-4 rounded-xl border-[1.5px] transition-all ${
                      isSelected ? 'bg-[#EAF3EA] border-[#1B4D2E]' : 'bg-white border-[#1B4D2E]/10'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-[#0F2010]">{m.display_name ?? m.name}</span>
                        {m.display_name && m.display_name !== m.name && (
                          <span className="text-xs text-[#5A8A5A] ml-2">({m.name})</span>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center ${
                        isSelected ? 'bg-[#1B4D2E] border-[#1B4D2E] text-white text-[11px]' : 'bg-[#EAF3EA] border-[#1B4D2E]/20'
                      }`}>
                        {isSelected && '✓'}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* 상세 입력 */}
        <div>
          <div className="wta-section-label"><span className="opacity-40">//</span> 추가 상세</div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">날짜</label>
              <input type="date" className="wta-input" value={extraDate}
                onChange={e => setExtraDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">추가 횟수</label>
                <select className="wta-input" value={extraCount} onChange={e => setExtraCount(Number(e.target.value))}>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}회</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">추가 금액 (원)</label>
                <input type="number" className="wta-input" placeholder="0"
                  value={extraAmount} onChange={e => setExtraAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">메모</label>
              <textarea className="wta-input resize-none" rows={2}
                placeholder="추가 사유, 특이사항 등"
                value={memo} onChange={e => setMemo(e.target.value)} />
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <button onClick={handleSubmit} disabled={loading || !selectedMember}
          className="wta-btn-primary disabled:opacity-40">
          {loading ? '전송 중...' : '📤 결제담당에게 요청'}
        </button>

        {/* 최근 요청 내역 */}
        {history.length > 0 && (
          <>
            <div className="wta-section-label mt-2"><span className="opacity-40">//</span> 최근 요청</div>
            <div className="space-y-2">
              {history.slice(0, 5).map((h: any) => (
                <div key={h.id} className="wta-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#0F2010]">
                      {h.member?.display_name ?? h.member?.name} · {h.extra_count}회
                    </div>
                    <div className="text-xs text-[#5A8A5A] font-mono mt-0.5">
                      {format(new Date(h.extra_date), 'M/d', { locale: ko })}
                      {h.extra_amount ? ` · ${h.extra_amount.toLocaleString()}원` : ''}
                    </div>
                  </div>
                  <span className={
                    h.status === 'confirmed' ? 'badge-green' :
                    h.status === 'rejected'  ? 'badge-red'   : 'badge-gold'
                  }>
                    {h.status === 'confirmed' ? '승인' : h.status === 'rejected' ? '거절' : '대기'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
