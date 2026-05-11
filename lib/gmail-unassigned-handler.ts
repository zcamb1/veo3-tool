/**
 * Shared handler: GET unassigned Gmail pools (web1 | web2 | full).
 *
 * Response (tương thích client cũ): `success`, `total`, `accounts` — mỗi phần tử chỉ
 * { id, email, ogg_ticket, status, expires_at, created_at, notes } như ban đầu.
 * Thêm: `total_web1`, `total_web2`, `accounts_web1`, `accounts_web2` (cùng shape từng phần tử).
 *
 * Hiệu lực tài khoản: ngoài `expires_at` trong DB, nếu đã refresh OGG gần đây
 * (`last_updated` trong vòng ~30 ngày) vẫn tính là dùng được — trùng ý “1 tháng
 * đổ lại khi call API update”.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export type PoolFilter = '' | 'web1' | 'web2'

/** ~1 tháng: coi acc còn “sống” nếu `last_updated` nằm trong cửa sổ này */
const ROLLING_MONTH_MS = 30 * 24 * 60 * 60 * 1000

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-Api-Key')
  const validKey = process.env.INTERNAL_API_KEY

  if (!validKey) {
    console.error('❌ [UNASSIGNED] INTERNAL_API_KEY not set in environment!')
    return false
  }

  return apiKey === validKey
}

export async function handleUnassignedGmailGet(
  request: NextRequest,
  poolFilter: PoolFilter
): Promise<NextResponse> {
  try {
    if (!verifyApiKey(request)) {
      console.warn('❌ [UNASSIGNED] Unauthorized access attempt - invalid API key')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get('active') !== 'false'
    const limitRaw = searchParams.get('limit')
    const limit =
      limitRaw !== null && limitRaw !== ''
        ? parseInt(limitRaw, 10)
        : null

    console.log('🔍 [UNASSIGNED] Fetching unassigned Gmail accounts...')

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

    const assignedIds = (assignedRows || [])
      .map((r: { gmail_account_id: unknown }) => r.gmail_account_id)
      .filter((id: unknown, index: number, self: unknown[]) => self.indexOf(id) === index)

    console.log(`📊 [UNASSIGNED] Currently assigned: ${assignedIds.length} account(s)`)

    let query = supabaseAdmin
      .from('gmail_accounts')
      .select('id, email, ogg_ticket, status, expires_at, created_at, last_updated, notes')
      .order('created_at', { ascending: false })

    if (limit !== null && Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit)
    }

    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    if (onlyActive) {
      query = query.eq('status', 'active')
    }

    const { data: rows, error: accountsError } = await query

    if (accountsError) {
      console.error('❌ [UNASSIGNED] Error fetching Gmail accounts:', accountsError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    const now = new Date()
    const rollingCutoff = new Date(now.getTime() - ROLLING_MONTH_MS)

    const validAccounts = (rows || []).filter(
      (acc: {
        expires_at: string | null
        last_updated: string | null
      }) => {
        if (!acc.expires_at) return true
        if (new Date(acc.expires_at) > now) return true
        if (acc.last_updated && new Date(acc.last_updated) >= rollingCutoff) {
          return true
        }
        return false
      }
    )

    const expiredCount = (rows?.length || 0) - validAccounts.length

    console.log(`✅ [UNASSIGNED] Found ${validAccounts.length} unassigned active account(s)`)
    if (expiredCount > 0) {
      console.log(
        `⚠️ [UNASSIGNED] Filtered out ${expiredCount} account(s) (expires_at quá hạn và không có OGG refresh trong ~30 ngày)`
      )
    }

    const mapLegacy = (acc: {
      id: number
      email: string
      ogg_ticket: string
      status: string
      expires_at: string | null
      created_at: string
      notes: string | null
    }) => ({
      id: acc.id,
      email: acc.email,
      ogg_ticket: acc.ogg_ticket,
      status: acc.status,
      expires_at: acc.expires_at,
      created_at: acc.created_at,
      notes: acc.notes || null,
    })

    const n = validAccounts.length
    const splitAt = Math.ceil(n / 2)
    const rawWeb1 = validAccounts.slice(0, splitAt)
    const rawWeb2 = validAccounts.slice(splitAt)
    const accounts_web1 = rawWeb1.map(mapLegacy)
    const accounts_web2 = rawWeb2.map(mapLegacy)
    const accountsFull = validAccounts.map(mapLegacy)

    const wantWeb1 = !poolFilter || poolFilter === 'web1'
    const wantWeb2 = !poolFilter || poolFilter === 'web2'
    if (poolFilter && poolFilter !== 'web1' && poolFilter !== 'web2') {
      return NextResponse.json(
        { success: false, error: 'Invalid pool (use web1, web2, or omit)' },
        { status: 400 }
      )
    }

    const accounts =
      poolFilter === 'web1'
        ? accounts_web1
        : poolFilter === 'web2'
          ? accounts_web2
          : accountsFull

    return NextResponse.json({
      success: true,
      total: accounts.length,
      accounts,
      total_web1: accounts_web1.length,
      total_web2: accounts_web2.length,
      accounts_web1: wantWeb1 ? accounts_web1 : [],
      accounts_web2: wantWeb2 ? accounts_web2 : [],
    })
  } catch (error: unknown) {
    console.error('💥 [UNASSIGNED] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
