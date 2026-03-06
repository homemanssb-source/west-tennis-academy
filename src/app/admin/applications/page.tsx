'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Application {
  id: string; name: string; phone: string; birth_date: string | null
  address: string | null; emergency_contact: string | null
  health_notes: string | null; desired_schedule: string | null
  status: string; created_at: string
}

export default function AdminApplicationsPage() {
  const [apps, setApps]         = useState<Application[]>([])
  const [status, setStatus]     = useState('pending')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Application | null>(null)
  const [processing, setProcessing] = useState(false)
  const [tempPin, setTempPin]   = useState('')

  const load = async (s: string) => {
    setLoading(true)
    const res = await fetch(`/api/applications?status=${s}`)
    const data = await res.json()
    setApps(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load(status) }, [status])

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selected) return
    setProcessing(true)
    const res = await fetch(`/api/applications/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    setProcessing(false)
    if (!res.ok) return alert(data.error)
    if (action === 'approve' && data.temp_pin) setTempPin(data.temp_pin)
    else { setSelected(null); load(status) }
  }

  const statusLabel: Record<string, string> = { pending: '대기중', approved: '승인됨', rejected: '거절됨' }
  const fmt = (d: string) => new Date(d).toLocaleDateString('ko-KR')

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/admin" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>회원 가입서</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {['pending','approved','rejected'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: status === s ? '#15803d' : '#f3f4f6', color: status === s ? 'white' : '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        : apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p>{statusLabel[status]} 신청이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {apps.map(app => (
              <div key={app.id} onClick={() => setSelected(app)}
                style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{app.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{app.phone} · {fmt(app.created_at)}</div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
                  background: status === 'pending' ? '#fef9c3' : status === 'approved' ? '#dcfce7' : '#fee2e2',
                  color: status === 'pending' ? '#854d0e' : status === 'approved' ? '#15803d' : '#b91c1c' }}>
                  {statusLabel[status]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && !tempPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>가입서 상세</h2>
            {[
              { label: '이름', value: selected.name },
              { label: '전화번호', value: selected.phone },
              { label: '생년월일', value: selected.birth_date ?? '-' },
              { label: '주소', value: selected.address ?? '-' },
              { label: '비상연락처', value: selected.emergency_contact ?? '-' },
              { label: '건강 특이사항', value: selected.health_notes ?? '-' },
              { label: '희망 수업일정', value: selected.desired_schedule ?? '-' },
              { label: '신청일', value: fmt(selected.created_at) },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ width: '90px', flexShrink: 0, fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{row.value}</span>
              </div>
            ))}
            {selected.status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button onClick={() => handleAction('reject')} disabled={processing}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>거절</button>
                <button onClick={() => handleAction('approve')} disabled={processing}
                  style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#15803d', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {processing ? '처리 중...' : '✅ 승인 → 회원 등록'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tempPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>승인 완료!</h3>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>임시 PIN</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: '#16A34A', letterSpacing: '6px' }}>{tempPin}</div>
            </div>
            <button onClick={() => { setTempPin(''); setSelected(null); load(status) }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>확인</button>
          </div>
        </div>
      )}
    </div>
  )
}
