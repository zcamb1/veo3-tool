import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || ''

if (!JWT_SECRET) {
  console.error('❌ [CRITICAL] JWT_SECRET not found in environment variables!')
}

/**
 * Track Usage API
 * 
 * Endpoint: POST /api/users/track-usage
 * Headers: Authorization: Bearer <token>
 * Body: { characters_used: number }
 * 
 * Returns:
 * - 200: Usage tracked successfully
 * - 400: Bad request (missing characters_used or invalid)
 * - 401: Unauthorized
 * - 403: Quota exceeded
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    // ============================================
    // STEP 1: Extract and verify JWT token
    // ============================================
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [TRACK USAGE] No token provided')
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const body = await request.json()
    const { characters_used } = body

    // Validate input
    if (typeof characters_used !== 'number' || characters_used <= 0) {
      console.log('❌ [TRACK USAGE] Invalid characters_used:', characters_used)
      return NextResponse.json(
        { success: false, error: 'Invalid characters_used value' },
        { status: 400 }
      )
    }

    let payload: any
    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    } catch (error: any) {
      console.log('❌ [TRACK USAGE] Invalid token:', error.message)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    console.log('📊 [TRACK USAGE] Tracking usage for user:', payload.username)
    console.log('   Characters:', characters_used.toLocaleString())

    // ============================================
    // STEP 2: Get user data from database
    // ============================================
    const { data: users, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, username, monthly_char_limit, current_month_usage, usage_reset_date')
      .eq('id', payload.user_id)
      .limit(1)

    if (queryError) {
      console.error('❌ [TRACK USAGE] Database error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('❌ [TRACK USAGE] User not found')
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const user = users[0]

    // ============================================
    // STEP 3: Check if user is unlimited
    // ============================================
    if (user.monthly_char_limit === null) {
      // Unlimited user - no tracking needed
      console.log('✅ [TRACK USAGE] User is unlimited - skipping tracking')
      return NextResponse.json({
        success: true,
        message: 'Usage tracked (unlimited user)',
        quota: {
          is_unlimited: true,
          remaining: null,
          exceeded: false
        }
      })
    }

    // ============================================
    // STEP 4: Check and reset usage if needed
    // ============================================
    let currentUsage = user.current_month_usage || 0
    let resetDate = user.usage_reset_date

    const now = new Date()
    const shouldReset = !resetDate || new Date(resetDate) <= now

    if (shouldReset) {
      console.log('🔄 [TRACK USAGE] Resetting monthly usage before tracking')
      currentUsage = 0
      resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    }

    // ============================================
    // STEP 5: Calculate new usage and check quota
    // ============================================
    const newUsage = currentUsage + characters_used
    const monthlyLimit = user.monthly_char_limit
    const remaining = Math.max(0, monthlyLimit - newUsage)
    const exceeded = newUsage > monthlyLimit

    console.log('📈 [TRACK USAGE] Quota calculation:')
    console.log('   Previous usage:', currentUsage.toLocaleString())
    console.log('   New usage:', newUsage.toLocaleString())
    console.log('   Limit:', monthlyLimit.toLocaleString())
    console.log('   Remaining:', remaining.toLocaleString())
    console.log('   Exceeded:', exceeded)

    // ============================================
    // STEP 6: Update usage in database
    // ============================================
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        current_month_usage: newUsage,
        usage_reset_date: resetDate,
        last_usage_update: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ [TRACK USAGE] Failed to update usage:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update usage' },
        { status: 500 }
      )
    }

    console.log('✅ [TRACK USAGE] Usage updated successfully')

    // ============================================
    // STEP 7: Return response
    // ============================================
    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
      quota: {
        is_unlimited: false,
        monthly_limit: monthlyLimit,
        current_usage: newUsage,
        remaining: remaining,
        exceeded: exceeded,
        percentage_used: Math.round((newUsage / monthlyLimit) * 1000) / 10,
        reset_date: resetDate
      }
    })

  } catch (error: any) {
    console.error('💥 [TRACK USAGE] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
