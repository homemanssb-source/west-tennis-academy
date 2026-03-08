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
  member: { id: string; name: string; phone: string }
  month: { year: number; month: number }
}

const DAYS = ['일','월','화','수','목','금','토']

export default function CoachApplicationsPage() {
  const [apps,       setApps]       = useState<App[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<App | null>(null)
  const [note,       setNote]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [tab,        setTab]        = useState<'pending'|'done'>('pending')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkNote,   setBulkNote]   = useState('')
  const [bulkModal,  setBulkModal]  = useState<'approve'|'reject'|null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/lesson-applications')
    const d = await res.json()
    setApps(Array.isArray(d) ? d : [])
    setCheckedIds(new Set())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAction = async (action: 'coach_approve' | 'coach_reject') => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/lesson-applications/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, coach_note: note || null }),
    })
    setSaving(false)
    setSelected(null)
    setNote('')
    load()
  }

  const handleBulkAction = async (action: 'coach_approve' | 'coach_reject') => {
    setSaving(true)
    const ids = Array.from(checkedIds)
    await Promise.all(ids.map(id =>
      fetch(`/api/lesson-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, coach_note: bulkNote || null }),
      })
    ))
    setSaving(false)
    setBulkModal(null)
    setBulkNote('')
    load()
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const pending  = apps.filter(a => a.status === 'pending_coach')
  const done     = apps.filter(a => a.status !== 'pending_coach')
  const current  = tab === 'pending' ? pending : done
  const allChecked = pending.length > 0 && pending.every(a => checkedIds.has(a.id))

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set())
    else setCheckedIds(new Set(pending.map(a => a.id)))
  }

  const s = {
    tab: (active: boolean, color = '#16A34A') => ({
      flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' as const,
      fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.85rem',
      background: active ? color : '#f3f4f6', color: active ? 'white' : '#6b7280',
    }),
  }

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>수업 신청 확인</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setTab('pending')} style={s.tab(tab === 'pending')}>
            확인 대기 {pending.length > 0 && `(${pending.length})`}
          </button>
          <button onClick={() => setTab('done')} style={s.tab(tab === 'done', '#6b7280')}>
            처리 완료
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem', paddingBottom: '9rem' }}>

        {/* 일괄 처리 바 */}
        {tab === 'pending' && pending.length > 0 && (
          <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '0.75rem 1rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll}
              style={{ width: '16px', height: '16px', accentColor: '#16A34A', cursor: 'pointer' }} />
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중..</div>
        ) : current.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
            <p>{tab === 'pending' ? '확인할 신청이 없습니다' : '처리 내역이 없습니다'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {current.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                {/* 체크박스 (대기 탭만) */}
                {tab === 'pending' && (
                  <div style={{ paddingTop: '1rem' }}>
                    <input type="checkbox" checked={checkedIds.has(a.id)} onChange={() => toggleCheck(a.id)}
                      style={{ width: '16px', height: '16px', accentColor: '#16A34A', cursor: 'pointer' }} />
                  </div>
                )}
                <div style={{ flex: 1, background: 'white', border: `1.5px solid ${tab === 'pending' ? '#fde68a' : '#f3f4f6'}`, borderRadius: '1rem', padding: '1rem 1.25rem', cursor: tab === 'pending' ? 'pointer' : 'default' }}
                  onClick={() => tab === 'pending' ? (setSelected(a), setNote('')) : null}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{a.member?.name}</span>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{a.member?.phone}</span>
                    {a.status !== 'pending_coach' && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                        background: a.status === 'rejected' ? '#fee2e2' : '#dcfce7',
                        color: a.status === 'rejected' ? '#b91c1c' : '#15803d' }}>
                        {a.status === 'rejected' ? '거절' : '승인완료'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>{fmtDt(a.requested_at)}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{a.duration_minutes}분 · {a.lesson_type} · {a.month?.year}년 {a.month?.month}월</div>
                  {tab === 'pending' && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#854d0e', fontWeight: 600 }}>탭하여 승인/거절 →</div>
                  )}
                  {a.coach_note && (
                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                      메모: {a.coach_note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 개별 처리 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>수업 신청 처리</h2>
            <div style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>{selected.member?.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: '2px' }}>{fmtDt(selected.requested_at)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{selected.duration_minutes}분 · {selected.lesson_type}</div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모 (선택)</label>
              <input
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box' as const, outline: 'none' }}
                placeholder="회원에게 전달할 메모"
                value={note} onChange={e => setNote(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => handleAction('coach_approve')} disabled={saving}
                style={{ flex: 2, padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중..' : '✅ 승인 → 관리자 전달'}
              </button>
              <button onClick={() => handleAction('coach_reject')} disabled={saving}
                style={{ flex: 1, padding: '0.875rem', background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                거절
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 처리 모달 */}
      {bulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setBulkModal(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {bulkModal === 'approve' ? '일괄 승인' : '일괄 거절'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              선택한 <strong style={{ color: bulkModal === 'approve' ? '#16A34A' : '#b91c1c' }}>{checkedIds.size}개</strong> 신청을
              {bulkModal === 'approve' ? ' 승인' : ' 거절'}합니다.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>공통 메모 (선택)</label>
              <input
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box' as const, outline: 'none' }}
                placeholder="전체 회원에게 전달할 메모"
                value={bulkNote} onChange={e => setBulkNote(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => setBulkModal(null)}
                style={{ flex: 1, padding: '0.875rem', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                취소
              </button>
              <button onClick={() => handleBulkAction(bulkModal === 'approve' ? 'coach_approve' : 'coach_reject')} disabled={saving}
                style={{ flex: 2, padding: '0.875rem', background: bulkModal === 'approve' ? '#16A34A' : '#b91c1c', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '처리 중..' : `${checkedIds.size}개 ${bulkModal === 'approve' ? '승인' : '거절'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 네비 */}
      <div className="bottom-nav">
        <Link href="/coach" className="bottom-nav-item">
          <span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span>
        </Link>
        <Link href="/coach/schedule" className="bottom-nav-item">
          <span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span>
        </Link>
        <Link href="/coach/applications" className="bottom-nav-item active">
          <span style={{ fontSize: '1.25rem' }}>🎾</span>
          <span>신청</span>
          {pending.length > 0 && <span style={{ position: 'absolute', top: '4px', right: '12px', background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '9999px' }}>{pending.length}</span>}
        </Link>
      </div>
    </div>
  )
}
