import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { sendPushToUser } from './push'

/**
 * 인앱 알림(notifications 테이블) + 브라우저 푸시를 한 번에 발송.
 * 정책: 상태 변경·승인·거절 등 사용자가 알아야 하는 이벤트는 이 헬퍼만 사용.
 *
 * 실패해도 호출자 로직을 중단시키지 않는다(try/catch 내부 swallow).
 */
export async function notify(
  userId: string,
  opts: {
    title: string
    body: string
    link?: string
    /** true 이면 push 만 (DB notifications 생성 안 함) */
    pushOnly?: boolean
    /** true 이면 DB 저장만 (push 발송 안 함) */
    dbOnly?: boolean
  }
) {
  const { title, body, link = '/', pushOnly, dbOnly } = opts

  const tasks: Promise<unknown>[] = []

  if (!pushOnly) {
    tasks.push(
      Promise.resolve(
        supabaseAdmin
          .from('notifications')
          .insert({ profile_id: userId, title, body, link, type: 'info' })
      ).then(() => undefined, () => undefined)
    )
  }
  if (!dbOnly) {
    tasks.push(sendPushToUser(userId, title, body, link).catch(() => undefined))
  }

  await Promise.allSettled(tasks)
}
