'use client'
// src/app/owner/schedule-draft/page.tsx
// ✅ fix: fmtSlot KST 변환 (Supabase UTC 반환 대응)
// ✅ fix: family_member_name 표시 (가족 신청 대응)
// ✅ add: registration_open 토글 버튼 추가 (회원 신청 오픈)

import { memo, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import ScheduleDraftSearch from '@/components/ScheduleDraftSearch'

interface FamilyMember { id: string; name: string }

interface DraftSlot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: 'draft' | 'conflict_pending'
  has_conflict: boolean
  family_member_name: string | null
  lesson_plan?: {
    id: string
    lesson_type: string
    unit_minutes: number
    amount: number
    family_member_id: string | null
    family_member: FamilyMember | null
    member?: { id: string; name: string; phone: string }
    coach?:  { id: string; name: string }
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

interface Month {
  id: string
  year: number
  month: number
  draft_open?: boolean
  registration_open?: boolean
}

const DAY_KO = ['일','월','화','수','목','금','토']

function fmtSlot(iso: string) {
  const d   = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const mo  = kst.getUTCMonth() + 1
  const day = kst.getUTCDate()
  const dow = DAY_KO[kst.getUTCDay()]
  const hh  = String(kst.getUTCHours()).padStart(2, '0')
  const mm  = String(kst.getUTCMinutes()).padStart(2, '0')
  return {
    date: `${mo}/${day}(${dow})`,
    time: `${hh}:${mm}`,
    full: `${mo}/${day}(${dow}) ${hh}:${mm}`,
  }
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
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ✅ useCallback — memo 된 SlotCard 의 prop reference 안정화
  const toggleSel = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const clearSel = useCallback(() => setSelected(new Set()), [])

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

  // ✅ memo 된 SlotCard 의 prop 안정화
  const handleConfirmOne = useCallback(async (slotId: string) => {
    setSaving(true)
    await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_one', slot_id: slotId }),
    })
    setSaving(false)
    loadAll(monthId)
  }, [monthId])

  const handleDeleteOne = useCallback(async (slotId: string) => {
    if (!confirm('이 초안 슬롯을 삭제할까요?')) return
    setSaving(true)
    await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_one', slot_id: slotId }),
    })
    setSaving(false)
    loadAll(monthId)
  }, [monthId])

  const handleDeleteMany = async () => {
    if (selected.size === 0) return
    if (!confirm(`선택한 초안 ${selected.size}건을 삭제할까요?\n해당 월 레슨비가 자동 재계산됩니다.`)) return
    setSaving(true)
    const res = await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_many', slot_ids: Array.from(selected) }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('❌ ' + (data.error ?? '삭제 실패')); return }
    setMsg(`🗑 ${data.deleted}건 삭제됨`)
    clearSel()
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
    // ✅ FIX: PATCH /api/lesson-applications/[id] 는 body.action 을 읽음 (status 아님)
    const res = await fetch(`/api/lesson-applications/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action === 'approve' ? 'admin_approve' : 'admin_reject',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? '요청 처리에 실패했습니다')
    }
    setSaving(false)
    loadAll(monthId)
  }

  // 초안 미리보기 토글 (기존 회원이 초안 확인 + 수정 요청용)
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

  // 신청 오픈 토글 (초안 확정 후 회원이 직접 수업 신청 가능)
  const handleToggleRegistrationOpen = async () => {
    const selMonth = months.find(m => m.id === monthId)
    const newVal   = !selMonth?.registration_open
    await fetch('/api/months', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_id: monthId, registration_open: newVal }),
    })
    setMonths(prev => prev.map(m => m.id === monthId ? { ...m, registration_open: newVal } : m))
    setMsg(newVal ? '🎾 회원 수업 신청 오픈됨' : '🔒 회원 수업 신청 닫힘')
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

        {/* ── 이름 검색 (독립 컴포넌트로 분리 — 타이핑이 부모 재렌더 트리거하지 않음) ── */}
        <ScheduleDraftSearch
          monthId={monthId}
          selMonth={selMonth}
          saving={saving}
          onSlotChanged={() => loadAll(monthId)}
          fmtSlot={fmtSlot}
        />

        {/* ── STEP 1: 초안 미리보기 토글 (기존 회원 수정 요청용) ── */}
        <div style={{
          background: selMonth?.draft_open ? '#f0fdf4' : '#eff6ff',
          border: `1.5px solid ${selMonth?.draft_open ? '#86efac' : '#bfdbfe'}`,
          borderRadius: '1rem', padding: '1rem', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '2px', fontFamily: 'Noto Sans KR, sans-serif' }}>
              STEP 1 — 초안 미리보기
            </div>
            <div style={{ fontSize: '0.875rem', color: selMonth?.draft_open ? '#15803d' : '#1d4ed8', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth?.draft_open
                ? '✅ 오픈 중 — 회원이 다음달 수업 초안을 확인하고 수정 요청할 수 있습니다'
                : '💡 오픈하면 회원이 초안을 확인하고 수정 요청을 보낼 수 있습니다'
              }
            </div>
          </div>
          <button onClick={handleToggleDraftOpen}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.625rem', border: 'none',
              background: selMonth?.draft_open ? '#fef2f2' : '#16A34A',
              color: selMonth?.draft_open ? '#b91c1c' : 'white',
              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
              fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap',
            }}>
            {selMonth?.draft_open ? '🔒 미리보기 닫기' : '🔓 미리보기 오픈'}
          </button>
        </div>

        {/* ── STEP 2: 신청 오픈 토글 (초안 확정 후 회원 신청 허용) ── */}
        <div style={{
          background: selMonth?.registration_open ? '#f0fdf4' : '#fafafa',
          border: `1.5px solid ${selMonth?.registration_open ? '#4ade80' : '#e5e7eb'}`,
          borderRadius: '1rem', padding: '1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '2px', fontFamily: 'Noto Sans KR, sans-serif' }}>
              STEP 2 — 회원 수업 신청 오픈
            </div>
            <div style={{ fontSize: '0.875rem', color: selMonth?.registration_open ? '#15803d' : '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth?.registration_open
                ? '🎾 신청 오픈 중 — 회원이 수업 신청 페이지에서 직접 신청할 수 있습니다'
                : '🔒 닫힘 — 초안 확정 완료 후 오픈하면 회원이 직접 수업을 신청합니다'
              }
            </div>
          </div>
          <button onClick={handleToggleRegistrationOpen}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.625rem', border: 'none',
              background: selMonth?.registration_open ? '#fef2f2' : '#7c3aed',
              color: selMonth?.registration_open ? '#b91c1c' : 'white',
              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
              fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap',
            }}>
            {selMonth?.registration_open ? '🔒 신청 닫기' : '🎾 신청 오픈'}
          </button>
        </div>

        {/* 회원 수정 요청 배지 + 탭 */}
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
                  const isPending   = ['pending_coach','pending_admin'].includes(r.status)
                  const typeLabel   = r.request_type === 'exclude' ? '🚫 제외 요청' :
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
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif', marginBottom: isPending ? '0.625rem' : 0 }}>
                        {r.requested_at ? fmtSlot(r.requested_at).full : ''} · {r.lesson_type}
                        {r.admin_note && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>메모: {r.admin_note}</span>}
                      </div>
                      {isPending && (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button onClick={() => handleRequestAction(r.id, 'approve')} disabled={saving}
                            style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>✅ 승인</button>
                          <button onClick={() => handleRequestAction(r.id, 'reject')} disabled={saving}
                            style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>❌ 거절</button>
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
              ✅ 확정 가능 {okDrafts.length}건
            </div>
            {conflictDrafts.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c' }}>
                ⚠️ 충돌 {conflictDrafts.length}건
              </div>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={handleConfirmAll} disabled={saving || okDrafts.length === 0}
                style={{ padding: '0.625rem 1.25rem', background: okDrafts.length === 0 ? '#e5e7eb' : '#16A34A', color: okDrafts.length === 0 ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: okDrafts.length === 0 ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중...' : `✅ ${okDrafts.length}건 일괄 확정`}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div style={{
            background: msg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
            border: `1.5px solid ${msg.startsWith('❌') ? '#fecaca' : '#86efac'}`,
            borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1rem',
            fontSize: '0.875rem',
            color: msg.startsWith('❌') ? '#b91c1c' : '#15803d',
            fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif',
          }}>
            {msg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth ? `${selMonth.year}년 ${selMonth.month}월 ` : ''}확정 대기 중인 초안이 없습니다
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {/* 선택 툴바 — 선택 중일 때만 상단 고정 */}
            {selected.size > 0 && (
              <div style={{
                position: 'sticky', top: '4rem', zIndex: 20,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 0.875rem',
                background: '#111827', color: 'white', borderRadius: '0.75rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{selected.size}건 선택</span>
                <button onClick={clearSel}
                  style={{ padding: '0.25rem 0.625rem', borderRadius: '0.5rem', border: '1px solid #374151', background: 'transparent', color: '#d1d5db', fontSize: '0.75rem', cursor: 'pointer' }}>
                  해제
                </button>
                <button onClick={handleDeleteMany} disabled={saving}
                  style={{ marginLeft: 'auto', padding: '0.4rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  🗑 선택 삭제
                </button>
              </div>
            )}

            {/* 전체 선택/해제 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={drafts.length > 0 && selected.size === drafts.length}
                  onChange={e => {
                    if (e.target.checked) setSelected(new Set(drafts.map(d => d.id)))
                    else clearSel()
                  }}
                />
                <span>전체 선택 ({drafts.length})</span>
              </label>
            </div>

            {conflictDrafts.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c' }}>⚠️ 충돌 항목 — 개별 처리 필요</div>
                  <button onClick={handleDeleteAllConflict} disabled={saving}
                    style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
                    🗑 충돌 전체 삭제
                  </button>
                </div>
                {conflictDrafts.map(s => (
                  <SlotCard key={s.id} slot={s} onConfirm={handleConfirmOne} onDelete={handleDeleteOne} saving={saving}
                    selected={selected.has(s.id)} onToggleSel={toggleSel} />
                ))}
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginTop: '0.75rem', marginBottom: '0.25rem' }}>✅ 정상 항목</div>
              </>
            )}
            {okDrafts.map(s => (
              <SlotCard key={s.id} slot={s} onConfirm={handleConfirmOne} onDelete={handleDeleteOne} saving={saving}
                selected={selected.has(s.id)} onToggleSel={toggleSel} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─ SlotCard 스타일 상수 (매 render object 재할당 제거) ───────────────────
const SC_CHECKBOX: React.CSSProperties = { width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }
const SC_FLEX1:    React.CSSProperties = { flex: 1 }
const SC_NAMEROW:  React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px', flexWrap: 'wrap' }
const SC_BADGE_CONFLICT: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '9999px' }
const SC_NAME:     React.CSSProperties = { fontWeight: 700, fontSize: '0.9rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }
const SC_BADGE_FAMILY: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: '9999px' }
const SC_COACH:    React.CSSProperties = { fontSize: '0.75rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }
const SC_META_NORMAL: React.CSSProperties = { fontSize: '0.8rem', color: '#374151', fontWeight: 400, fontFamily: 'Noto Sans KR, sans-serif' }
const SC_META_CONFLICT: React.CSSProperties = { fontSize: '0.8rem', color: '#b91c1c', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }
const SC_BTNROW:   React.CSSProperties = { display: 'flex', gap: '0.375rem', flexShrink: 0 }
const SC_BTN_CONFIRM_NORMAL:  React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.5rem', color: '#15803d', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
const SC_BTN_CONFIRM_CONFLICT:React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '0.5rem', color: '#c2410c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
const SC_BTN_DELETE: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
// ✅ CSS containment — 카드 내부 변경이 페이지 전체 repaint 트리거하지 않도록
const SC_CARD_BASE: React.CSSProperties = {
  borderRadius: '0.875rem', padding: '0.875rem 1rem',
  display: 'flex', alignItems: 'center', gap: '0.875rem',
  contain: 'layout paint', // ← 브라우저가 카드 밖 영향 무시
}

const SlotCard = memo(function SlotCard({ slot, onConfirm, onDelete, saving, selected, onToggleSel }: {
  slot: DraftSlot
  onConfirm: (id: string) => void
  onDelete:  (id: string) => void
  saving: boolean
  selected: boolean
  onToggleSel: (id: string) => void  // ✅ id 받는 형태로 변경 — 부모의 inline arrow 제거 가능
}) {
  const { full } = fmtSlot(slot.scheduled_at)
  const isConflict = slot.has_conflict
  const memberName = slot.lesson_plan?.member?.name ?? '-'
  const coachName  = slot.lesson_plan?.coach?.name  ?? '-'
  const lessonType = slot.lesson_plan?.lesson_type  ?? ''

  const childName   = slot.family_member_name ?? slot.lesson_plan?.family_member?.name ?? null
  const displayName = childName ? `${memberName}(${childName})` : memberName

  return (
    <div style={{
      ...SC_CARD_BASE,
      background: selected ? '#eff6ff' : 'white',
      border: `1.5px solid ${selected ? '#60a5fa' : (isConflict ? '#fecaca' : '#e5e7eb')}`,
      borderLeft: `4px solid ${isConflict ? '#b91c1c' : '#16A34A'}`,
    }}>
      <input type="checkbox" checked={selected} onChange={() => onToggleSel(slot.id)} style={SC_CHECKBOX} />
      <div style={SC_FLEX1}>
        <div style={SC_NAMEROW}>
          {isConflict && <span style={SC_BADGE_CONFLICT}>시간충돌</span>}
          <span style={SC_NAME}>{displayName}</span>
          {childName && <span style={SC_BADGE_FAMILY}>자녀</span>}
          <span style={SC_COACH}>{coachName} 코치</span>
        </div>
        <div style={isConflict ? SC_META_CONFLICT : SC_META_NORMAL}>
          📅 {full} · {lessonType} · {slot.duration_minutes}분
        </div>
      </div>
      <div style={SC_BTNROW}>
        <button onClick={() => onConfirm(slot.id)} disabled={saving}
          style={isConflict ? SC_BTN_CONFIRM_CONFLICT : SC_BTN_CONFIRM_NORMAL}>
          {isConflict ? '강제 확정' : '확정'}
        </button>
        <button onClick={() => onDelete(slot.id)} disabled={saving} style={SC_BTN_DELETE}>
          삭제
        </button>
      </div>
    </div>
  )
})
