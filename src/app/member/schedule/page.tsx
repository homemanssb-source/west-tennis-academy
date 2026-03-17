'use client'
// src/app/member/schedule/page.tsx
// ✅ [FIX] handleRequest / handleCancelRequest try-catch + requesting 해제 보장
// ✅ [NEW] change 요청 시 희망 날짜 입력 UI 추가
// ✅ [FIX] 요청 후 에러 메시지 표시

import { useEffect, useState } from 'react'
import MemberBottomNav from '@/components/MemberBottomNav'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  memo: string | null
  lesson_plan: {
    lesson_type: string
    coach: { name: string }
    month: { year: number; month: number }
  }
}

interface DraftSlot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  has_conflict: boolean
  lesson_type: string
  coach_name: string
  existing_request: {
    id: string
    request_type: string
    status: string
  } | null
}

interface Month { id: string; year: number; month: number; draft_open: boolean }

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80',  color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa',  color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171',  color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc',  color: '#7e22ce', label: '보강' },
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function fmtDt(dt: string) {
  const d = new Date(dt)
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_KO[d.getDay()]}) ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

export default function MemberSchedulePage() {
  const [tab,     setTab]     = useState<'current' | 'next'>('current')
  const [slots,   setSlots]   = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'scheduled' | 'completed'>('all')

  const [months,       setMonths]       = useState<Month[]>([])
  const [nextMonth,    setNextMonth]    = useState<Month | null>(null)
  const [draftSlots,   setDraftSlots]   = useState<DraftSlot[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [requesting,   setRequesting]   = useState<string | null>(null)
  const [draftMsg,     setDraftMsg]     = useState('')

  // ✅ [NEW] change 요청 시 희망 날짜 입력 상태
  const [changeModalSlot, setChangeModalSlot] = useState<DraftSlot | null>(null)
  const [hopeDate,        setHopeDate]        = useState('')

  useEffect(() => {
    fetch('/api/my-schedule')
      .then(r => r.json())
      .then(d => { setSlots(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))

    fetch('/api/months')
      .then(r => r.json())
      .then(d => {
        const list: Month[] = Array.isArray(d) ? d : []
        setMonths(list)
        const now = new Date()
        const ny  = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()
        const nm  = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2
        const nm_ = list.find(m => m.year === ny && m.month === nm)
        if (nm_) setNextMonth(nm_)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tab !== 'next' || !nextMonth) return
    loadDraft(nextMonth.id)
  }, [tab, nextMonth])

  const loadDraft = async (monthId: string) => {
    setDraftLoading(true)
    setDraftMsg('')
    try {
      const res = await fetch(`/api/member-draft?month_id=${monthId}`)
      const d   = await res.json()
      setDraftSlots(Array.isArray(d.slots) ? d.slots : [])
    } catch {
      setDraftMsg('❌ 목록을 불러오지 못했습니다')
    } finally {
      setDraftLoading(false)
    }
  }

  // ✅ [FIX] try-catch + finally로 requesting 해제 보장
  const handleRequest = async (type: 'exclude' | 'change', slot: DraftSlot, hope?: string) => {
    if (!nextMonth) return

    if (type === 'change' && !hope) {
      // change 요청이면 희망 날짜 모달 열기
      setChangeModalSlot(slot)
      setHopeDate('')
      return
    }

    const msgs: Record<string, string> = {
      exclude: `${fmtDt(slot.scheduled_at)} 수업을 제외 요청할까요?`,
      change:  `${fmtDt(slot.scheduled_at)} 수업 날짜 변경을 요청할까요?\n${hope ? `희망 날짜: ${hope}` : ''}`,
    }
    if (!confirm(msgs[type])) return

    setRequesting(slot.id)
    setDraftMsg('')
    try {
      const res = await fetch('/api/member-draft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          month_id:      nextMonth.id,
          request_type:  type,
          draft_slot_id: slot.id,
          requested_at:  slot.scheduled_at,
          hope_date:     hope ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDraftMsg('❌ ' + (data.error ?? '요청 실패'))
        return
      }
      setDraftMsg('✅ 요청이 접수되었습니다. 운영자 확인 후 반영됩니다.')
      setChangeModalSlot(null)
      loadDraft(nextMonth.id)
    } catch {
      setDraftMsg('❌ 네트워크 오류가 발생했습니다')
    } finally {
      setRequesting(null)
    }
  }

  // ✅ [FIX] try-catch + finally
  const handleCancelRequest = async (requestId: string, slotId: string) => {
    if (!confirm('요청을 취소할까요?')) return
    setRequesting(slotId)
    setDraftMsg('')
    try {
      const res = await fetch(`/api/member-draft?request_id=${requestId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setDraftMsg('❌ ' + (data.error ?? '취소 실패'))
        return
      }
      setDraftMsg('')
      if (nextMonth) loadDraft(nextMonth.id)
    } catch {
      setDraftMsg('❌ 네트워크 오류가 발생했습니다')
    } finally {
      setRequesting(null)
    }
  }

  const filtered   = filter === 'all' ? slots : slots.filter(s => s.status === filter)
  const hasDraftOpen = nextMonth?.draft_open === true

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>
          내 스케줄
        </div>

        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setTab('current')}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer', background: tab === 'current' ? '#7e22ce' : '#f3f4f6', color: tab === 'current' ? 'white' : '#6b7280' }}>
            이번달 수업
          </button>
          <button onClick={() => setTab('next')}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer', background: tab === 'next' ? '#1d4ed8' : '#f3f4f6', color: tab === 'next' ? 'white' : '#6b7280', position: 'relative' }}>
            다음달 미리보기
            {hasDraftOpen && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }} />
            )}
          </button>
        </div>

        {tab === 'current' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['all', 'scheduled', 'completed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: filter === f ? '#7e22ce' : '#f3f4f6', color: filter === f ? 'white' : '#6b7280' }}>
                {f === 'all' ? '전체' : f === 'scheduled' ? '예정' : '완료'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>

        {/* 이번달 수업 */}
        {tab === 'current' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
              <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>수업 내역이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {filtered.map(s => {
                const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
                return (
                  <div key={s.id} style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: st.color, fontSize: '0.95rem' }}>{fmtDt(s.scheduled_at)}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#374151', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {s.lesson_plan?.lesson_type ?? '수업'}{s.lesson_plan?.coach?.name ? ` · ${s.lesson_plan.coach.name} 코치` : ''} · {s.duration_minutes}분
                    </div>
                    {s.memo && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>📝 {s.memo}</div>}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* 다음달 미리보기 */}
        {tab === 'next' && (
          <>
            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#1d4ed8', fontFamily: 'Noto Sans KR, sans-serif' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                📅 {nextMonth ? `${nextMonth.year}년 ${nextMonth.month}월` : '다음달'} 수업 미리보기
              </div>
              {hasDraftOpen
                ? '운영자가 생성한 수업 일정 초안입니다. 변경이 필요하면 아래 버튼으로 요청해주세요.'
                : '아직 다음달 수업 일정이 준비되지 않았습니다.'
              }
            </div>

            {draftMsg && (
              <div style={{ background: draftMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${draftMsg.startsWith('✅') ? '#86efac' : '#fecaca'}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 600, color: draftMsg.startsWith('✅') ? '#15803d' : '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {draftMsg}
              </div>
            )}

            {!hasDraftOpen ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⏳</div>
                <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>다음달 일정이 준비되면 여기서 확인하실 수 있어요</p>
              </div>
            ) : draftLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
            ) : draftSlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
                <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>다음달 예정된 수업이 없습니다</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {draftSlots.map(s => {
                  const req         = s.existing_request
                  const isConflict  = s.has_conflict
                  const isPending   = req && ['pending_coach', 'pending_admin'].includes(req.status)
                  const isRequesting = requesting === s.id

                  return (
                    <div key={s.id} style={{ background: 'white', border: `1.5px solid ${isConflict ? '#fecaca' : '#e5e7eb'}`, borderLeft: `4px solid ${isConflict ? '#b91c1c' : '#a78bfa'}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: isConflict ? '#b91c1c' : '#374151', fontSize: '0.95rem' }}>
                          {fmtDt(s.scheduled_at)}
                        </span>
                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                          {isConflict && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '9999px', fontFamily: 'Noto Sans KR, sans-serif' }}>충돌</span>
                          )}
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#f3f0ff', color: '#7c3aed', padding: '1px 6px', borderRadius: '9999px', fontFamily: 'Noto Sans KR, sans-serif' }}>초안</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.625rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {s.lesson_type} · {s.coach_name} 코치 · {s.duration_minutes}분
                      </div>

                      {/* 요청 상태 표시 */}
                      {req && (
                        <div style={{ padding: '0.375rem 0.75rem', background: req.status === 'rejected' ? '#fef2f2' : '#fef9c3', borderRadius: '0.5rem', fontSize: '0.75rem', marginBottom: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', color: req.status === 'rejected' ? '#b91c1c' : '#854d0e', fontWeight: 600 }}>
                          {req.request_type === 'exclude' ? '🚫 제외 요청' : '🔄 변경 요청'}
                          {' · '}
                          {req.status === 'pending_coach' || req.status === 'pending_admin' ? '검토 중' : req.status === 'approved' ? '✅ 승인' : '❌ 거절'}
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      {!req && (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleRequest('exclude', s)}
                            disabled={!!requesting}
                            style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: requesting ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: requesting ? 0.6 : 1 }}>
                            {isRequesting ? '처리 중...' : '🚫 제외 요청'}
                          </button>
                          <button
                            onClick={() => handleRequest('change', s)}
                            disabled={!!requesting}
                            style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: requesting ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: requesting ? 0.6 : 1 }}>
                            {isRequesting ? '처리 중...' : '🔄 변경 요청'}
                          </button>
                        </div>
                      )}

                      {/* 요청 취소 */}
                      {isPending && (
                        <button
                          onClick={() => handleCancelRequest(req!.id, s.id)}
                          disabled={!!requesting}
                          style={{ width: '100%', marginTop: '0.375rem', padding: '0.375rem', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: requesting ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: requesting ? 0.6 : 1 }}>
                          {isRequesting ? '처리 중...' : '요청 취소'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <MemberBottomNav />

      {/* ✅ [NEW] 날짜 변경 희망 날짜 입력 모달 */}
      {changeModalSlot && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setChangeModalSlot(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem 1.25rem 2.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>날짜 변경 요청</h2>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '1rem' }}>
              현재: {fmtDt(changeModalSlot.scheduled_at)}<br />
              희망 날짜를 입력해주세요. 운영자가 확인 후 연락드립니다.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px', fontFamily: 'Noto Sans KR, sans-serif' }}>희망 날짜 (선택)</label>
              <input
                type="date"
                value={hopeDate}
                onChange={e => setHopeDate(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #bfdbfe', borderRadius: '0.625rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' as const }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setChangeModalSlot(null)}
                style={{ flex: 1, padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', color: '#6b7280' }}>
                취소
              </button>
              <button
                onClick={() => handleRequest('change', changeModalSlot, hopeDate || undefined)}
                disabled={!!requesting}
                style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', color: 'white', background: requesting ? '#d1d5db' : '#1d4ed8', cursor: requesting ? 'not-allowed' : 'pointer' }}>
                {requesting ? '처리 중...' : '변경 요청 보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}