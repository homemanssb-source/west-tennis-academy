export interface Profile {
  id: string
  phone: string
  name: string
  display_name?: string
  role: 'member' | 'coach' | 'payment_manager' | 'admin'
  is_active: boolean
  is_primary: boolean
  parent_id?: string
  coach_id?: string
  pin_code?: string
  lesson_type?: string
  preferred_days?: string[]
  preferred_times?: string[]
  created_at: string
}
