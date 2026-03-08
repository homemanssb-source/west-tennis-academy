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
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { year: number; month: number }
}
interface Coach { id: string; name: string }

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_coach: { label: '肄붿튂 ?뺤씤 以?, color: '#854d0e', bg: '#fef9c3', border: '#fde68a' },
  pending_admin: { label: '?뱀씤 ?湲?,   color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
  approved:      { label: '?뺤젙',        color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  rejected:      { label: '嫄곗젅',        color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
}

const DAYS = ['??,'??,'??,'??,'紐?,'湲?,'??]

export default function OwnerApplicationsPage() {
  const [apps,    setApps]    = useState<App[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<App | null>(null)
  const [adminNote, setAdminNote]   = useState('')
  const [editTime,  setEditTime]    = useState('')
  const [editDate,  setEditDate]    = useState('')
  const [editCoach, setEditCoach]   = useState('')
  const [saving,    setSaving]      = useState(false)
  const [filter,    setFilter]      = useState<'pending_admin'|'all'>('pending_admin')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/lesson-applications')
    const d = await res.json()
    setApps(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  const openModal = (a: App) => {
    setSelected(a)
    setAdminNote('')
    const dt = new Date(a.requested_at)
    setEditDate(dt.toISOString().split('T')[0])
    setEditTime(`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`)
    setEditCoach(a.coach?.id ?? '')
  }

  const handleAction = async (action: 'admin_approve' | 'admin_reject') => {
    if (!selected) return
    setSaving(true)
    const requested_at = action === 'admin_approve'
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

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const filtered = filter === 'pending_admin'
    ? apps.filter(a => a.status === 'pending_admin')
    : apps

  const pendingCount = apps.filter(a => a.status === 'pending_admin').length

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* ?ㅻ뜑 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>??/Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>?섏뾽 ?좎껌 愿由?/h1>
          {pendingCount > 0 && (
            <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>
              ?뱀씤 ?湲?{pendingCount}嫄?            </span>
          )}
        </div>
        <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem' }}>
          {(['pending_admin','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                background: filter === f ? '#1d4ed8' : '#f3f4f6',
                color: filter === f ? 'white' : '#6b7280' }}>
              {f === 'pending_admin' ? `?뱀씤 ?湲?(${pendingCount})` : '?꾩껜'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>遺덈윭?ㅻ뒗 以?..</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>??/div>
            <p>{filter === 'pending_admin' ? '?뱀씤 ?湲??좎껌???놁뒿?덈떎' : '?좎껌 ?댁뿭???놁뒿?덈떎'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(a => {
              const st = STATUS[a.status] ?? STATUS.pending_coach
              return (
                <div key={a.id}
                  onClick={() => a.status === 'pending_admin' ? openModal(a) : null}
                  style={{ background: 'white', border: `1.5px solid ${st.border}`, borderRadius: '1rem', padding: '1rem 1.25rem', cursor: a.status === 'pending_admin' ? 'pointer' : 'default',
                    transition: 'box-shadow .15s' }}
                  onMouseEnter={e => a.status === 'pending_admin' && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{a.member?.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{a.member?.phone}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{fmtDt(a.requested_at)}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                        {a.coach?.name} 肄붿튂 쨌 {a.duration_minutes}遺?쨌 {a.lesson_type} 쨌 {a.month?.year}??{a.month?.month}??                      </div>
                      {a.coach_note && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', background: '#fef9c3', color: '#854d0e', padding: '4px 8px', borderRadius: '0.5rem' }}>
                          肄붿튂 硫붾え: {a.coach_note}
                        </div>
                      )}
                    </div>
                    {a.status === 'pending_admin' && (
                      <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, flexShrink: 0 }}>?대┃ ??/span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ?뱀씤 紐⑤떖 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>理쒖쥌 ?뱀씤</h2>

            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>{selected.member?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                ?먮옒 ?좎껌: {fmtDt(selected.requested_at)}
              </div>
              {selected.coach_note && (
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#854d0e' }}>肄붿튂 硫붾え: {selected.coach_note}</div>
              )}
            </div>

            {/* ?쒓컙/肄붿튂 ?섏젙 媛??*/}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>
                ?륅툘 ?쒓컙/肄붿튂 ?섏젙 媛??(?꾩슂 ??
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>?좎쭨</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>?쒓컙</label>
                  <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>肄붿튂</label>
                <select value={editCoach} onChange={e => setEditCoach(e.target.value)} style={inputStyle}>
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 肄붿튂</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>愿由?硫붾え (?뚯썝?먭쾶 ?꾨떖)</label>
                <input style={inputStyle} placeholder="?좏깮 ?ы빆" value={adminNote} onChange={e => setAdminNote(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => handleAction('admin_approve')} disabled={saving}
                style={{ flex: 2, padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '泥섎━ 以?..' : '??理쒖쥌 ?뱀씤 ???섏뾽 ?뺤젙'}
              </button>
              <button onClick={() => handleAction('admin_reject')} disabled={saving}
                style={{ flex: 1, padding: '0.875rem', background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                嫄곗젅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

