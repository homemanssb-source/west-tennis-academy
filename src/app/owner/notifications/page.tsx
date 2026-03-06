'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function NotificationsPage() {
  const [target,  setTarget]  = useState('all')
  const [title,   setTitle]   = useState('')
  const [body,    setBody]    = useState('')
  const [type,    setType]    = useState('info')
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState('')

  const handleSend = async () => {
    if (!title || !body) return alert('제목과 내용을 입력해주세요')
    setSaving(true)
    setResult('')
    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: target, title, body, type }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setResult(`✅ ${data.sent}명에게 발송 완료!`)
    setTitle('')
    setBody('')
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>알림 발송</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>발송 대상</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'all',     label: '전체' },
                  { value: 'members', label: '회원만' },
                  { value: 'coaches', label: '코치만' },
                ].map(t => (
                  <button key={t.value} onClick={() => setTarget(t.value)}
                    style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: `1.5px solid ${target === t.value ? '#16A34A' : '#e5e7eb'}`, background: target === t.value ? '#f0fdf4' : 'white', color: target === t.value ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>알림 종류</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { value: 'info',    label: 'ℹ️ 안내' },
                  { value: 'success', label: '✅ 완료' },
                  { value: 'warning', label: '⚠️ 주의' },
                ].map(t => (
                  <button key={t.value} onClick={() => setType(t.value)}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: `1.5px solid ${type === t.value ? '#16A34A' : '#e5e7eb'}`, background: type === t.value ? '#f0fdf4' : 'white', color: type === t.value ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>제목</label>
              <input className="input-base" placeholder="알림 제목" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>내용</label>
              <textarea className="input-base" placeholder="알림 내용" value={body} onChange={e => setBody(e.target.value)} rows={4} style={{ resize: 'none' }} />
            </div>
          </div>

          {result && (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.75rem', padding: '0.875rem', color: '#15803d', fontSize: '0.875rem', fontWeight: 600, marginTop: '1rem' }}>
              {result}
            </div>
          )}

          <button onClick={handleSend} disabled={saving}
            style={{ width: '100%', marginTop: '1rem', padding: '0.875rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {saving ? '발송 중...' : '🔔 알림 발송'}
          </button>
        </div>
      </div>
    </div>
  )
}
