import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { LessonSlot } from '@/types'

const STATUS_CONFIG = {
  scheduled:       { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500'  },
  completed:       { bg: 'bg-green-100', border: 'border-green-300',  dot: 'bg-green-600'  },
  cancelled:       { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500'    },
  draft:           { bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-300'   },
  pending_payment: { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
} as const

export default function LessonSlotGrid({ slots }: { slots: LessonSlot[] }) {
  if (!slots.length) {
    return (
      <div className="text-center py-8 text-sm text-[#5A8A5A]">
        이번 달 예정된 레슨이 없습니다.
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {slots.map(slot => {
          const date = new Date(slot.scheduled_at)
          const cfg = slot.is_extra
            ? { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' }
            : slot.is_makeup
            ? { bg: 'bg-blue-50',  border: 'border-blue-200',  dot: 'bg-blue-500'  }
            : STATUS_CONFIG[slot.status] ?? STATUS_CONFIG.draft

          return (
            <div key={slot.id} className={`rounded-xl p-2 text-center border-[1.5px] ${cfg.bg} ${cfg.border}`}>
              <div className="font-mono text-xs font-medium text-[#0F2010]">
                {format(date, 'MM/dd', { locale: ko })}
              </div>
              <div className="text-[10px] text-[#5A8A5A] mt-0.5">
                {slot.is_extra ? '수업추가' : slot.is_makeup ? '보강' : format(date, 'HH:mm')}
              </div>
              <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${cfg.dot}`} />
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 flex-wrap mt-3 pt-3 border-t border-forest/8">
        {[
          { dot: 'bg-green-500', label: '예정' },
          { dot: 'bg-red-500',   label: '취소' },
          { dot: 'bg-amber-500', label: '수업추가' },
          { dot: 'bg-blue-500',  label: '보강' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-[#5A8A5A]">
            <div className={`w-2 h-2 rounded-sm ${l.dot}`} />
            {l.label}
          </div>
        ))}
      </div>
    </>
  )
}