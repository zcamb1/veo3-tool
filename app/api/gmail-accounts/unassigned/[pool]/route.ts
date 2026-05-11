/**
 * GET /api/gmail-accounts/unassigned/web1  → chỉ pool web1
 * GET /api/gmail-accounts/unassigned/web2  → chỉ pool web2
 *
 * Query ?limit= & ?active= vẫn dùng được giống route gốc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleUnassignedGmailGet } from '@/lib/gmail-unassigned-handler'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { pool: string } }
) {
  const pool = params.pool.toLowerCase()
  if (pool !== 'web1' && pool !== 'web2') {
    return NextResponse.json(
      { success: false, error: 'Use /unassigned/web1 or /unassigned/web2' },
      { status: 404 }
    )
  }
  return handleUnassignedGmailGet(request, pool)
}
