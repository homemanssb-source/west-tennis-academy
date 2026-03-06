'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface UnregMember {
  id: string
  name: string
  phone: string
  coach: string | null
}

interface Data {
  unregistered: UnregMember[]
  thisMonth: { year: number; month: number }
  prevMonth: { year: number; month: number }
}

export default function UnregisteredPage() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string>('')

  useEffect(() => {
    fetch('/api/unregistered').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  const sendNotif = async (memberId: string, name: string) => {
    setSending(memberId)
    await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets: [memberId],
        title: `📢 ${data?.thisMonth.year}년 ${data?.thisMonth.month}월 레슨 등록 안내`,
        body: `${name}님, 이번 달 레슨이 아직 등록되지 않았습니다. 확인 부탁드립니다.`,
        type: 'warning',
        link: '/member/schedule',
      }),
    })
    setSending('')
    alert(`${name}님에게 알림을 보냈습니다`)
  }

  const sendAll = async () => {
    if (!data?.unregistered.length) return
    if (!confirm(`${data.unregistered.length}명 전체에게 알림을 보낼까요?`)) return
    setSending('all')
    for (const m of data.unregistered) {
      await sendNotif(m.id, m.name)
    }
    setSending('')
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>미등록 회원 탐지</h1>
        {data && data.unregistered.length > 0 && (
          <button onClick={sendAll} disabled={sending === 'all'} style={{ marginLeft: 'auto', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {sending === 'all' ? '발송 중...' : '📢 전체 알림'}
          </button>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
        {data && (
          <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#854d0e', fontWeight: 600 }}>
            📅 {data.prevMonth.year}년 {data.prevMonth.month}월에 수업이 있었지만 {data.thisMonth.year}년 {data.thisMonth.month}월 레슨이 미등록된 회원입니다
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : !data?.unregistered.length ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem' }}>모든 회원이 등록되었습니다!</div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>이번 달 레슨 미등록 회원이 없습니다</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미등록 회원 {data.unregistered.length}명</div>
            {data.unregistered.map(m => (
              <div key={m.id} style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                    {m.phone}{m.coach && ` · ${m.coach} 코치`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={`/owner/members/${m.id}`}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none' }}>
                    상세
                  </Link>
                  <button onClick={() => sendNotif(m.id, m.name)} disabled={sending === m.id}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {sending === m.id ? '...' : '📢 알림'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
