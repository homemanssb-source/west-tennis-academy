export type Role = 'owner' | 'admin' | 'coach' | 'payment' | 'member'

export interface Profile {
  id: string
  name: string
  phone: string
  role: Role
  pin_must_change: boolean
  is_owner: boolean
  is_active: boolean
  coach_id: string | null
  created_at: string
}

export interface MemberApplication {
  id: string
  name: string
  phone: string
  birth_date: string | null
  address: string | null
  emergency_contact: string | null
  health_notes: string | null
  desired_schedule: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Month {
  id: string
  year: number
  month: number
  start_date: string
  end_date: string
}

export interface LessonPlan {
  id: string
  member_id: string
  coach_id: string
  month_id: string
  lesson_type: string
  total_count: number
  completed_count: number
  payment_status: 'unpaid' | 'paid'
  amount: number
  unit_minutes: number
  created_at: string
}

export interface LessonSlot {
  id: string
  lesson_plan_id: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'absent' | 'makeup'
  slot_type: 'lesson' | 'break'
  is_makeup: boolean
  memo: string | null
  created_at: string
}

export interface CoachBlock {
  id: string
  coach_id: string
  block_date: string
  block_start: string | null
  block_end: string | null
  reason: string | null
}

// 세션 쿠키에 저장할 유저 정보
export interface SessionUser {
  id: string
  name: string
  role: Role
  is_owner: boolean
}
