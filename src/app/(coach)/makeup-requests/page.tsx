'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface MakeupRequest {
  id: string
  member: { name: string; display_name: string }
  original_slot: { scheduled_at: string }
  requested_at: string
  reason: string
  status: string
  expires_at: string
  created_at: string
}

export default function MakeupRequestsPage() {
  const [requests, setRequests] = useState<MakeupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)

  useEffect(() => { loadRequests() }, [])

  async function loadRequests() {
    setLoading(true)
    try {
      const res = await fetch('/api/makeup/list')
      const data = await res.json()
      setRequests(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleRespond(requestId: string, action: 'approve' | 'reject', reason?: string) {
    setResponding(requestId)
    try {
      const res = await fetch('/api/makeup/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, responseReason: reason }),
      })
      if (res.ok) {
        await loadRequests()
        setRejectId(null)
        setRejectReason('')
      }
    } finally {
      setResponding(null)
    }
  }

  const pending  = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  return (
    <div className="flex flex-col">
      <TopBar title="보강 요청" subtitle={`대기 ${pending.length}건`} showBack />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {loading ? (
          <div className="text-center py-12 text-sm text-[#5A8A5A]">로딩 중...</div>
        ) : pending.length === 0 ? (
          <div className="wta-card text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-sm text-[#5A8A5A]">대기 중인 보강 요청이 없습니다</div>
          </div>
        ) : (
          <>
            <div className="wta-section-label"><span className="opacity-40">//</span> 대기 중 ({pending.length})</div>
            {pending.map(req => {
              const memberName = (req.member as any)?.display_name ?? (req.member as any)?.name ?? '알 수 없음'
              const originalAt = req.original_slot ? format(new Date((req.original_slot as any).scheduled_at), 'M/d (EEE)', { locale: ko }) : '-'
              const requestedAt = format(new Date(req.requested_at), 'M/d (EEE) HH:mm', { locale: ko })
              const expiresAt = format(new Date(req.expires_at), 'M/d HH:mm', { locale: ko })
              const isExpiringSoon = new Date(req.expires_at).getTime() - Date.now() < 1000 * 60 * 60 * 3

              return (
                <div key={req.id} className={`wta-card space-y-3 ${isExpiringSoon ? 'border-[#C85A1E]/30' : ''}`}>
                  {isExpiringSoon && (
                    <div className="text-xs text-[#C85A1E] font-medium">⏰ 만료 임박 — {expiresAt}까지</div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-[#0F2010]">{memberName}</div>
                      <div className="text-xs text-[#5A8A5A] mt-1">취소 레슨: {originalAt}</div>
                      <div className="text-xs text-[#5A8A5A]">희망 일시: <span className="text-[#1B4D2E] font-medium">{requestedAt}</span></div>
                    </div>
                    <span className="badge-gold">대기</span>
                  </div>

                  {req.reason && (
                    <div className="bg-[#F5FAF5] rounded-xl px-3 py-2 text-xs text-[#2A5A2A]">
                      💬 {req.reason}
                    </div>
                  )}

                  {rejectId === req.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="wta-input resize-none text-sm"
                        rows={2}
                        placeholder="거절 사유를 입력해 주세요"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespond(req.id, 'reject', rejectReason)}
                          disabled={responding === req.id}
                          className="flex-1 py-2.5 rounded-xl bg-[#C85A1E] text-white text-sm font-medium disabled:opacity-50"
                        >
                          거절 확정
                        </button>
                        <button
                          onClick={() => { setRejectId(null); setRejectReason('') }}
                          className="flex-1 py-2.5 rounded-xl bg-[#EAF3EA] text-[#2A5A2A] text-sm font-medium"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(req.id, 'approve')}
                        disabled={responding === req.id}
                        className="flex-1 py-3 rounded-xl bg-[#1B4D2E] text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {responding === req.id ? '처리 중...' : '✅ 승인'}
                      </button>
                      <button
                        onClick={() => setRejectId(req.id)}
                        className="flex-1 py-3 rounded-xl bg-[#EAF3EA] text-[#C85A1E] border border-[#C85A1E]/20 text-sm font-semibold"
                      >
                        ❌ 거절
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* 처리 완료 */}
        {resolved.length > 0 && (
          <>
            <div className="wta-section-label mt-2"><span className="opacity-40">//</span> 처리 완료</div>
            {resolved.slice(0, 5).map(req => {
              const memberName = (req.member as any)?.display_name ?? (req.member as any)?.name ?? '알 수 없음'
              const requestedAt = format(new Date(req.requested_at), 'M/d HH:mm', { locale: ko })
              return (
                <div key={req.id} className="wta-card flex items-center justify-between opacity-60">
                  <div>
                    <div className="text-sm font-medium text-[#0F2010]">{memberName}</div>
                    <div className="text-xs text-[#5A8A5A]">{requestedAt}</div>
                  </div>
                  <span className={req.status === 'approved' ? 'badge-green' : req.status === 'rejected' ? 'badge-red' : 'badge-gray'}>
                    {req.status === 'approved' ? '승인' : req.status === 'rejected' ? '거절' : '만료'}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
