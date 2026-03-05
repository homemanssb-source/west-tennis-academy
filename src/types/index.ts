export type UserRole = 'member' | 'coach' | 'payment_manager' | 'admin'
export type LessonType = 'individual' | 'group_2' | 'group_3' | 'group_4' | 'group_other'
export type SlotStatus = 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'pending_payment'
export type MakeupStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'pending'

export interface LessonSlot {
  id: string
  lesson_plan_id: string
  member_id: string
  coach_id: string
  scheduled_at: string
  duration_min: number
  status: SlotStatus
  is_extra: boolean
  is_makeup: boolean
  cancel_reason: string | null
  cancelled_at: string | null
  court: string | null
}

export const DAY_LABELS: Record<string, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
}

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  individual:  '개인레슨',
  group_2:     '단체 2:1',
  group_3:     '단체 3:1',
  group_4:     '단체 4:1',
  group_other: '그룹(기타)',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: '미납', paid: '완납', partial: '부분납', pending: '대기중',
}