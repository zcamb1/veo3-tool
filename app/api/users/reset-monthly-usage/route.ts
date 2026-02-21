import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Reset Monthly Usage API (Admin Only)
 * 
 * Endpoint: POST /api/users/reset-monthly-usage
 * Body: { admin_password: string } OR { user_id: number } (optional - reset specific user)
 * 
 * This API can be:
 * 1. Called manually by admin
 * 2. Called by Vercel Cron Job at the start of each month
 * 
 * Returns:
 * - 200: Reset successful
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { admin_password, user_id, cron_secret } = body

    // ============================================
    // AUTHENTICATION: Check admin password OR cron secret
    // ============================================
    const validAdminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const validCronSecret = process.env.CRON_SECRET || 'your-cron-secret-here'

    const isAdmin = admin_password === validAdminPassword
    const isCronJob = cron_secret === validCronSecret

    if (!isAdmin && !isCronJob) {
      console.log('❌ [RESET USAGE] Unauthorized access attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid credentials' },
        { status: 401 }
      )
    }

    console.log('🔄 [RESET USAGE] Starting monthly usage reset...')
    console.log('   Triggered by:', isCronJob ? 'Cron Job' : 'Admin')

    // ============================================
    // STEP 1: Build query based on parameters
    // ============================================
    let query = supabaseAdmin
      .from('users')
      .select('id, username, monthly_char_limit, current_month_usage')

    // If specific user_id provided, only reset that user
    if (user_id) {
      query = query.eq('id', user_id)
      console.log('   Target: User ID', user_id)
    } else {
      // Reset all users with quota limits (skip unlimited users)
      query = query.not('monthly_char_limit', 'is', null)
      console.log('   Target: All limited users')
    }

    const { data: users, error: queryError } = await query

    if (queryError) {
      console.error('❌ [RESET USAGE] Database query error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('⚠️ [RESET USAGE] No users found to reset')
      return NextResponse.json({
        success: true,
        message: 'No users found to reset',
        users_reset: 0
      })
    }

    console.log(`📊 [RESET USAGE] Found ${users.length} user(s) to reset`)

    // ============================================
    // STEP 2: Calculate next reset date (365 days from now)
    // ============================================
    const now = new Date()
    const nextResetDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    console.log('   Next reset date:', nextResetDate.toISOString())

    // ============================================
    // STEP 3: Reset usage for all users
    // ============================================
    const userIds = users.map(u => u.id)

    const { error: updateError, count } = await supabaseAdmin
      .from('users')
      .update({
        current_month_usage: 0,
        usage_reset_date: nextResetDate.toISOString(),
        last_usage_update: now.toISOString()
      })
      .in('id', userIds)

    if (updateError) {
      console.error('❌ [RESET USAGE] Failed to reset usage:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to reset usage' },
        { status: 500 }
      )
    }

    // ============================================
    // STEP 4: Log reset details
    // ============================================
    console.log('✅ [RESET USAGE] Monthly usage reset completed')
    console.log('   Users reset:', count || users.length)
    
    // Log each user's previous usage (for audit trail)
    users.forEach(user => {
      console.log(`   - ${user.username}: ${(user.current_month_usage || 0).toLocaleString()} → 0`)
    })

    // ============================================
    // STEP 5: Return success response
    // ============================================
    return NextResponse.json({
      success: true,
      message: `Monthly usage reset successfully for ${count || users.length} user(s)`,
      users_reset: count || users.length,
      next_reset_date: nextResetDate.toISOString(),
      reset_details: users.map(u => ({
        username: u.username,
        previous_usage: u.current_month_usage || 0,
        limit: u.monthly_char_limit
      }))
    })

  } catch (error: any) {
    console.error('💥 [RESET USAGE] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for checking last reset status
 */
export async function GET(request: NextRequest) {
  try {
    // Get all users with quota limits and their reset dates
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('username, monthly_char_limit, current_month_usage, usage_reset_date')
      .not('monthly_char_limit', 'is', null)
      .order('usage_reset_date', { ascending: true })

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      total_limited_users: users?.length || 0,
      users: users?.map(u => ({
        username: u.username,
        limit: u.monthly_char_limit,
        usage: u.current_month_usage || 0,
        percentage: u.monthly_char_limit > 0 
          ? Math.round((u.current_month_usage || 0) / u.monthly_char_limit * 100)
          : 0,
        reset_date: u.usage_reset_date
      }))
    })

  } catch (error: any) {
    console.error('💥 [RESET USAGE GET] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
