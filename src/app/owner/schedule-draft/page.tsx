// ============================================================
// 저장 위치: app/owner/schedule-draft/page.tsx  (신규 파일)
// ============================================================
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DraftSlot {
  id: string
  lesson_plan_id: string
  scheduled_at: string
  duration_minutes: number
  status: 'draft' | 'conflict_pending'
  has_conflict: boolean
  member_name: string
  coach_name: string
  lesson_type: string
}
interface Month { id: string; year: number; month: number }

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
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then((d: Month[]) => {
      const list = Array.isArray(d) ? d.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month) : []
      setMonths(list)
      // 현재달+1 (다음달) 자동 선택
      const now = new Date()
      const nm = now.getMonth() + 2 > 12 ? 1  : now.getMonth() + 2
      const ny = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()
      const nextRec = list.find(m => m.year === ny && m.month === nm)
      if (nextRec) setMonthId(nextRec.id)
      else if (list.length > 0) setMonthId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    loadDrafts(monthId)
  }, [monthId])

  const loadDrafts = async (mid: string) => {
    setLoading(true)
    setMsg('')
    const res  = await fetch(`/api/schedule-draft?month_id=${mid}`)
    const data = await res.json()
    setDrafts(Array.isArray(data) ? data : [])
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
    setMsg(`✅ ${data.confirmed}건 확정됨 (충돌 ${data.skipped_conflict}건 보류)`)
    loadDrafts(monthId)
  }

  const handleConfirmOne = async (slotId: string) => {
    setSaving(true)
    await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_one', slot_id: slotId }),
    })
    setSaving(false)
    loadDrafts(monthId)
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
    loadDrafts(monthId)
  }

  const okDrafts       = drafts.filter(d => !d.has_conflict)
  const conflictDrafts = drafts.filter(d =>  d.has_conflict)
  const selMonth       = months.find(m => m.id === monthId)

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>
            수업 초안 확정
          </h1>
          <select
            value={monthId}
            onChange={e => setMonthId(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', color: '#374151' }}>
            {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* 안내 배너 */}
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '1rem', padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#1d4ed8' }}>
          💡 15일에 자동 생성된 수업 초안입니다. 내용 확인 후 <strong>일괄 확정</strong> 또는 개별 조정하세요.
          충돌 항목(코치 휴무)은 <span style={{ color: '#b91c1c', fontWeight: 700 }}>빨간색</span>으로 표시됩니다.
        </div>

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
              <button
                onClick={handleConfirmAll}
                disabled={saving || okDrafts.length === 0}
                style={{ padding: '0.625rem 1.25rem', background: okDrafts.length === 0 ? '#e5e7eb' : '#16A34A', color: okDrafts.length === 0 ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: okDrafts.length === 0 ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중...' : `📋 ${okDrafts.length}건 일괄 확정`}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div style={{ background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${msg.startsWith('✅') ? '#86efac' : '#fecaca'}`, borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1rem', fontSize: '0.875rem', color: msg.startsWith('✅') ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
            {msg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <p>
              {selMonth ? `${selMonth.year}년 ${selMonth.month}월 ` : ''}확정 대기 중인 초안이 없습니다
            </p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>매월 15일에 자동 생성됩니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>

            {/* 충돌 항목 먼저 */}
            {conflictDrafts.length > 0 && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', marginTop: '0.5rem', marginBottom: '0.25rem' }}>⚠️ 충돌 항목 — 수동 처리 필요</div>
                {conflictDrafts.map(s => <SlotCard key={s.id} slot={s} onConfirm={handleConfirmOne} onDelete={handleDeleteOne} saving={saving} />)}
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
  const isConflict = slot.has_conflict

  return (
    <div style={{
      background: 'white',
      border: `1.5px solid ${isConflict ? '#fecaca' : '#e5e7eb'}`,
      borderLeft: `4px solid ${isConflict ? '#b91c1c' : '#16A34A'}`,
      borderRadius: '0.875rem', padding: '0.875rem 1rem',
      display: 'flex', alignItems: 'center', gap: '0.875rem',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
          {isConflict && <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '9999px' }}>휴무충돌</span>}
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{slot.member_name}</span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{slot.coach_name} 코치</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: isConflict ? '#b91c1c' : '#374151', fontWeight: isConflict ? 700 : 400 }}>
          📅 {full} · {slot.lesson_type} · {slot.duration_minutes}분
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        <button
          onClick={() => onConfirm(slot.id)}
          disabled={saving}
          style={{ padding: '0.375rem 0.75rem', background: isConflict ? '#fff7ed' : '#f0fdf4', border: `1.5px solid ${isConflict ? '#fed7aa' : '#86efac'}`, borderRadius: '0.5rem', color: isConflict ? '#c2410c' : '#15803d', fontWeight: 700, fontSize: '0.75rem', cursor: saving ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {isConflict ? '강제 확정' : '확정'}
        </button>
        <button
          onClick={() => onDelete(slot.id)}
          disabled={saving}
          style={{ padding: '0.375rem 0.75rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: saving ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          삭제
        </button>
      </div>
    </div>
  )
}