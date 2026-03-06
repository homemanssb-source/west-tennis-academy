'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  link: string | null
  created_at: string
}

const TYPE_STYLE: Record<string, { bg: string; color: string; emoji: string }> = {
  info:    { bg: '#eff6ff', color: '#1d4ed8', emoji: 'ℹ️' },
  success: { bg: '#f0fdf4', color: '#15803d', emoji: '✅' },
  warning: { bg: '#fef9c3', color: '#854d0e', emoji: '⚠️' },
  error:   { bg: '#fef2f2', color: '#b91c1c', emoji: '❌' },
}

export default function NotificationBell() {
  const router = useRouter()
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  const unread = notifs.filter(n => !n.is_read).length

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRead = async (n: Notification) => {
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PUT' })
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
    if (n.link) router.push(n.link)
    setOpen(false)
  }

  const fmtDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return '방금'
    if (min < 60) return `${min}분 전`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}시간 전`
    return `${Math.floor(hr / 24)}일 전`
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(!open); if (!open) load() }}
        style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '0.625rem', padding: '0.5rem', cursor: 'pointer', position: 'relative', fontSize: '1.25rem', lineHeight: 1 }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', right: 0, top: '110%', width: '320px', background: 'white', borderRadius: '1rem', boxShadow: '0 10px 40px rgba(0,0,0,.15)', zIndex: 50, overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#111827' }}>알림</span>
              {unread > 0 && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{unread}개 안읽음</span>}
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>불러오는 중...</div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
                  <p style={{ fontSize: '0.875rem' }}>알림이 없습니다</p>
                </div>
              ) : (
                notifs.map(n => {
                  const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.info
                  return (
                    <div key={n.id} onClick={() => handleRead(n)}
                      style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f9fafb', cursor: 'pointer', background: n.is_read ? 'white' : '#f0fdf4', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{s.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.875rem', color: '#111827' }}>{n.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>{n.body}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px' }}>{fmtDate(n.created_at)}</div>
                      </div>
                      {!n.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', flexShrink: 0, marginTop: '4px' }}></div>}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
