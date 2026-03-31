'use client'
// src/app/owner/schedule-draft/page.tsx
// ??fix: fmtSlot KST 蹂??(Supabase UTC 諛섑솚 ???
// ??fix: family_member_name ?쒖떆 (媛議??좎껌 ???
// ??add: registration_open ?좉? 踰꾪듉 異붽? (?뚯썝 ?좎껌 ?ㅽ뵂)

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

const DAY_KO = ['??,'??,'??,'??,'紐?,'湲?,'??]

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
      const ok = confirm(`異⑸룎 ${conflicts.length}嫄댁? ?쒖쇅?섍퀬 ?섎㉧吏 ${drafts.length - conflicts.length}嫄대쭔 ?뺤젙?좉퉴??`)
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
    if (!res.ok) { setMsg('??' + data.error); return }
    setMsg(`??${data.confirmed}嫄??뺤젙??)
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
    if (!confirm('??珥덉븞 ?щ’????젣?좉퉴??')) return
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
    if (!confirm(`異⑸룎 ??ぉ ${cnt}嫄댁쓣 紐⑤몢 ??젣?좉퉴??`)) return
    setSaving(true)
    const res = await fetch('/api/schedule-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_all_conflict', month_id: monthId }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg('??' + data.error); return }
    setMsg(`?뿊 異⑸룎 ${data.deleted}嫄???젣??)
    loadAll(monthId)
  }

  const handleRequestAction = async (reqId: string, action: 'approve' | 'reject') => {
    setSaving(true)
    await fetch(`/api/lesson-applications/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }),
    })
    setSaving(false)
    loadAll(monthId)
  }

  // 珥덉븞 誘몃━蹂닿린 ?좉? (湲곗〈 ?뚯썝??珥덉븞 ?뺤씤 + ?섏젙 ?붿껌??
  const handleToggleDraftOpen = async () => {
    const selMonth = months.find(m => m.id === monthId)
    const newVal   = !selMonth?.draft_open
    await fetch('/api/months', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_id: monthId, draft_open: newVal }),
    })
    setMonths(prev => prev.map(m => m.id === monthId ? { ...m, draft_open: newVal } : m))
    setMsg(newVal ? '???뚯썝 誘몃━蹂닿린 ?ㅽ뵂?? : '?뵏 ?뚯썝 誘몃━蹂닿린 ?ロ옒')
  }

  // ?좎껌 ?ㅽ뵂 ?좉? (珥덉븞 ?뺤젙 ???뚯썝??吏곸젒 ?섏뾽 ?좎껌 媛??
  const handleToggleRegistrationOpen = async () => {
    const selMonth = months.find(m => m.id === monthId)
    const newVal   = !selMonth?.registration_open
    await fetch('/api/months', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month_id: monthId, registration_open: newVal }),
    })
    setMonths(prev => prev.map(m => m.id === monthId ? { ...m, registration_open: newVal } : m))
    setMsg(newVal ? '?렱 ?뚯썝 ?섏뾽 ?좎껌 ?ㅽ뵂?? : '?뵏 ?뚯썝 ?섏뾽 ?좎껌 ?ロ옒')
  }

  const okDrafts       = drafts.filter(d => !d.has_conflict)
  const conflictDrafts = drafts.filter(d =>  d.has_conflict)
  const selMonth       = months.find(m => m.id === monthId)
  const pendingReqs    = requests.filter(r => ['pending_coach','pending_admin'].includes(r.status))

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* ?ㅻ뜑 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>??/Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>
            ?섏뾽 珥덉븞 ?뺤젙
          </h1>
          <select value={monthId} onChange={e => setMonthId(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', color: '#374151' }}>
            {months.map(m => <option key={m.id} value={m.id}>{m.year}??{m.month}??/option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* ?? STEP 1: 珥덉븞 誘몃━蹂닿린 ?좉? (湲곗〈 ?뚯썝 ?섏젙 ?붿껌?? ?? */}
        <div style={{
          background: selMonth?.draft_open ? '#f0fdf4' : '#eff6ff',
          border: `1.5px solid ${selMonth?.draft_open ? '#86efac' : '#bfdbfe'}`,
          borderRadius: '1rem', padding: '1rem', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '2px', fontFamily: 'Noto Sans KR, sans-serif' }}>
              STEP 1 ??珥덉븞 誘몃━蹂닿린
            </div>
            <div style={{ fontSize: '0.875rem', color: selMonth?.draft_open ? '#15803d' : '#1d4ed8', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth?.draft_open
                ? '???ㅽ뵂 以????뚯썝???ㅼ쓬???섏뾽 珥덉븞???뺤씤?섍퀬 ?섏젙 ?붿껌?????덉뒿?덈떎'
                : '?뮕 ?ㅽ뵂?섎㈃ ?뚯썝??珥덉븞???뺤씤?섍퀬 ?섏젙 ?붿껌??蹂대궪 ???덉뒿?덈떎'
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
            {selMonth?.draft_open ? '?뵏 誘몃━蹂닿린 ?リ린' : '?뵑 誘몃━蹂닿린 ?ㅽ뵂'}
          </button>
        </div>

        {/* ?? STEP 2: ?좎껌 ?ㅽ뵂 ?좉? (珥덉븞 ?뺤젙 ???뚯썝 ?좎껌 ?덉슜) ?? */}
        <div style={{
          background: selMonth?.registration_open ? '#f0fdf4' : '#fafafa',
          border: `1.5px solid ${selMonth?.registration_open ? '#4ade80' : '#e5e7eb'}`,
          borderRadius: '1rem', padding: '1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '2px', fontFamily: 'Noto Sans KR, sans-serif' }}>
              STEP 2 ???뚯썝 ?섏뾽 ?좎껌 ?ㅽ뵂
            </div>
            <div style={{ fontSize: '0.875rem', color: selMonth?.registration_open ? '#15803d' : '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth?.registration_open
                ? '?렱 ?좎껌 ?ㅽ뵂 以????뚯썝???섏뾽 ?좎껌 ?섏씠吏?먯꽌 吏곸젒 ?좎껌?????덉뒿?덈떎'
                : '?뵏 ?ロ옒 ??珥덉븞 ?뺤젙 ?꾨즺 ???ㅽ뵂?섎㈃ ?뚯썝??吏곸젒 ?섏뾽???좎껌?⑸땲??
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
            {selMonth?.registration_open ? '?뵏 ?좎껌 ?リ린' : '?렱 ?좎껌 ?ㅽ뵂'}
          </button>
        </div>

        {/* ?뚯썝 ?섏젙 ?붿껌 諛곗? + ??*/}
        {requests.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={() => setReqTab(v => !v)}
              style={{ width: '100%', padding: '0.75rem 1rem', background: pendingReqs.length > 0 ? '#fef9c3' : 'white', border: `1.5px solid ${pendingReqs.length > 0 ? '#fde68a' : '#e5e7eb'}`, borderRadius: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              <span style={{ fontSize: '1rem' }}>?뱷</span>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', flex: 1, textAlign: 'left' }}>?뚯썝 ?섏젙 ?붿껌</span>
              {pendingReqs.length > 0 && (
                <span style={{ background: '#f59e0b', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                  寃???꾩슂 {pendingReqs.length}嫄?                </span>
              )}
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{reqTab ? '?? : '??}</span>
            </button>
            {reqTab && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {requests.map(r => {
                  const isPending   = ['pending_coach','pending_admin'].includes(r.status)
                  const typeLabel   = r.request_type === 'exclude' ? '?슟 ?쒖쇅 ?붿껌' :
                                      r.request_type === 'change'  ? '?봽 蹂寃??붿껌' : '??異붽? ?붿껌'
                  const statusLabel = r.status === 'approved' ? '???뱀씤' :
                                      r.status === 'rejected' ? '??嫄곗젅' : '??寃??以?
                  return (
                    <div key={r.id} style={{ background: 'white', border: `1.5px solid ${isPending ? '#fde68a' : '#e5e7eb'}`, borderRadius: '0.875rem', padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>{r.member_name}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'Noto Sans KR, sans-serif' }}>{typeLabel}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, color: isPending ? '#854d0e' : r.status === 'approved' ? '#15803d' : '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif', marginBottom: isPending ? '0.625rem' : 0 }}>
                        {r.requested_at ? fmtSlot(r.requested_at).full : ''} 쨌 {r.lesson_type}
                        {r.admin_note && <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>硫붾え: {r.admin_note}</span>}
                      </div>
                      {isPending && (
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button onClick={() => handleRequestAction(r.id, 'approve')} disabled={saving}
                            style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>???뱀씤</button>
                          <button onClick={() => handleRequestAction(r.id, 'reject')} disabled={saving}
                            style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>??嫄곗젅</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ?붿빟 + ?쇨큵 ?뺤젙 踰꾪듉 */}
        {!loading && drafts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
              ???뺤젙 媛??{okDrafts.length}嫄?            </div>
            {conflictDrafts.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c' }}>
                ?좑툘 異⑸룎 {conflictDrafts.length}嫄?              </div>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={handleConfirmAll} disabled={saving || okDrafts.length === 0}
                style={{ padding: '0.625rem 1.25rem', background: okDrafts.length === 0 ? '#e5e7eb' : '#16A34A', color: okDrafts.length === 0 ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.875rem', cursor: okDrafts.length === 0 ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '泥섎━ 以?..' : `??${okDrafts.length}嫄??쇨큵 ?뺤젙`}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div style={{
            background: msg.startsWith('??) ? '#fef2f2' : '#f0fdf4',
            border: `1.5px solid ${msg.startsWith('??) ? '#fecaca' : '#86efac'}`,
            borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1rem',
            fontSize: '0.875rem',
            color: msg.startsWith('??) ? '#b91c1c' : '#15803d',
            fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif',
          }}>
            {msg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>遺덈윭?ㅻ뒗 以?..</div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>?뱥</div>
            <p style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selMonth ? `${selMonth.year}??${selMonth.month}??` : ''}?뺤젙 ?湲?以묒씤 珥덉븞???놁뒿?덈떎
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {conflictDrafts.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c' }}>?좑툘 異⑸룎 ??ぉ ??媛쒕퀎 泥섎━ ?꾩슂</div>
                  <button onClick={handleDeleteAllConflict} disabled={saving}
                    style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
                    ?뿊 異⑸룎 ?꾩껜 ??젣
                  </button>
                </div>
                {conflictDrafts.map(s => (
                  <SlotCard key={s.id} slot={s} onConfirm={handleConfirmOne} onDelete={handleDeleteOne} saving={saving} />
                ))}
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginTop: '0.75rem', marginBottom: '0.25rem' }}>???뺤긽 ??ぉ</div>
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
  const memberName = slot.lesson_plan?.member?.name ?? '-'
  const coachName  = slot.lesson_plan?.coach?.name  ?? '-'
  const lessonType = slot.lesson_plan?.lesson_type  ?? ''

  const childName   = slot.family_member_name ?? slot.lesson_plan?.family_member?.name ?? null
  const displayName = childName ? `${memberName}(${childName})` : memberName

  return (
    <div style={{ background: 'white', border: `1.5px solid ${isConflict ? '#fecaca' : '#e5e7eb'}`, borderLeft: `4px solid ${isConflict ? '#b91c1c' : '#16A34A'}`, borderRadius: '0.875rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px', flexWrap: 'wrap' }}>
          {isConflict && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '9999px' }}>?쒓컙異⑸룎</span>
          )}
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {displayName}
          </span>
          {childName && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: '9999px' }}>?먮?</span>
          )}
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>{coachName} 肄붿튂</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: isConflict ? '#b91c1c' : '#374151', fontWeight: isConflict ? 700 : 400, fontFamily: 'Noto Sans KR, sans-serif' }}>
          ?뱟 {full} 쨌 {lessonType} 쨌 {slot.duration_minutes}遺?        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        <button onClick={() => onConfirm(slot.id)} disabled={saving}
          style={{ padding: '0.375rem 0.75rem', background: isConflict ? '#fff7ed' : '#f0fdf4', border: `1.5px solid ${isConflict ? '#fed7aa' : '#86efac'}`, borderRadius: '0.5rem', color: isConflict ? '#c2410c' : '#15803d', fontWeight: 700, fontSize: '0.75rem', cursor: saving ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {isConflict ? '媛뺤젣 ?뺤젙' : '?뺤젙'}
        </button>
        <button onClick={() => onDelete(slot.id)} disabled={saving}
          style={{ padding: '0.375rem 0.75rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.75rem', cursor: saving ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          ??젣
        </button>
      </div>
    </div>
  )
}
