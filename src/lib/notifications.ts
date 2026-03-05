import { createAdminClient } from '@/lib/supabase/server'

export type NotificationEvent =
  | 'profile_updated'
  | 'makeup_requested'
  | 'makeup_approved'
  | 'makeup_rejected'
  | 'makeup_expired'
  | 'extra_lesson_requested'
  | 'extra_lesson_confirmed'
  | 'extra_lesson_rejected'
  | 'payment_confirmed'
  | 'unpaid_reminder'
  | 'monthly_rollover_complete'
  | 'slot_excluded_by_block'
  | 'discretion_result'

interface NotifyOptions {
  recipientId: string
  phone: string
  event: NotificationEvent
  data?: Record<string, string>
}

const TEMPLATES: Record<NotificationEvent, (d: Record<string, string>) => string> = {
  profile_updated:          (d) => `[서부테니스] 회원 정보가 수정되었습니다.\n변경항목: ${d.field}\n이전: ${d.before} → 이후: ${d.after}`,
  makeup_requested:         (d) => `[서부테니스] ${d.memberName}님 보강 신청\n희망일: ${d.requestedAt}\n앱에서 허용/거절해 주세요.`,
  makeup_approved:          (d) => `[서부테니스] 보강 신청이 허용되었습니다.\n확정일: ${d.confirmedAt}`,
  makeup_rejected:          (d) => `[서부테니스] 보강 신청이 거절되었습니다.\n사유: ${d.reason}`,
  makeup_expired:           ()  => `[서부테니스] 24시간 내 코치 응답이 없어 보강 신청이 만료되었습니다.`,
  extra_lesson_requested:   (d) => `[서부테니스] 수업 추가 요청\n회원: ${d.memberName} / ${d.extraCount}회\n금액 확정이 필요합니다.`,
  extra_lesson_confirmed:   (d) => `[서부테니스] 수업 추가가 확정되었습니다.\n추가 횟수: ${d.extraCount}회 / 금액: ${d.amount}원`,
  extra_lesson_rejected:    ()  => `[서부테니스] 수업 추가 요청이 거절되었습니다.`,
  payment_confirmed:        (d) => `[서부테니스] ${d.monthKey} 결제가 확정되었습니다.\n금액: ${d.amount}원`,
  unpaid_reminder:          (d) => `[서부테니스] ${d.monthKey} 레슨비 미납 안내\n미납액: ${d.amount}원`,
  monthly_rollover_complete:(d) => `[서부테니스] ${d.nextMonth} 레슨이 동일 자리(${d.schedule})로 자동 예약되었습니다.\n변경은 7일 내 앱에서 해주세요.`,
  slot_excluded_by_block:   (d) => `[서부테니스] ${d.date} 코치 휴무로 해당 레슨이 제외되었습니다.`,
  discretion_result:        (d) => `[서부테니스] 코치 재량 처리 결과: ${d.result}\n${d.reason ?? ''}`,
}

async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    console.log(`[SMS] ${phone}: ${message}`)
    // TODO: CoolSMS API 연동
    return true
  } catch {
    return false
  }
}

async function sendPush(recipientId: string, message: string): Promise<boolean> {
  console.log(`[PUSH] ${recipientId}: ${message}`)
  return true
}

export async function notify(options: NotifyOptions): Promise<void> {
  const { recipientId, phone, event, data = {} } = options
  const message = TEMPLATES[event]?.(data) ?? `[서부테니스] 알림이 도착했습니다.`

  const smsOnlyEvents: NotificationEvent[] = [
    'makeup_expired', 'unpaid_reminder', 'monthly_rollover_complete',
  ]
  const channels: string[] = ['sms']
  if (!smsOnlyEvents.includes(event)) channels.push('push')

  await sendSMS(phone, message)
  if (channels.includes('push')) await sendPush(recipientId, message)

  try {
    const supabase = await createAdminClient()
    await supabase.from('notification_logs').insert({
      recipient_id: recipientId,
      phone,
      event_type: event,
      channel: channels,
      message,
      status: 'sent',
    })
  } catch (e) {
    console.error('알람 로그 기록 실패:', e)
  }
}

export async function notifyMany(
  recipients: Array<{ id: string; phone: string }>,
  event: NotificationEvent,
  data?: Record<string, string>
): Promise<void> {
  await Promise.all(
    recipients.map(r => notify({ recipientId: r.id, phone: r.phone, event, data }))
  )
}