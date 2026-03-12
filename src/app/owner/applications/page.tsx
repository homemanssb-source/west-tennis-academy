'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Application {
  id: string
  name: string
  phone: string
  birth_date: string | null
  address: string | null
  emergency_contact: string | null
  health_notes: string | null
  desired_schedule: string | null
  status: string
  created_at: string
}

export default function ApplicationsPage() {
  const [apps, setApps]         = useState<Application[]>([])
  const [status, setStatus]     = useState('approved')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Application | null>(null)
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState<Partial<Application>>({})
  const [saving, setSaving]     = useState(false)

  const load = async (s: string) => {
    setLoading(true)
    const res = await fetch(`/api/applications?type=member_join&status=${s}`)
    const data = await res.json()
    setApps(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load(status) }, [status])

  const openDetail = (app: Application) => {
    setSelected(app)
    setEditing(false)
    setEditForm({})
  }

  const startEdit = () => {
    if (!selected) return
    setEditForm({
      name:               selected.name,
      phone:              selected.phone,
      birth_date:         selected.birth_date ?? '',
      address:            selected.address ?? '',
      emergency_contact:  selected.emergency_contact ?? '',
      health_notes:       selected.health_notes ?? '',
      desired_schedule:   selected.desired_schedule ?? '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/applications/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', ...editForm }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    // 로컬 상태 업데이트
    const updated = { ...selected, ...editForm } as Application
    setSelected(updated)
    setApps(prev => prev.map(a => a.id === selected.id ? updated : a))
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`${selected.name}님의 가입서를 삭제할까요?`)) return
    const res = await fetch(`/api/applications/${selected.id}`, { method: 'DELETE' })
    if (!res.ok) return alert('삭제 실패')
    setSelected(null)
    load(status)
  }

  const statusLabel: Record<string, string> = { approved: '가입됨', rejected: '거절됨' }
  const fmt = (d: string) => new Date(d).toLocaleDateString('ko-KR')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem',
    borderRadius: '0.625rem', border: '1.5px solid #e5e7eb',
    fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    outline: 'none', boxSizing: 'border-box', color: '#111827',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 700, color: '#6b7280',
    display: 'block', marginBottom: '5px',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>회원 가입서</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {(['approved','rejected'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: status === s ? '#16A34A' : '#f3f4f6', color: status === s ? 'white' : '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* 안내 배너 */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#15803d' }}>
          📋 가입서를 클릭하면 내용을 확인하고 <strong>수정</strong>할 수 있습니다.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p>{statusLabel[status]} 가입서가 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {apps.map(app => (
              <div key={app.id} onClick={() => openDetail(app)}
                style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.05)', transition: 'box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.05)')}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{app.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{app.phone} · {fmt(app.created_at)}</div>
                  {app.desired_schedule && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>희망 일정: {app.desired_schedule}</div>}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
                  background: status === 'approved' ? '#dcfce7' : '#fee2e2',
                  color: status === 'approved' ? '#15803d' : '#b91c1c' }}>
                  {statusLabel[status]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 상세/수정 모달 ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setEditing(false) } }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '520px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />

            {/* 모달 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                {editing ? '가입서 수정' : '가입서 상세'}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!editing && (
                  <>
                    <button onClick={startEdit}
                      style={{ padding: '0.375rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #86efac', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      ✏️ 수정
                    </button>
                    <button onClick={handleDelete}
                      style={{ padding: '0.375rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 조회 모드 */}
            {!editing && (
              <>
                {[
                  { label: '이름',          value: selected.name },
                  { label: '전화번호',      value: selected.phone },
                  { label: '생년월일',      value: selected.birth_date ?? '-' },
                  { label: '주소',          value: selected.address ?? '-' },
                  { label: '비상연락처',    value: selected.emergency_contact ?? '-' },
                  { label: '건강 특이사항', value: selected.health_notes ?? '-' },
                  { label: '희망 수업일정', value: selected.desired_schedule ?? '-' },
                  { label: '가입일',        value: fmt(selected.created_at) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ width: '90px', flexShrink: 0, fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                    <span style={{ fontSize: '0.875rem', color: '#111827', wordBreak: 'break-all' }}>{row.value}</span>
                  </div>
                ))}
                <button onClick={() => setSelected(null)}
                  style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  닫기
                </button>
              </>
            )}

            {/* 수정 모드 */}
            {editing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>이름 *</label>
                  <input style={inputStyle} value={editForm.name ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>전화번호 *</label>
                  <input style={inputStyle} value={editForm.phone ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} inputMode="numeric" />
                </div>
                <div>
                  <label style={labelStyle}>생년월일</label>
                  <input type="date" style={inputStyle} value={editForm.birth_date ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>주소</label>
                  <input style={inputStyle} value={editForm.address ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>비상연락처</label>
                  <input style={inputStyle} value={editForm.emergency_contact ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, emergency_contact: e.target.value }))} inputMode="numeric" />
                </div>
                <div>
                  <label style={labelStyle}>건강 특이사항</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                    value={editForm.health_notes ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, health_notes: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>희망 수업일정</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                    value={editForm.desired_schedule ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, desired_schedule: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => setEditing(false)}
                    style={{ flex: 1, padding: '0.875rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                    취소
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}