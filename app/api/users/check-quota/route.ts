import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || ''

if (!JWT_SECRET) {
  console.error('❌ [CRITICAL] JWT_SECRET not found in environment variables!')
}

/**
 * Check User Quota API
 * 
 * Endpoint: GET /api/users/check-quota
 * Headers: Authorization: Bearer <token>
 * 
 * Returns:
 * - 200: Quota information
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    // ============================================
    // STEP 1: Extract and verify JWT token
    // ============================================
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [CHECK QUOTA] No token provided')
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    let payload: any
    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    } catch (error: any) {
      console.log('❌ [CHECK QUOTA] Invalid token:', error.message)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    console.log('🔍 [CHECK QUOTA] Checking quota for user:', payload.username)

    // ============================================
    // STEP 2: Get user data from database
    // ============================================
    const { data: users, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, username, monthly_char_limit, current_month_usage, usage_reset_date')
      .eq('id', payload.user_id)
      .limit(1)

    if (queryError) {
      console.error('❌ [CHECK QUOTA] Database error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('❌ [CHECK QUOTA] User not found')
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const user = users[0]
    
    // ✅ DEBUG: Log user data from database
    console.log('🔍 [CHECK QUOTA] User data from DB:')
    console.log('   username:', user.username)
    console.log('   monthly_char_limit:', user.monthly_char_limit, '(type:', typeof user.monthly_char_limit + ')')
    console.log('   current_month_usage:', user.current_month_usage)

    // ============================================
    // STEP 3: Check if usage needs to be reset
    // ============================================
    let currentUsage = user.current_month_usage || 0
    let resetDate = user.usage_reset_date

    // If reset date is in the past or not set, reset usage
    if (user.monthly_char_limit !== null) {
      const now = new Date()
      const shouldReset = !resetDate || new Date(resetDate) <= now

      if (shouldReset) {
        console.log('🔄 [CHECK QUOTA] Resetting monthly usage')
        
        // Reset usage and set next reset date (30 days from now)
        const nextResetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            current_month_usage: 0,
            usage_reset_date: nextResetDate.toISOString()
          })
          .eq('id', user.id)

        if (!updateError) {
          currentUsage = 0
          resetDate = nextResetDate.toISOString()
          console.log('✅ [CHECK QUOTA] Usage reset successfully')
        }
      }
    }

    // ============================================
    // STEP 4: Build quota response
    // ============================================
    const isUnlimited = user.monthly_char_limit === null
    const isAccountBased = user.monthly_char_limit === -1

    if (isUnlimited) {
      // Unlimited user
      console.log('✅ [CHECK QUOTA] User is unlimited:', user.username)
      return NextResponse.json({
        success: true,
        quota: {
          is_unlimited: true,
          is_account_based: false,
          monthly_limit: null,
          current_usage: 0,
          remaining: null,
          percentage_used: 0,
          reset_date: null
        }
      })
    } else if (isAccountBased) {
      // Account-based quota (tool will calculate from Gmail accounts)
      console.log('📊 [CHECK QUOTA] User has account-based quota:', user.username)
      return NextResponse.json({
        success: true,
        quota: {
          is_unlimited: false,
          is_account_based: true,
          monthly_limit: -1,
          message: 'Quota based on Gmail accounts. Tool will calculate from account equity API.'
        }
      })
    } else {
      // Fixed limit user
      const monthlyLimit = user.monthly_char_limit
      const remaining = Math.max(0, monthlyLimit - currentUsage)
      const percentageUsed = monthlyLimit > 0 ? (currentUsage / monthlyLimit) * 100 : 0

      console.log('✅ [CHECK QUOTA] Fixed limit user:', user.username)
      console.log('   Limit:', monthlyLimit.toLocaleString())
      console.log('   Used:', currentUsage.toLocaleString())
      console.log('   Remaining:', remaining.toLocaleString())
      console.log('   Percentage:', percentageUsed.toFixed(1) + '%')

      return NextResponse.json({
        success: true,
        quota: {
          is_unlimited: false,
          is_account_based: false,
          monthly_limit: monthlyLimit,
          current_usage: currentUsage,
          remaining: remaining,
          percentage_used: Math.round(percentageUsed * 10) / 10,
          reset_date: resetDate
        }
      })
    }

  } catch (error: any) {
    console.error('💥 [CHECK QUOTA] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
