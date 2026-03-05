'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function ExtraApprovePage() {
  const [extras, setExtras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { loadExtras() }, [])

  async function loadExtras() {
    setLoading(true)
    const res = await fetch('/api/payment/extra-approve')
    const data = await res.json()
    setExtras(data.extras ?? [])
    setLoading(false)
  }

  async function handleAction(id: string, action: 'confirm' | 'reject', reason?: string) {
    setProcessing(id)
    try {
      const res = await fetch('/api/payment/extra-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraId: id, action, reason }),
      })
      if (res.ok) { await loadExtras(); setRejectId(null); setRejectReason('') }
    } finally {
      setProcessing(null)
    }
  }

  const pending  = extras.filter(e => e.status === 'pending')
  const resolved = extras.filter(e => e.status !== 'pending')

  return (
    <div className="flex flex-col">
      <TopBar title="수업 추가 승인" subtitle={`대기 ${pending.length}건`} showBack />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {loading ? (
          <div className="text-center py-12 text-sm text-[#5A8A5A]">로딩 중...</div>
        ) : pending.length === 0 ? (
          <div className="wta-card text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-sm text-[#5A8A5A]">대기 중인 수업 추가 요청이 없습니다</div>
          </div>
        ) : (
          <>
            <div className="wta-section-label"><span className="opacity-40">//</span> 대기 중 ({pending.length})</div>
            {pending.map(extra => {
              const memberName = extra.member?.display_name ?? extra.member?.name ?? '알 수 없음'
              const coachName = extra.coach?.name ?? '알 수 없음'
              return (
                <div key={extra.id} className="wta-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-[#0F2010] text-sm">{memberName}</div>
                      <div className="text-xs text-[#5A8A5A] mt-1">
                        {coachName} 코치 요청 ·{' '}
                        <span className="font-mono">{format(new Date(extra.extra_date), 'M/d (EEE)', { locale: ko })}</span>
                      </div>
                      <div className="text-xs text-[#5A8A5A]">
                        추가 {extra.extra_count}회
                        {extra.extra_amount ? ` · ${extra.extra_amount.toLocaleString()}원` : ''}
                      </div>
                    </div>
                    <span className="badge-gold">대기</span>
                  </div>

                  {extra.memo && (
                    <div className="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-800">
                      💬 {extra.memo}
                    </div>
                  )}

                  {extra.extra_amount && (
                    <div className="bg-[#F5FAF5] rounded-xl px-3 py-2 text-xs text-[#2A5A2A] flex justify-between">
                      <span>추가 금액</span>
                      <span className="font-mono font-semibold">{extra.extra_amount.toLocaleString()}원</span>
                    </div>
                  )}

                  {rejectId === extra.id ? (
                    <div className="space-y-2">
                      <textarea className="wta-input resize-none text-sm" rows={2}
                        placeholder="거절 사유"
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => handleAction(extra.id, 'reject', rejectReason)}
                          disabled={processing === extra.id}
                          className="flex-1 py-2.5 rounded-xl bg-[#C85A1E] text-white text-sm font-medium disabled:opacity-50">
                          거절 확정
                        </button>
                        <button onClick={() => { setRejectId(null); setRejectReason('') }}
                          className="flex-1 py-2.5 rounded-xl bg-[#EAF3EA] text-[#2A5A2A] text-sm font-medium">
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(extra.id, 'confirm')}
                        disabled={processing === extra.id}
                        className="flex-1 py-3 rounded-xl bg-[#1B4D2E] text-white text-sm font-semibold disabled:opacity-50">
                        {processing === extra.id ? '처리 중...' : '✅ 승인'}
                      </button>
                      <button onClick={() => setRejectId(extra.id)}
                        className="flex-1 py-3 rounded-xl bg-[#EAF3EA] text-[#C85A1E] border border-[#C85A1E]/20 text-sm font-semibold">
                        ❌ 거절
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {resolved.length > 0 && (
          <>
            <div className="wta-section-label mt-2"><span className="opacity-40">//</span> 처리 완료</div>
            {resolved.slice(0, 5).map(extra => (
              <div key={extra.id} className="wta-card flex items-center justify-between opacity-60">
                <div>
                  <div className="text-sm font-medium text-[#0F2010]">
                    {extra.member?.display_name ?? extra.member?.name} · {extra.extra_count}회
                  </div>
                  <div className="text-xs text-[#5A8A5A] font-mono">
                    {format(new Date(extra.extra_date), 'M/d', { locale: ko })}
                  </div>
                </div>
                <span className={extra.status === 'confirmed' ? 'badge-green' : 'badge-red'}>
                  {extra.status === 'confirmed' ? '승인' : '거절'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
