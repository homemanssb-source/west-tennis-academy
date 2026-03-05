'use client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Slot {
  id: string
  scheduled_at: string
  status: string
  is_makeup?: boolean
  is_extra?: boolean
  duration_min?: number
}

interface Props {
  slots: Slot[]
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
  pending: '대기',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-[#EAF3EA] text-[#1B4D2E]',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-50 text-red-500',
  pending: 'bg-amber-50 text-amber-600',
}

export default function LessonSlotGrid({ slots }: Props) {
  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[#5A8A5A]">
        이번 달 레슨이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {slots.map(slot => (
        <div key={slot.id} className="wta-card flex items-center gap-4">
          <div className="font-mono text-sm font-bold text-[#1B4D2E] w-20 flex-shrink-0">
            {format(new Date(slot.scheduled_at), 'M/d (EEE)', { locale: ko })}
          </div>
          <div className="font-mono text-sm text-[#2A5A2A] w-12 flex-shrink-0">
            {format(new Date(slot.scheduled_at), 'HH:mm')}
          </div>
          <div className="flex-1 text-xs text-[#5A8A5A]">
            {slot.duration_min ?? 60}분
            {slot.is_makeup && <span className="ml-1 text-[#C85A1E]">· 보강</span>}
            {slot.is_extra && <span className="ml-1 text-amber-600">· 추가</span>}
          </div>
          <span className={`text-xs px-2 py-1 rounded-lg ${STATUS_COLOR[slot.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {STATUS_LABEL[slot.status] ?? slot.status}
          </span>
        </div>
      ))}
    </div>
  )
}
