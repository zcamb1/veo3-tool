/**
 * API Endpoint: GET /api/gmail-accounts/unassigned
 *
 * Không hậu tố pool → trả full (accounts_web1 + accounts_web2 + accounts đủ).
 * Hoặc ?pool=web1 | web2 (tùy chọn) để chỉ một pool.
 *
 * Chỉ một pool qua path: GET .../unassigned/web1 hoặc .../unassigned/web2
 * (xem app/api/gmail-accounts/unassigned/[pool]/route.ts)
 *
 * ?limit=N — chỉ khi truyền mới giới hạn; không truyền = lấy full unassigned.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  handleUnassignedGmailGet,
  type PoolFilter,
} from '@/lib/gmail-unassigned-handler'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const poolRaw = (searchParams.get('pool') || '').toLowerCase()
  if (poolRaw && poolRaw !== 'web1' && poolRaw !== 'web2') {
    return NextResponse.json(
      { success: false, error: 'Invalid pool (use web1, web2, or omit)' },
      { status: 400 }
    )
  }
  return handleUnassignedGmailGet(request, poolRaw as PoolFilter)
}
