import 'server-only'
import { createClient } from '@supabase/supabase-js'

// ⚠️ 절대 클라이언트 컴포넌트에서 import 금지
// API route / Server Component 에서만 사용 (server-only 로 빌드타임 가드)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
