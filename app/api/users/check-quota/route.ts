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
 * 
 * Updated: 2026-01-13 - Add account-based quota support (monthly_char_limit = -1)
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
      .select('id, username, quota_mode, monthly_char_limit, current_month_usage, monthly_voice_limit, current_month_voice_usage, usage_reset_date')
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
    const quotaMode = user.quota_mode || 'characters'
    
    // ✅ DEBUG: Log user data from database
    console.log('🔍 [CHECK QUOTA] User data from DB:')
    console.log('   username:', user.username)
    console.log('   quota_mode:', quotaMode)
    console.log('   monthly_char_limit:', user.monthly_char_limit, '(type:', typeof user.monthly_char_limit + ')')
    console.log('   current_month_usage:', user.current_month_usage)
    console.log('   monthly_voice_limit:', user.monthly_voice_limit)
    console.log('   current_month_voice_usage:', user.current_month_voice_usage)

    // ============================================
    // STEP 3: Check if usage needs to be reset
    // ============================================
    let currentUsage = quotaMode === 'characters' 
      ? (user.current_month_usage || 0)
      : (user.current_month_voice_usage || 0)
    let resetDate = user.usage_reset_date

    // If reset date is in the past or not set, reset usage
    const hasLimit = quotaMode === 'characters' 
      ? user.monthly_char_limit !== null
      : user.monthly_voice_limit !== null

    if (hasLimit) {
      const now = new Date()
      const shouldReset = !resetDate || new Date(resetDate) <= now

      if (shouldReset) {
        console.log('🔄 [CHECK QUOTA] Resetting monthly usage')
        
        // Reset usage and set next reset date (30 days from now)
        const nextResetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        const updateData: any = {
          usage_reset_date: nextResetDate.toISOString()
        }
        
        if (quotaMode === 'characters') {
          updateData.current_month_usage = 0
        } else {
          updateData.current_month_voice_usage = 0
        }
        
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update(updateData)
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
    const isUnlimited = quotaMode === 'characters'
      ? user.monthly_char_limit === null
      : user.monthly_voice_limit === null
    const isAccountBased = quotaMode === 'characters' && user.monthly_char_limit === -1

    if (isUnlimited) {
      // Unlimited user
      console.log('✅ [CHECK QUOTA] User is unlimited:', user.username)
      return NextResponse.json({
        success: true,
        quota: {
          quota_mode: quotaMode,
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
          quota_mode: 'characters',
          is_unlimited: false,
          is_account_based: true,
          monthly_limit: -1,
          message: 'Quota based on Gmail accounts. Tool will calculate from account equity API.'
        }
      })
    } else {
      // Fixed limit user
      const monthlyLimit = quotaMode === 'characters' ? user.monthly_char_limit : user.monthly_voice_limit
      const remaining = Math.max(0, monthlyLimit - currentUsage)
      const percentageUsed = monthlyLimit > 0 ? (currentUsage / monthlyLimit) * 100 : 0

      console.log('✅ [CHECK QUOTA] Fixed limit user:', user.username)
      console.log('   Mode:', quotaMode)
      console.log('   Limit:', quotaMode === 'characters' ? monthlyLimit.toLocaleString() : `${Math.round(monthlyLimit / 60)} min`)
      console.log('   Used:', quotaMode === 'characters' ? currentUsage.toLocaleString() : `${Math.round(currentUsage / 60)} min`)
      console.log('   Remaining:', quotaMode === 'characters' ? remaining.toLocaleString() : `${Math.round(remaining / 60)} min`)
      console.log('   Percentage:', percentageUsed.toFixed(1) + '%')

      const quotaResponse: any = {
        quota_mode: quotaMode,
        is_unlimited: false,
        is_account_based: false,
        monthly_limit: monthlyLimit,
        current_usage: currentUsage,
        remaining: remaining,
        percentage_used: Math.round(percentageUsed * 10) / 10,
        reset_date: resetDate
      }

      // Add human-readable formats for voice mode
      if (quotaMode === 'voice_duration') {
        quotaResponse.monthly_limit_minutes = Math.round(monthlyLimit / 60)
        quotaResponse.current_usage_minutes = Math.round(currentUsage / 60)
        quotaResponse.remaining_minutes = Math.round(remaining / 60)
      }

      return NextResponse.json({
        success: true,
        quota: quotaResponse
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
