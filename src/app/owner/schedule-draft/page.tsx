'use client'
// src/app/owner/schedule-draft/page.tsx
// ✅ fix: family_member_name 표시 (가족 신청 시 부모(자녀) 형태)

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DraftSlot {
  id: string
  lesson_plan_id: string
  scheduled_at: string
  duration_minutes: number
  status: 'draft' | 'conflict_pending'
  has_conflict: boolean
  family_member_name: string | null  // ✅ 추가
  lesson_plan?: {
    id: string
    lesson_type: string
    unit_minutes: number
    amount: number
    member?: { id: string; name: string; phone: string }
    coach?: { id: string; name: string }
  }
}

interface MemberRequest {
  id: string
  member_name: string
  request_type: 'change' | 'exclude' | 'add'
  requested_at: string
  status: string
  draft_slot_id: string | null
  coach_note: string | null
  admin_note: string | null
  lesson_type: string
}

interface Month { id: string; year: number; month: number; draft_open?: boolean }

const DAY_KO = ['일','월','화','수','목','금','토']

function fmtSlot(iso: string) {
  const [datePart, timePart] = iso.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const day = DAY_KO[new Date(y, mo - 1, d).getDay()]
  const [hh, mm] = timePart.split('+')[0].split(':')
  return { date: `${mo}/${d}(${day})`, time: `${hh}:${mm}`, full: `${mo}/${d}(${day}) ${hh}:${mm}` }
}

export default function ScheduleDraftPage() {
  const [months,   setMonths]   = useState<Month[]>([])
  const [monthId,  setMonthId]  = useState('')
  const [drafts,   setDrafts]   = useState<DraftSlot[]>([])
  const [requests, setRequests] = useState<MemberRequest[]>([])
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')
  const [reqTab,   setReqTab]   = useState(false)

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then((d: Month[]) => {
      const list = Array.isArray(d) ? d.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month) : []
      setMonths(list)
      const now = new Date()
      const nm  = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2
      const ny  = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()
      const nextRec = list.find(m => m.year === ny && m.month === nm)
      if (nextRec) setMonthId(nextRec.id)
      else if (list.length > 0) setMonthId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    loadAll(monthId)
  }, [monthId])

  const loadAll = async (mid: string) => {
    setLoading(true)
    setMsg('')
    const [draftRes, reqRes] = await Promise.all([
      fetch(`/api/schedule-draft?month_id=${mid}`),
      fetch(`/api/member-requests?month_id=${mid}`),
    ])
    const draftData = await draftRes.json()
    const reqData   = await reqRes.json()
    setDrafts(Array.isArray(draftData) ? draftData : [])
    setRequests(Array.isArray(reqData) ? reqData : [])
    setLoading(false)
  }

  const handleConfirmAll = async () => {
    if (!monthId) return
    const conflicts = drafts.filter(d => d.has_conflict)
    if (conflicts.length > 0) {
      const ok = confirm(`충돌 ${conflicts.length}건은 제외하고 나머지 ${drafts.length - conflicts.length}건만 확정할까요?`)
      if (!ok) return
    }
    setSaving(true)
    const res  = await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_all', month_id: monthId, skip_conflicts: true }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('❌ ' + data.error); return }
    setMsg(`✅ ${data.confirmed}건 확정됨`)
    loadAll(monthId)
  }

  const handleConfirmOne = async (slotId: string) => {
    setSaving(true)
    await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_one', slot_id: slotId }),
    })
    setSaving(false)
    loadAll(monthId)
  }

  const handleDeleteOne = async (slotId: string) => {
    if (!confirm('이 초안 슬롯을 삭제할까요?')) return
    setSaving(true)
    await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_one', slot_id: slotId }),
    })
    setSaving(false)
    loadAll(monthId)
  }

  const handleDeleteAllConflict = async () => {
    if (!monthId) return
    const cnt = conflictDrafts.length
    if (!confirm(`충돌 항목 ${cnt}건을 모두 삭제할까요?`)) return
    setSaving(true)
    const res = await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_all_conflict', month_id: monthId }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('❌ ' + data.error); return }
    setMsg(`🗑 충돌 ${data.deleted}건 삭제됨`)
    loadAll(monthId)
  }

  const handleRequestAction = async (reqId: string, action: 'approve' | 'reject') => {
    setSaving(true)
    await fetch(`/api/lesson-applications/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: action === 'approve' ? 'approved' : 'rejected',
      }),
    })
    setSaving(false)
    loadAll(monthId)
  }

  const handleToggleDraftOpen = async () => {
    const selMonth = months.find(m => m.id === monthId)
    const newVal   = !selMonth?.draft_open
    await fetch('/api/months', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_id: monthId, draft_open: newVal }),
    })
    setMonths(prev => prev.map(m => m.id === monthId ? { ...m, draft_open: newVal } : m))
    setMsg(newVal ? '✅ 회원 미리보기 오픈됨' : '🔒 회원 미리보기 닫힘')
  }

  const okDrafts       = drafts.filter(d => !d.has_conflict)
  const conflictDrafts = drafts.filter(d =>  d.has_conflict)
  const selMonth       = months.find(m => m.id === monthId)
  const pendingReqs    = requests.filter(r => ['pending_coach','pending_admin'].includes(r.status))

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>
            수업 초안 확정
          </h1>
          <select value={monthId} onChange={e => setMonthId(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', color: '#374151' }}>
            {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* draft_open 토글 */}
        <div style={{ background: selMonth?.draft_open ? '#f0fdf4' : '#eff6ff', border: `1.5px solid ${selMonth?.draft_open ? '#86efac' : '#bfdbfe'}`, borderRadius: '1rem', padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, fontSize: '0.875rem', color: selMonth?.draft_open ? '#15803d' : '#1d4ed8', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {selMonth?.draft_open
              ? '✅ 회원 미리보기 오픈 중 — 회원이 다음달 수업 초안을 확인하고 수정 요청할 수 있습니다'
              : '💡 초안 생성 후 회원에게 미리보기를 오픈하면 수정 요청을 받을 수 있습니다'
            }
          </div>
          <button onClick={handleToggleDraftOpen}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: 'none', background: selMonth?.draft_open ? '#fef2f2' : '#16A34A', color: selMonth?.draft_open ? '#b91c1c' : 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
            {selMonth?.draft_open ? '🔒 미리보기 닫기' : '🔓 미리보기 오픈'}
          </button>
        </div>

        {/* 회원 수정 요청 탭 */}
        {requests.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={() => setReqTab(v => !v)}
              style={{ width: '100%', padding: '0.75rem 1rem', background: pendingReqs.length > 0 ? '#fef9c3' : 'white', border: `1.5px solid ${pendingReqs.length > 0 ? '#fde68a' : '#e5e7eb'}`, borderRadius: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              <span style={{ fontSize: '1rem' }}>📝</span>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', flex: 1, textAlign: 'left' }}>회원 수정 요청</span>
              {pendingReqs.length > 0 && (
                <span style={{ background: '#f59e0b', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                  검토 필요 {pendingReqs.length}건
                </span>
              )}
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{reqTab ? '▲' : '▼'}</span>
            </button>

            {reqTab && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {requests.map(r => {
                  const isPending = ['pending_coach','pending_admin'].includes(r.status)
                  const typeLabel = r.request_type === 'exclude' ? '🚫 제외 요청' :
                                    r.request_type === 'change'  ? '🔄 변경 요청' : '➕ 추가 요청'
                  const statusLabel = r.status === 'approved' ? '✅ 승인' :
                                      r.status === 'rejected' ? '❌ 거절' : '⏳ 검토 중'
                  return (
                    <div key={r.id} style={{ background: 'white', border: `1.5px solid ${isPending ? '#fde68a' : '#e5e7eb'}`, borderRadius: '0.875rem', padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>{r.member_name}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'Noto Sans KR, sans-serif' }}>{typeLabel}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, color: isPending ? '#854d0e' : r.status === 'approved' ? '#15803d' : '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif', marginBottom: isPending ? '0.625rem' : '0' }}>
                        {r.requested_at ? fmtSlot(r.requested_at).full : ''} · {r.lesson_type}
                        {r.admin_note && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>— {r.admin_note}</span>}
                      </div>
                      {isPending && (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button onClick={() => handleRequestAction(r.id, 'approve')} disabled={saving}
                            style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                            ✅ 반영
                          </button>
                          <button onClick={() => handleRequestAction(r.id, 'reject')} disabled={saving}
                            style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                            ❌ 거절
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 요약 + 일괄 확정 버튼 */}
        {!loading && drafts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
              ✅ 확정 대기 {okDrafts.length}건
            </div>
            {conflictDrafts.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c' }}>
                ⚠️ 충돌 {conflictDrafts.length}건
              </div>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={handleConfirmAll} disabled={saving || okDrafts.length === 0}
                style={{ padding: '0.625rem 1.25rem', background: okDrafts.length === 0 ? '#e5e7eb' : '#16A34A', color: okDrafts.length === 0 ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: okDrafts.length === 0 ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중...' : `📋 ${okDrafts.length}건 일괄 확정`}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div style={{ background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${msg.startsWith('✅') ? '#86efac' : '#fecaca'}`, borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1rem', fontSize: '0.875rem', color: msg.startsWith('✅') ? '#15803d' : '#b91c1c', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' }}>
            {msg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <p style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth ? `${selMonth.year}년 ${selMonth.month}월 ` : ''}확정 대기 중인 초안이 없습니다
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {conflictDrafts.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c' }}>⚠️ 충돌 항목 — 수동 처리 필요</div>
                  <button onClick={handleDeleteAllConflict} disabled={saving}
                    style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
                    🗑 충돌 전체 삭제
                  </button>
                </div>
                {conflictDrafts.map(s => (
                  <SlotCard key={s.id} slot={s} onConfirm={handleConfirmOne} onDelete={handleDeleteOne} saving={saving} />
                ))}
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginTop: '0.75rem', marginBottom: '0.25rem' }}>✅ 정상 항목</div>
              </>
            )}
            {okDrafts.map(s => (
              <SlotCard key={s.id} slot={s} onConfirm={handleConfirmOne} onDelete={handleDeleteOne} saving={saving} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SlotCard({ slot, onConfirm, onDelete, saving }: {
  slot: DraftSlot
  onConfirm: (id: string) => void
  onDelete:  (id: string) => void
  saving: boolean
}) {
  const { full } = fmtSlot(slot.scheduled_at)
  const isConflict  = slot.has_conflict
  const memberName  = slot.lesson_plan?.member?.name ?? '-'
  const coachName   = slot.lesson_plan?.coach?.name  ?? '-'
  const lessonType  = slot.lesson_plan?.lesson_type  ?? ''

  // ✅ 자녀 이름 있으면 "부모(자녀)" 형태로 표시
  const displayName = slot.family_member_name
    ? `${memberName}(${slot.family_member_name})`
    : memberName

  return (
    <div style={{ background: 'white', border: `1.5px solid ${isConflict ? '#fecaca' : '#e5e7eb'}`, borderLeft: `4px solid ${isConflict ? '#b91c1c' : '#16A34A'}`, borderRadius: '0.875rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
          {isConflict && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '9999px' }}>휴무충돌</span>
          )}
          {/* ✅ 부모(자녀) 표시 */}
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {displayName}
          </span>
          {slot.family_member_name && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: '9999px' }}>
              자녀
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>{coachName} 코치</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: isConflict ? '#b91c1c' : '#374151', fontWeight: isConflict ? 700 : 400, fontFamily: 'Noto Sans KR, sans-serif' }}>
          📅 {full} · {lessonType} · {slot.duration_minutes}분
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        <button onClick={() => onConfirm(slot.id)} disabled={saving}
          style={{ padding: '0.375rem 0.75rem', background: isConflict ? '#fff7ed' : '#f0fdf4', border: `1.5px solid ${isConflict ? '#fed7aa' : '#86efac'}`, borderRadius: '0.5rem', color: isConflict ? '#c2410c' : '#15803d', fontWeight: 700, fontSize: '0.75rem', cursor: saving ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {isConflict ? '강제 확정' : '확정'}
        </button>
        <button onClick={() => onDelete(slot.id)} disabled={saving}
          style={{ padding: '0.375rem 0.75rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: saving ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          삭제
        </button>
      </div>
    </div>
  )
}