/**
 * API Endpoint: GET /api/gmail-accounts/unassigned
 *
 * Purpose: Trả về danh sách Gmail accounts chưa được assign cho user nào.
 * Dùng cho web trung gian để biết tài nguyên còn trống.
 *
 * Bảo mật: X-Api-Key header (lưu trong env INTERNAL_API_KEY)
 *
 * Response:
 * {
 *   success: true,
 *   total: 5,
 *   accounts: [
 *     { id, email, status, expires_at, created_at }
 *   ]
 * }
 *
 * NOTE: ogg_ticket KHÔNG được trả về để tránh lộ credentials.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ============================================
// HELPER: Verify API Key
// ============================================
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-Api-Key')
  const validKey = process.env.INTERNAL_API_KEY

  if (!validKey) {
    console.error('❌ [UNASSIGNED] INTERNAL_API_KEY not set in environment!')
    return false
  }

  return apiKey === validKey
}

// ============================================
// GET: List unassigned Gmail accounts
// ============================================
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate request
    if (!verifyApiKey(request)) {
      console.warn('❌ [UNASSIGNED] Unauthorized access attempt - invalid API key')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Optional query params
    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get('active') !== 'false' // default: true
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    console.log('🔍 [UNASSIGNED] Fetching unassigned Gmail accounts...')

    // 3. Get all Gmail account IDs that ARE assigned (in user_resources)
    const { data: assignedRows, error: assignedError } = await supabaseAdmin
      .from('user_resources')
      .select('gmail_account_id')

    if (assignedError) {
      console.error('❌ [UNASSIGNED] Error fetching assigned accounts:', assignedError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    // Extract assigned IDs (deduplicated)
    const assignedIds = (assignedRows || [])
      .map((r: any) => r.gmail_account_id)
      .filter((id: any, index: number, self: any[]) => self.indexOf(id) === index)

    console.log(`📊 [UNASSIGNED] Currently assigned: ${assignedIds.length} account(s)`)

    // 4. Query Gmail accounts NOT in assignedIds
    let query = supabaseAdmin
      .from('gmail_accounts')
      .select('id, email, status, expires_at, created_at, notes')
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter out assigned accounts
    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    // Filter by active status if requested
    if (onlyActive) {
      query = query.eq('status', 'active')
    }

    const { data: accounts, error: accountsError } = await query

    if (accountsError) {
      console.error('❌ [UNASSIGNED] Error fetching Gmail accounts:', accountsError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    // 5. Filter out expired accounts (expires_at in the past)
    const now = new Date()
    const validAccounts = (accounts || []).filter((acc: any) => {
      if (!acc.expires_at) return true // no expiry = always valid
      return new Date(acc.expires_at) > now
    })

    const expiredCount = (accounts?.length || 0) - validAccounts.length

    console.log(`✅ [UNASSIGNED] Found ${validAccounts.length} unassigned active account(s)`)
    if (expiredCount > 0) {
      console.log(`⚠️ [UNASSIGNED] Filtered out ${expiredCount} expired account(s)`)
    }

    // 6. Return - NO ogg_ticket in response
    return NextResponse.json({
      success: true,
      total: validAccounts.length,
      accounts: validAccounts.map((acc: any) => ({
        id: acc.id,
        email: acc.email,
        status: acc.status,
        expires_at: acc.expires_at,
        created_at: acc.created_at,
        notes: acc.notes || null,
      })),
    })
  } catch (error: any) {
    console.error('💥 [UNASSIGNED] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
