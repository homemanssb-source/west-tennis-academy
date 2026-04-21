'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface App {
  id: string
  requested_at: string
  duration_minutes: number
  lesson_type: string
  status: string
  coach_note: string | null
  admin_note: string | null
  applicant_name?: string
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { year: number; month: number }
}
interface Coach { id: string; name: string }

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_coach: { label: '코치 확인 중', color: '#854d0e', bg: '#fef9c3', border: '#fde68a' },
  pending_admin: { label: '승인 대기',   color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
  approved:      { label: '확정',        color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  rejected:      { label: '거절',        color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
}

const DAYS = ['일','월','화','수','목','금','토']

export default function OwnerApplicationsPage() {
  const [apps,       setApps]       = useState<App[]>([])
  const [coaches,    setCoaches]    = useState<Coach[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<App | null>(null)
  const [adminNote,  setAdminNote]  = useState('')
  const [editTime,   setEditTime]   = useState('')
  const [editDate,   setEditDate]   = useState('')
  const [editCoach,  setEditCoach]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [filter,     setFilter]     = useState<'pending_admin'|'all'>('pending_admin')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkModal,  setBulkModal]  = useState<'approve'|'reject'|null>(null)
  const [bulkNote,   setBulkNote]   = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/lesson-applications')
    const d = await res.json()
    setApps(Array.isArray(d) ? d : [])
    setCheckedIds(new Set())
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  const openModal = (a: App) => {
    setSelected(a)
    setAdminNote('')
    setEditDate('')
    setEditTime('')
    setEditCoach(a.coach?.id ?? '')
  }

  const handleAction = async (action: 'admin_approve' | 'admin_reject') => {
    if (!selected) return
    setSaving(true)
    const requested_at = (action === 'admin_approve' && editDate && editTime)
      ? `${editDate}T${editTime}:00+09:00`
      : undefined
    await fetch(`/api/lesson-applications/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        admin_note: adminNote || null,
        requested_at,
        coach_id: editCoach || undefined,
      }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  // ✅ perf: Promise.all 병렬 처리 (1건당 ~100ms × N → ~100ms 로 단축)
  //   - 과거 race 우려는 RPC 의 family 단위 advisory lock + 상태전이 그래프로 DB 레벨 해결됨
  //   - 단 너무 많은 건을 한번에 쏘면 서버 부담 → 5건씩 배치 처리
  const handleBulkAction = async (action: 'admin_approve' | 'admin_reject') => {
    setSaving(true)
    const ids = Array.from(checkedIds)
    const BATCH = 5
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      await Promise.all(batch.map(id =>
        fetch(`/api/lesson-applications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, admin_note: bulkNote || null }),
        })
      ))
    }
    setSaving(false)
    setBulkModal(null)
    setBulkNote('')
    load()
  }

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const displayName = (a: App) =>
    a.applicant_name ? `${a.member?.name} (${a.applicant_name})` : a.member?.name

  const filtered     = filter === 'pending_admin' ? apps.filter(a => a.status === 'pending_admin') : apps
  const pendingList  = apps.filter(a => a.status === 'pending_admin')
  const pendingCount = pendingList.length
  const allChecked   = pendingList.length > 0 && pendingList.every(a => checkedIds.has(a.id))

  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set())
    else setCheckedIds(new Set(pendingList.map(a => a.id)))
  }

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>수업 신청 관리</h1>
          {pendingCount > 0 && (
            <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>
              승인 대기 {pendingCount}건
            </span>
          )}
        </div>

        <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem' }}>
          {(['pending_admin', 'all'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setCheckedIds(new Set()) }}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                background: filter === f ? '#1d4ed8' : '#f3f4f6',
                color:      filter === f ? 'white'   : '#6b7280' }}>
              {f === 'pending_admin' ? `승인 대기 (${pendingCount})` : '전체'}
            </button>
          ))}
        </div>

        {filter === 'pending_admin' && pendingCount > 0 && (
          <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', background: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #93c5fd' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll}
              style={{ width: '16px', height: '16px', accentColor: '#1d4ed8', cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600, flex: 1 }}>
              {checkedIds.size > 0 ? `${checkedIds.size}개 선택됨` : '전체 선택'}
            </span>
            {checkedIds.size > 0 && (
              <>
                <button onClick={() => { setBulkModal('approve'); setBulkNote('') }}
                  style={{ padding: '0.375rem 0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  일괄 승인
                </button>
                <button onClick={() => { setBulkModal('reject'); setBulkNote('') }}
                  style={{ padding: '0.375rem 0.875rem', background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  일괄 거절
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 목록 */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <p>{filter === 'pending_admin' ? '승인 대기 신청이 없습니다' : '신청 내역이 없습니다'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(a => {
              const st = STATUS[a.status] ?? STATUS.pending_coach
              const isPending = a.status === 'pending_admin'
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                  {filter === 'pending_admin' && isPending && (
                    <div style={{ paddingTop: '1.1rem' }}>
                      <input type="checkbox" checked={checkedIds.has(a.id)} onChange={() => toggleCheck(a.id)}
                        style={{ width: '16px', height: '16px', accentColor: '#1d4ed8', cursor: 'pointer' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, background: 'white', border: `1.5px solid ${st.border}`, borderRadius: '1rem', padding: '1rem 1.25rem',
                    cursor: isPending ? 'pointer' : 'default', transition: 'box-shadow .15s' }}
                    onClick={() => isPending ? openModal(a) : null}
                    onMouseEnter={e => isPending && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{displayName(a)}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{a.member?.phone}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{fmtDt(a.requested_at)}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                          {a.coach?.name} 코치 · {a.duration_minutes}분 · {a.lesson_type} · {a.month?.year}년 {a.month?.month}월
                        </div>
                        {a.coach_note && (
                          <div style={{ marginTop: '6px', fontSize: '0.75rem', background: '#fef9c3', color: '#854d0e', padding: '4px 8px', borderRadius: '0.5rem' }}>
                            코치 메모: {a.coach_note}
                          </div>
                        )}
                      </div>
                      {isPending && (
                        <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, flexShrink: 0 }}>클릭 →</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 개별 승인 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>최종 승인</h2>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>{displayName(selected)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>신청 시간: {fmtDt(selected.requested_at)}</div>
              {selected.coach_note && (
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#854d0e' }}>코치 메모: {selected.coach_note}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>
                ✏️ 시간/코치 수정 시에만 입력 (빈칸이면 신청 시간 그대로 확정)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>날짜 (변경 시)</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>시간 (변경 시)</label>
                  <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>코치</label>
                <select value={editCoach} onChange={e => setEditCoach(e.target.value)} style={inputStyle}>
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>관리 메모 (회원에게 전달)</label>
                <input style={inputStyle} placeholder="선택 사항" value={adminNote} onChange={e => setAdminNote(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => handleAction('admin_approve')} disabled={saving}
                style={{ flex: 2, padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중...' : '✅ 최종 승인 → 수업 확정'}
              </button>
              <button onClick={() => handleAction('admin_reject')} disabled={saving}
                style={{ flex: 1, padding: '0.875rem', background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                거절
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 처리 모달 */}
      {bulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setBulkModal(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '1.5rem', padding: '1.5rem' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {bulkModal === 'approve' ? '일괄 최종 승인' : '일괄 거절'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' }}>
              선택한 <strong style={{ color: bulkModal === 'approve' ? '#16A34A' : '#b91c1c' }}>{checkedIds.size}개</strong> 신청을
              {bulkModal === 'approve' ? ' 최종 승인' : ' 거절'}합니다.
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                공통 메모 (선택 — 모든 신청에 동일 적용)
              </label>
              <input style={inputStyle} placeholder="선택 사항"
                value={bulkNote} onChange={e => setBulkNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => setBulkModal(null)}
                style={{ flex: 1, padding: '0.875rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                취소
              </button>
              <button onClick={() => handleBulkAction(bulkModal === 'approve' ? 'admin_approve' : 'admin_reject')} disabled={saving}
                style={{ flex: 2, padding: '0.875rem', background: bulkModal === 'approve' ? '#16A34A' : '#b91c1c', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중...' : bulkModal === 'approve' ? `✅ ${checkedIds.size}개 승인` : `❌ ${checkedIds.size}개 거절`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}