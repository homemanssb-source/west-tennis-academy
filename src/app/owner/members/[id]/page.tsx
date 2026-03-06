'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface MemberDetail {
  member: { id: string; name: string; phone: string; sinceDate: string; coach: { name: string } | null }
  stats: { totalLessons: number; completedLessons: number; absentLessons: number; makeupLessons: number; attendanceRate: number; totalPaid: number; totalUnpaid: number }
  plans: any[]
  family: any[]
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data,    setData]    = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'history'|'plans'>('history')

  useEffect(() => {
    fetch(`/api/members/${id}`).then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [id])

  const fmt = (n: number) => n?.toLocaleString('ko-KR')

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
  if (!data)   return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>회원 정보 없음</div>

  const { member, stats, plans, family } = data

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: '#7e22ce', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/owner/members" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none', fontSize: '0.875rem' }}>‹ 회원 목록</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.875rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👤</div>
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>{member.name}</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.8rem', marginTop: '2px' }}>
                {member.phone} · {member.sinceDate}부터
                {member.coach && ` · ${member.coach.name} 코치`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: '총 수업', value: stats.totalLessons,     unit: '회', color: '#7e22ce', bg: '#fdf4ff' },
            { label: '완료',    value: stats.completedLessons, unit: '회', color: '#1d4ed8', bg: '#eff6ff' },
            { label: '출석률',  value: stats.attendanceRate,   unit: '%',  color: '#15803d', bg: '#f0fdf4' },
            { label: '미납',    value: stats.totalUnpaid,      unit: '원', color: '#b91c1c', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: s.unit === '원' ? '1.25rem' : '1.75rem', fontWeight: 700, color: s.color }}>
                {s.unit === '원' ? fmt(s.value) : s.value}{s.unit !== '원' ? s.unit : ''}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: s.color, marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 출석률 바 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>
            <span>수업 현황</span>
            <span style={{ color: '#7e22ce' }}>{stats.attendanceRate}% 출석</span>
          </div>
          <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.75rem' }}>
            <div style={{ height: '100%', width: `${stats.attendanceRate}%`, background: '#7e22ce', borderRadius: '9999px' }}></div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
            <span>✅ 완료 {stats.completedLessons}회</span>
            <span>❌ 결석 {stats.absentLessons}회</span>
            <span>🔁 보강 {stats.makeupLessons}회</span>
          </div>
        </div>

        {/* 납부 요약 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ background: '#f0fdf4', borderRadius: '1rem', border: '1.5px solid #86efac', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>총 완납액</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{fmt(stats.totalPaid)}원</div>
          </div>
          <div style={{ background: '#fef2f2', borderRadius: '1rem', border: '1.5px solid #fecaca', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미납액</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c' }}>{fmt(stats.totalUnpaid)}원</div>
          </div>
        </div>

        {/* 가족 구성원 */}
        {family.length > 0 && (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.875rem', color: '#111827' }}>가족 구성원</div>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {family.map((f: any) => (
                <div key={f.id} style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff', borderRadius: '0.75rem', padding: '0.5rem 0.875rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7e22ce' }}>{f.name}</div>
                  {f.birth_date && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{f.birth_date}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {([['history','수업 이력'], ['plans','레슨 플랜']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: `1.5px solid ${tab === t ? '#7e22ce' : '#e5e7eb'}`, background: tab === t ? '#fdf4ff' : 'white', color: tab === t ? '#7e22ce' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'plans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {plans.map((p: any) => (
              <div key={p.id} style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{p.month?.year}년 {p.month?.month}월</span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>{p.lesson_type}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2', color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                    {p.payment_status === 'paid' ? '완납' : '미납'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                  <span>🎾 {p.coach?.name} 코치</span>
                  <span>📅 {p.completed_count}/{p.total_count}회</span>
                  <span>💰 {fmt(p.amount)}원</span>
                </div>
                <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden', marginTop: '0.75rem' }}>
                  <div style={{ height: '100%', width: `${p.total_count > 0 ? Math.round(p.completed_count / p.total_count * 100) : 0}%`, background: '#7e22ce', borderRadius: '9999px' }}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {plans.flatMap((p: any) => (p.slots ?? []).map((s: any) => ({ ...s, lessonType: p.lesson_type, coachName: p.coach?.name, monthYear: `${p.month?.year}년 ${p.month?.month}월` })))
              .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
              .map((s: any) => {
                const ST: Record<string, { bg: string; color: string; label: string }> = {
                  scheduled: { bg: '#f0fdf4', color: '#15803d', label: '예정' },
                  completed: { bg: '#eff6ff', color: '#1d4ed8', label: '완료' },
                  absent:    { bg: '#fef2f2', color: '#b91c1c', label: '결석' },
                  makeup:    { bg: '#fdf4ff', color: '#7e22ce', label: '보강' },
                }
                const st = ST[s.status] ?? ST.scheduled
                return (
                  <div key={s.id} style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '0.875rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                        {new Date(s.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} {new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.lessonType} · {s.coachName} 코치</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: st.bg, color: st.color }}>
                      {s.is_makeup && '🔁 '}{st.label}
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
