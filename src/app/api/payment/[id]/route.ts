// src/app/api/payment/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_FILE_SIZE = 5 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const status = formData.get('payment_status') as string
    const amount = formData.get('amount') ? Number(formData.get('amount')) : undefined
    const file   = formData.get('receipt') as File | null

    const updateData: Record<string, unknown> = {}
    if (status) updateData.payment_status = status
    if (amount !== undefined) updateData.amount = amount

    const { error: updateErr } = await supabaseAdmin
      .from('lesson_plans')
      .update(updateData)
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    if (file && file.size > 0) {
      if (!ALLOWED_TYPES.includes(file.type as any)) {
        return NextResponse.json(
          { error: '지원하지 않는 파일 형식입니다. (jpg, png, webp만 가능)' },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: '파일 크기는 5MB 이하만 가능합니다.' },
          { status: 400 }
        )
      }

      const ext      = MIME_TO_EXT[file.type] ?? 'jpg'
      const fileName = `receipts/${id}/${Date.now()}.${ext}`
      const buffer   = Buffer.from(await file.arrayBuffer())

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('receipts')
        .upload(fileName, buffer, { contentType: file.type, upsert: false })

      if (!uploadErr) {
        const { data: urlData } = supabaseAdmin.storage
          .from('receipts')
          .getPublicUrl(fileName)

        // ✅ 실제 컬럼명: image_url (file_url 아님)
        await supabaseAdmin.from('payment_receipts').insert({
          lesson_plan_id: id,
          image_url:      urlData.publicUrl,
          uploaded_by:    session.id,
        })
      }
    }

    return NextResponse.json({ ok: true })
  }

  // JSON 방식
  const body = await req.json()
  const { payment_status, amount } = body
  const updateData: Record<string, unknown> = {}
  if (payment_status) updateData.payment_status = payment_status
  if (amount !== undefined) updateData.amount = amount

  const { error } = await supabaseAdmin
    .from('lesson_plans')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, payment_status, amount, lesson_type, total_count, completed_count, unit_minutes, created_at,
      member:member_id ( id, name, phone ),
      coach:coach_id ( id, name ),
      month:month_id ( id, year, month ),
      receipts:payment_receipts ( id, image_url, amount, memo, created_at, uploader:uploaded_by(name) )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
