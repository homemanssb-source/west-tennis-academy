'use client'
// src/app/owner/programs/page.tsx
// ✅ per_session_price 추가 + wta_config 설정 섹션 추가

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Coach   { id: string; name: string }
interface Program {
  id: string; name: string; ratio: string; max_students: number
  unit_minutes: number; description: string | null; is_active: boolean
  coach_id: string | null; coach?: { id: string; name: string } | null
  default_amount: number; per_session_price: number; sort_order: number; created_at: string
}
interface WtaConfig { session_threshold: number; sat_surcharge: number; sun_surcharge: number }

const PRESET_RATIOS = ['1:1', '2:1', '3:1', '4:1', '5:1', '6:1', '그룹']
const fmt = (n: number) => (n || 0).toLocaleString()

export default function ProgramsPage() {
  const [programs,     setPrograms]     = useState<Program[]>([])
  const [coaches,      setCoaches]      = useState<Coach[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [selected,     setSelected]     = useState<Program | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [filterCoach,  setFilterCoach]  = useState<string>('all')
  const [config,       setConfig]       = useState<WtaConfig>({ session_threshold: 8, sat_surcharge: 0, sun_surcharge: 0 })
  const [savingConfig, setSavingConfig] = useState(false)
  const [configEdit,   setConfigEdit]   = useState<WtaConfig | null>(null)

  const [form, setForm] = useState({
    name: '', ratio: '1:1', max_students: 1, unit_minutes: 60,
    description: '', customRatio: '', coach_id: '',
    default_amount: 0, per_session_price: 0, sort_order: 0,
  })
  const [useCustom, setUseCustom] = useState(false)

  const load = async () => {
    setLoading(true)
    const [pRes, cRes, cfgRes] = await Promise.all([
      fetch('/api/programs'),
      fetch('/api/coaches'),
      fetch('/api/config'),
    ])
    const p   = await pRes.json()
    const c   = await cRes.json()
    const cfg = await cfgRes.json()
    setPrograms(Array.isArray(p) ? p : [])
    setCoaches(Array.isArray(c)  ? c : [])
    if (cfg && !cfg.error) setConfig(cfg)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filteredPrograms = programs.filter(p => {
    if (filterCoach === 'all')    return true
    if (filterCoach === 'common') return p.coach_id === null
    return p.coach_id === filterCoach
  })

  const handleAdd = async () => {
    if (!form.name) return alert('프로그램 이름을 입력해주세요')
    const ratio = useCustom ? form.customRatio : form.ratio
    if (!ratio) return alert('비율을 선택하거나 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/programs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, ratio, max_students: form.max_students,
        unit_minutes: form.unit_minutes, description: form.description,
        coach_id: form.coach_id || null,
        default_amount:    form.default_amount,
        per_session_price: form.per_session_price,  // ✅
        sort_order: form.sort_order,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setShowAdd(false)
    setForm({ name: '', ratio: '1:1', max_students: 1, unit_minutes: 60, description: '', customRatio: '', coach_id: '', default_amount: 0, per_session_price: 0, sort_order: 0 })
    setUseCustom(false)
    load()
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/programs/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: selected.name, ratio: selected.ratio,
        max_students: selected.max_students, unit_minutes: selected.unit_minutes,
        description: selected.description, coach_id: selected.coach_id,
        default_amount:    selected.default_amount,
        per_session_price: selected.per_session_price,  // ✅
        sort_order: selected.sort_order,
      }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleToggle = async (id: string) => {
    await fetch(`/api/programs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_active' }) })
    load(); setSelected(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 프로그램을 삭제할까요?')) return
    await fetch(`/api/programs/${id}`, { method: 'DELETE' })
    load(); setSelected(null)
  }

  const handleSaveConfig = async () => {
    if (!configEdit) return
    setSavingConfig(true)
    await fetch('/api/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configEdit),
    })
    setSavingConfig(false)
    setConfig(configEdit)
    setConfigEdit(null)
  }

  const coachName = (id: string | null) => id ? coaches.find(c => c.id === id)?.name ?? null : null

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
    border: '1.5px solid #e5e7eb', fontSize: '0.875rem',
    fontFamily: 'Noto Sans KR, sans-serif', outline: 'none',
    boxSizing: 'border-box', color: '#111827',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>수업 프로그램</h1>
        <button onClick={() => setShowAdd(true)}
          style={{ marginLeft: 'auto', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 프로그램 추가
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* ── 요금 기준 설정 ✅ ── */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #dbeafe', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>⚙️ 요금 기준 설정</div>
            {configEdit ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setConfigEdit(null)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
                <button onClick={handleSaveConfig} disabled={savingConfig}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: savingConfig ? '#e5e7eb' : '#1d4ed8', color: savingConfig ? '#9ca3af' : 'white', cursor: savingConfig ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {savingConfig ? '저장 중...' : '저장'}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfigEdit({ ...config })}
                style={{ padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>수정</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { key: 'session_threshold', label: '월정액 기준 횟수', unit: '회 이상', hint: '이 횟수 이상이면 월정액 적용' },
              { key: 'sat_surcharge',     label: '토요일 추가금',    unit: '원',    hint: '토요일 수업 1회 이상 시 고정 추가' },
              { key: 'sun_surcharge',     label: '일요일 추가금',    unit: '원',    hint: '일요일 수업 1회 이상 시 고정 추가' },
            ].map(({ key, label, unit, hint }) => (
              <div key={key} style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '0.875rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', marginBottom: '4px' }}>{label}</div>
                {configEdit ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="number" min="0"
                      value={(configEdit as any)[key] ?? 0}
                      onChange={e => setConfigEdit(c => c ? { ...c, [key]: Number(e.target.value) } : c)}
                      style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1.5px solid #bfdbfe', borderRadius: '0.375rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', minWidth: 0 }} />
                    <span style={{ fontSize: '0.72rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{unit}</span>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#1e40af' }}>
                    {fmt((config as any)[key])}<span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280', marginLeft: '2px' }}>{unit}</span>
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '4px' }}>{hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 안내 배너 */}
        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1.5px solid #93c5fd', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e40af', marginBottom: '4px' }}>📌 프로그램 구분 방식</div>
          <div style={{ fontSize: '0.8rem', color: '#1d4ed8', lineHeight: 1.7 }}>
            • <strong>공통 프로그램</strong> — 모든 코치에게 표시 (코치 미지정)<br/>
            • <strong>코치 전용 프로그램</strong> — 해당 코치를 선택할 때만 표시<br/>
            • <strong>기준 횟수({config.session_threshold}회) 이상</strong> → 월정액 / 미만 → 회당 단가 × 횟수
          </div>
        </div>

        {/* 코치 필터 탭 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',    label: `전체 (${programs.length})` },
            { key: 'common', label: `공통 (${programs.filter(p => !p.coach_id).length})` },
            ...coaches.map(c => ({ key: c.id, label: `${c.name} (${programs.filter(p => p.coach_id === c.id).length})` })),
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilterCoach(tab.key)}
              style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: `1.5px solid ${filterCoach === tab.key ? '#16A34A' : '#e5e7eb'}`, background: filterCoach === tab.key ? '#f0fdf4' : 'white', color: filterCoach === tab.key ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filteredPrograms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎾</div>
            <p style={{ fontSize: '0.9rem' }}>등록된 프로그램이 없습니다</p>
            <button onClick={() => setShowAdd(true)}
              style={{ marginTop: '1rem', padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              + 첫 프로그램 추가
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.875rem' }}>
            {filteredPrograms.map(p => (
              <div key={p.id} onClick={() => setSelected(p)}
                style={{ background: 'white', borderRadius: '1rem', border: `1.5px solid ${p.is_active ? '#e5e7eb' : '#f3f4f6'}`, padding: '1.25rem', cursor: 'pointer', opacity: p.is_active ? 1 : 0.55, transition: 'box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#16A34A' }}>{p.ratio}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: p.is_active ? '#dcfce7' : '#fee2e2', color: p.is_active ? '#15803d' : '#b91c1c' }}>
                      {p.is_active ? '운영중' : '중단'}
                    </span>
                    {p.coach_id ? (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#eff6ff', color: '#1d4ed8' }}>
                        🎾 {coachName(p.coach_id) ?? '코치'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#f3f4f6', color: '#6b7280' }}>공통</span>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '4px' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>최대 {p.max_students}명 · {p.unit_minutes}분</div>
                {/* ✅ 요금 표시 */}
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {p.default_amount > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>
                      월정액: {fmt(p.default_amount)}원
                    </div>
                  )}
                  {p.per_session_price > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700 }}>
                      회당: {fmt(p.per_session_price)}원
                    </div>
                  )}
                </div>
                {p.description && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{p.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 추가 모달 ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '520px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>프로그램 추가</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>프로그램 이름 <span style={{ color: '#ef4444' }}>*</span></label>
                <input style={inputStyle} placeholder="예) 개인레슨, 패밀리레슨" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>적용 대상</label>
                <select style={inputStyle} value={form.coach_id}
                  onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}>
                  <option value="">🌐 공통 프로그램 (전체 코치)</option>
                  {coaches.map(c => <option key={c.id} value={c.id}>🎾 {c.name} 코치 전용</option>)}
                </select>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '4px' }}>공통: 모든 코치에게 표시 / 코치 전용: 해당 코치 선택 시에만 표시</div>
              </div>
              <div>
                <label style={labelStyle}>수업 비율 (코치:학생)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {PRESET_RATIOS.map(r => (
                    <button key={r} onClick={() => { setUseCustom(false); setForm(f => ({ ...f, ratio: r })) }}
                      style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${!useCustom && form.ratio === r ? '#16A34A' : '#e5e7eb'}`, background: !useCustom && form.ratio === r ? '#f0fdf4' : 'white', color: !useCustom && form.ratio === r ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {r}
                    </button>
                  ))}
                  <button onClick={() => setUseCustom(true)}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${useCustom ? '#16A34A' : '#e5e7eb'}`, background: useCustom ? '#f0fdf4' : 'white', color: useCustom ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>직접입력</button>
                </div>
                {useCustom && <input style={inputStyle} placeholder="예: 2:3" value={form.customRatio} onChange={e => setForm(f => ({ ...f, customRatio: e.target.value }))} />}
              </div>
              <div>
                <label style={labelStyle}>최대 학생 수</label>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {[1,2,3,4,5,6].map(n => (
                    <button key={n} onClick={() => setForm(f => ({ ...f, max_students: n }))}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: `1.5px solid ${form.max_students === n ? '#16A34A' : '#e5e7eb'}`, background: form.max_students === n ? '#f0fdf4' : 'white', color: form.max_students === n ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                      {n}명
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>회당 수업 시간</label>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {[30,45,60,90,120].map(u => (
                    <button key={u} onClick={() => setForm(f => ({ ...f, unit_minutes: u }))}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: `1.5px solid ${form.unit_minutes === u ? '#16A34A' : '#e5e7eb'}`, background: form.unit_minutes === u ? '#f0fdf4' : 'white', color: form.unit_minutes === u ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
                      {u}분
                    </button>
                  ))}
                </div>
              </div>
              {/* ✅ 요금 입력 */}
              <div style={{ background: '#f0fdf4', borderRadius: '0.75rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>💰 요금 설정</div>
                <div>
                  <label style={labelStyle}>월정액 ({config.session_threshold}회 이상, 원)</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0"
                    value={form.default_amount || ''}
                    onChange={e => setForm(f => ({ ...f, default_amount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={labelStyle}>회당 단가 ({config.session_threshold}회 미만 시, 원)</label>
                  <input type="number" style={inputStyle} placeholder="0" min="0"
                    value={form.per_session_price || ''}
                    onChange={e => setForm(f => ({ ...f, per_session_price: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>표시 순서 (숫자 작을수록 위에 표시)</label>
                <input type="number" style={inputStyle} placeholder="0" min="0" value={form.sort_order || ''}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>설명 (선택)</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                  placeholder="프로그램 특징, 대상, 주의사항 등" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setShowAdd(false)}
                  style={{ flex: 1, padding: '0.875rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
                <button onClick={handleAdd} disabled={saving}
                  style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {saving ? '저장 중...' : '+ 프로그램 추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 수정 모달 ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '520px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700 }}>프로그램 수정</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleToggle(selected.id)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${selected.is_active ? '#fca5a5' : '#86efac'}`, background: selected.is_active ? '#fef2f2' : '#f0fdf4', color: selected.is_active ? '#b91c1c' : '#15803d', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {selected.is_active ? '중단' : '운영 재개'}
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>프로그램 이름</label>
                <input style={inputStyle} value={selected.name} onChange={e => setSelected(s => s ? { ...s, name: e.target.value } : s)} />
              </div>
              <div>
                <label style={labelStyle}>적용 대상</label>
                <select style={inputStyle} value={selected.coach_id ?? ''}
                  onChange={e => setSelected(s => s ? { ...s, coach_id: e.target.value || null } : s)}>
                  <option value="">🌐 공통 프로그램 (전체 코치)</option>
                  {coaches.map(c => <option key={c.id} value={c.id}>🎾 {c.name} 코치 전용</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>수업 비율</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {PRESET_RATIOS.map(r => (
                    <button key={r} onClick={() => setSelected(s => s ? { ...s, ratio: r } : s)}
                      style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${selected.ratio === r ? '#16A34A' : '#e5e7eb'}`, background: selected.ratio === r ? '#f0fdf4' : 'white', color: selected.ratio === r ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>최대 인원</label>
                  <input type="number" style={inputStyle} min="1" value={selected.max_students}
                    onChange={e => setSelected(s => s ? { ...s, max_students: Number(e.target.value) } : s)} />
                </div>
                <div>
                  <label style={labelStyle}>회당 시간(분)</label>
                  <input type="number" style={inputStyle} min="30" step="15" value={selected.unit_minutes}
                    onChange={e => setSelected(s => s ? { ...s, unit_minutes: Number(e.target.value) } : s)} />
                </div>
              </div>
              {/* ✅ 요금 수정 */}
              <div style={{ background: '#f0fdf4', borderRadius: '0.75rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>💰 요금 설정</div>
                <div>
                  <label style={labelStyle}>월정액 ({config.session_threshold}회 이상, 원)</label>
                  <input type="number" style={inputStyle} min="0" value={selected.default_amount ?? 0}
                    onChange={e => setSelected(s => s ? { ...s, default_amount: Number(e.target.value) } : s)} />
                </div>
                <div>
                  <label style={labelStyle}>회당 단가 ({config.session_threshold}회 미만 시, 원)</label>
                  <input type="number" style={inputStyle} min="0" value={selected.per_session_price ?? 0}
                    onChange={e => setSelected(s => s ? { ...s, per_session_price: Number(e.target.value) } : s)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>표시 순서</label>
                <input type="number" style={inputStyle} min="0" value={selected.sort_order ?? 0}
                  onChange={e => setSelected(s => s ? { ...s, sort_order: Number(e.target.value) } : s)} />
              </div>
              <div>
                <label style={labelStyle}>설명</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                  value={selected.description ?? ''} onChange={e => setSelected(s => s ? { ...s, description: e.target.value } : s)} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setSelected(null)}
                  style={{ flex: 1, padding: '0.875rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}