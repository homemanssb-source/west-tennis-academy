'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Program {
  id: string
  name: string
  ratio: string
  max_students: number
  unit_minutes: number
  description: string | null
  is_active: boolean
  created_at: string
}

const PRESET_RATIOS = ['1:1', '2:1', '3:1', '4:1', '5:1', '6:1', '그룹']

export default function ProgramsPage() {
  const [programs, setPrograms]   = useState<Program[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [selected, setSelected]   = useState<Program | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm] = useState({
    name: '', ratio: '1:1', max_students: 1, unit_minutes: 60, description: '', customRatio: ''
  })
  const [useCustom, setUseCustom] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/programs')
    const data = await res.json()
    setPrograms(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.name) return alert('프로그램 이름을 입력해주세요')
    const ratio = useCustom ? form.customRatio : form.ratio
    if (!ratio) return alert('비율을 선택하거나 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, ratio, max_students: form.max_students, unit_minutes: form.unit_minutes, description: form.description }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setShowAdd(false)
    setForm({ name: '', ratio: '1:1', max_students: 1, unit_minutes: 60, description: '', customRatio: '' })
    load()
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/programs/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selected.name, ratio: selected.ratio, max_students: selected.max_students, unit_minutes: selected.unit_minutes, description: selected.description }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleToggle = async (id: string) => {
    await fetch(`/api/programs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active' }),
    })
    load()
    setSelected(null)
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>수업 프로그램</h1>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 프로그램 추가
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : programs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
            <p>등록된 프로그램이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '0.75rem' }}>
            {programs.map(p => (
              <div key={p.id} onClick={() => setSelected({ ...p })}
                style={{ background: 'white', border: `1.5px solid ${p.is_active ? '#f3f4f6' : '#fee2e2'}`, borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.05)', opacity: p.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#16A34A' }}>{p.ratio}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: p.is_active ? '#dcfce7' : '#fee2e2', color: p.is_active ? '#15803d' : '#b91c1c' }}>
                    {p.is_active ? '운영중' : '중단'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '4px' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>최대 {p.max_students}명 · {p.unit_minutes}분</div>
                {p.description && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{p.description}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 추가 모달 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>프로그램 추가</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>프로그램 이름</label>
                <input className="input-base" placeholder="예) 개인레슨, 패밀리레슨" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>수업 비율 (코치:학생)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {PRESET_RATIOS.map(r => (
                    <button key={r} onClick={() => { setUseCustom(false); setForm(f => ({ ...f, ratio: r })) }}
                      style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${!useCustom && form.ratio === r ? '#16A34A' : '#e5e7eb'}`, background: !useCustom && form.ratio === r ? '#f0fdf4' : 'white', color: !useCustom && form.ratio === r ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {r}
                    </button>
                  ))}
                  <button onClick={() => setUseCustom(true)}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${useCustom ? '#16A34A' : '#e5e7eb'}`, background: useCustom ? '#f0fdf4' : 'white', color: useCustom ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    직접입력
                  </button>
                </div>
                {useCustom && (
                  <input className="input-base" placeholder="예) 7:1, 8:1" value={form.customRatio} onChange={e => setForm(f => ({ ...f, customRatio: e.target.value }))} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>최대 학생 수</label>
                  <input type="number" className="input-base" value={form.max_students} min={1} max={50} onChange={e => setForm(f => ({ ...f, max_students: Number(e.target.value) }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 시간 (분)</label>
                  <input type="number" className="input-base" value={form.unit_minutes} min={30} step={15} onChange={e => setForm(f => ({ ...f, unit_minutes: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>설명 (선택)</label>
                <textarea className="input-base" placeholder="프로그램 설명" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>프로그램 수정</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>프로그램 이름</label>
                <input className="input-base" value={selected.name} onChange={e => setSelected(s => s ? { ...s, name: e.target.value } : s)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>비율</label>
                <input className="input-base" value={selected.ratio} onChange={e => setSelected(s => s ? { ...s, ratio: e.target.value } : s)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>최대 학생 수</label>
                  <input type="number" className="input-base" value={selected.max_students} min={1} onChange={e => setSelected(s => s ? { ...s, max_students: Number(e.target.value) } : s)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 시간 (분)</label>
                  <input type="number" className="input-base" value={selected.unit_minutes} min={30} step={15} onChange={e => setSelected(s => s ? { ...s, unit_minutes: Number(e.target.value) } : s)} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>설명</label>
                <textarea className="input-base" value={selected.description ?? ''} onChange={e => setSelected(s => s ? { ...s, description: e.target.value } : s)} rows={2} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '1.5rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => handleToggle(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${selected.is_active ? '#fecaca' : '#86efac'}`, background: selected.is_active ? '#fef2f2' : '#f0fdf4', color: selected.is_active ? '#b91c1c' : '#15803d', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {selected.is_active ? '🚫 프로그램 중단' : '✅ 프로그램 재개'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
