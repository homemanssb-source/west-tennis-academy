'use client'

import { useState } from 'react'

export default function ApplyPage() {
  const [form, setForm] = useState({
    name: '', phone: '', birth_date: '', address: '',
    emergency_contact: '', health_notes: '', desired_schedule: ''
  })
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  const handlePhone = (v: string) => {
    const num = v.replace(/\D/g,'').slice(0,11)
    const fmt = num.length <= 3 ? num : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}` : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setForm(f => ({ ...f, phone: fmt }))
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.name)  return setError('?대쫫???낅젰?댁＜?몄슂')
    if (!form.phone) return setError('?꾪솕踰덊샇瑜??낅젰?댁＜?몄슂')

    setSaving(true)
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error ?? '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎')
    setDone(true)
  }

  if (done) {
    return (
      <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>?렱</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#16A34A', marginBottom: '0.5rem' }}>?좎껌 ?꾨즺!</div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6 }}>媛???좎껌???묒닔?섏뿀?듬땲??<br/>?대떦???뺤씤 ???곕씫?쒕━寃좎뒿?덈떎.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ?ㅻ뜑 */}
      <div style={{ background: '#16A34A', padding: '2.5rem 1.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>WTA</div>
        <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '0.8rem', marginTop: '2px' }}>?쒕? ?뚮땲???꾩뭅?곕?</div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem', marginTop: '0.75rem' }}>?뚯썝 媛???좎껌??/div>
      </div>

      <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* ?꾩닔 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>湲곕낯 ?뺣낫 <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>* ?꾩닔</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?대쫫 *</label>
              <input className="input-base" placeholder="?띻만?? value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?꾪솕踰덊샇 *</label>
              <input className="input-base" placeholder="010-0000-0000" value={form.phone} onChange={e => handlePhone(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?앸뀈?붿씪</label>
              <input type="date" className="input-base" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* ?좏깮 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>異붽? ?뺣낫 <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>?좏깮</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>二쇱냼</label>
              <input className="input-base" placeholder="?쒖슱??..." value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>鍮꾩긽?곕씫泥?/label>
              <input className="input-base" placeholder="010-0000-0000" value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} inputMode="numeric" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>嫄닿컯 ?뱀씠?ы빆</label>
              <textarea className="input-base" placeholder="遺???대젰, 二쇱쓽?ы빆 ?? value={form.health_notes} onChange={e => setForm(f => ({ ...f, health_notes: e.target.value }))} rows={3} style={{ resize: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?щ쭩 ?섏뾽 ?쇱젙</label>
              <textarea className="input-base" placeholder="?? ?????ㅼ쟾 10?? 二?2???щ쭩" value={form.desired_schedule} onChange={e => setForm(f => ({ ...f, desired_schedule: e.target.value }))} rows={3} style={{ resize: 'none' }} />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: '1rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '2rem' }}>
          {saving ? '?쒖텧 以?..' : '媛???좎껌?섍린'}
        </button>
      </div>
    </div>
  )
}

