/**
 * Shared handler: GET unassigned Gmail pools (web1 | web2 | full).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export type PoolFilter = '' | 'web1' | 'web2'

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

    const { data: accounts, error: accountsError } = await query

    if (accountsError) {
      console.error('❌ [UNASSIGNED] Error fetching Gmail accounts:', accountsError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    const now = new Date()
    const validAccounts = (accounts || []).filter((acc: { expires_at: string | null }) => {
      if (!acc.expires_at) return true
      return new Date(acc.expires_at) > now
    })

    const expiredCount = (accounts?.length || 0) - validAccounts.length

    console.log(`✅ [UNASSIGNED] Found ${validAccounts.length} unassigned active account(s)`)
    if (expiredCount > 0) {
      console.log(`⚠️ [UNASSIGNED] Filtered out ${expiredCount} expired account(s)`)
    }

    const mapAcc = (acc: {
      id: number
      email: string
      ogg_ticket: string
      status: string
      expires_at: string | null
      created_at: string
      last_updated: string | null
      notes: string | null
    }, pool: 'web1' | 'web2') => ({
      pool,
      id: acc.id,
      email: acc.email,
      ogg_ticket: acc.ogg_ticket,
      status: acc.status,
      expires_at: acc.expires_at,
      created_at: acc.created_at,
      ogg_updated_at: acc.last_updated ?? null,
      notes: acc.notes || null,
    })

    const n = validAccounts.length
    const splitAt = Math.ceil(n / 2)
    const rawWeb1 = validAccounts.slice(0, splitAt)
    const rawWeb2 = validAccounts.slice(splitAt)
    const accounts_web1 = rawWeb1.map((acc) => mapAcc(acc, 'web1'))
    const accounts_web2 = rawWeb2.map((acc) => mapAcc(acc, 'web2'))
    const accountsAll = [...accounts_web1, ...accounts_web2]

    const wantWeb1 = !poolFilter || poolFilter === 'web1'
    const wantWeb2 = !poolFilter || poolFilter === 'web2'
    if (poolFilter && poolFilter !== 'web1' && poolFilter !== 'web2') {
      return NextResponse.json(
        { success: false, error: 'Invalid pool (use web1, web2, or omit)' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      total: n,
      total_web1: accounts_web1.length,
      total_web2: accounts_web2.length,
      accounts_web1: wantWeb1 ? accounts_web1 : [],
      accounts_web2: wantWeb2 ? accounts_web2 : [],
      accounts:
        poolFilter === 'web1'
          ? accounts_web1
          : poolFilter === 'web2'
            ? accounts_web2
            : accountsAll,
      pool: poolFilter || null,
      generated_at: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error('💥 [UNASSIGNED] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
