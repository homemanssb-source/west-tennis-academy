import { supabaseAdmin } from '@/lib/supabase-admin'
import webpush from 'web-push'

// ✅ 모듈 레벨에서 1회만 설정 (기존: sendPushToUser 호출마다 재설정)
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(
  profile_id: string,
  title: string,
  body: string,
  link = '/'
) {
  try {
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('profile_id', profile_id)

    if (!subs || subs.length === 0) return

    const payload = JSON.stringify({ title, body, link })
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )
  } catch {}
}