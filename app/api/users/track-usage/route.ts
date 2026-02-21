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
 * Body: { characters_used?: number, voice_duration?: number }
 * 
 * Note: Send either characters_used OR voice_duration based on user's quota_mode
 * 
 * Returns:
 * - 200: Usage tracked successfully
 * - 400: Bad request (missing usage data or invalid)
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
    const { characters_used, voice_duration } = body

    // Validate input - at least one must be provided
    if (!characters_used && !voice_duration) {
      console.log('❌ [TRACK USAGE] No usage data provided')
      return NextResponse.json(
        { success: false, error: 'Either characters_used or voice_duration must be provided' },
        { status: 400 }
      )
    }

    if (characters_used && (typeof characters_used !== 'number' || characters_used <= 0)) {
      console.log('❌ [TRACK USAGE] Invalid characters_used:', characters_used)
      return NextResponse.json(
        { success: false, error: 'Invalid characters_used value' },
        { status: 400 }
      )
    }

    if (voice_duration && (typeof voice_duration !== 'number' || voice_duration <= 0)) {
      console.log('❌ [TRACK USAGE] Invalid voice_duration:', voice_duration)
      return NextResponse.json(
        { success: false, error: 'Invalid voice_duration value' },
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
    if (characters_used) {
      console.log('   Characters:', characters_used.toLocaleString())
    }
    if (voice_duration) {
      console.log('   Voice Duration:', voice_duration, 'seconds (', Math.round(voice_duration / 60), 'minutes)')
    }

    // ============================================
    // STEP 2: Get user data from database
    // ============================================
    const { data: users, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, username, quota_mode, monthly_char_limit, current_month_usage, monthly_voice_limit, current_month_voice_usage, usage_reset_date')
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
    const quotaMode = user.quota_mode || 'characters'

    // ============================================
    // STEP 3: Check if user is unlimited
    // ============================================
    const isUnlimited = quotaMode === 'characters' 
      ? user.monthly_char_limit === null 
      : user.monthly_voice_limit === null

    if (isUnlimited) {
      // Unlimited user - no tracking needed
      console.log('✅ [TRACK USAGE] User is unlimited - skipping tracking')
      return NextResponse.json({
        success: true,
        message: 'Usage tracked (unlimited user)',
        quota: {
          quota_mode: quotaMode,
          is_unlimited: true,
          remaining: null,
          exceeded: false
        }
      })
    }

    // Validate that the correct usage type is being tracked
    if (quotaMode === 'characters' && !characters_used) {
      console.log('❌ [TRACK USAGE] User is in character mode but voice_duration was sent')
      return NextResponse.json(
        { success: false, error: 'User is in character quota mode. Please send characters_used.' },
        { status: 400 }
      )
    }

    if (quotaMode === 'voice_duration' && !voice_duration) {
      console.log('❌ [TRACK USAGE] User is in voice mode but characters_used was sent')
      return NextResponse.json(
        { success: false, error: 'User is in voice duration quota mode. Please send voice_duration.' },
        { status: 400 }
      )
    }

    // ============================================
    // STEP 4: Check and reset usage if needed
    // ============================================
    let currentUsage = quotaMode === 'characters' 
      ? (user.current_month_usage || 0)
      : (user.current_month_voice_usage || 0)
    let resetDate = user.usage_reset_date

    const now = new Date()
    const shouldReset = !resetDate || new Date(resetDate) <= now

    if (shouldReset) {
      console.log('🔄 [TRACK USAGE] Resetting yearly usage before tracking')
      currentUsage = 0
      resetDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }

    // ============================================
    // STEP 5: Calculate new usage and check quota
    // ============================================
    const usageIncrement = quotaMode === 'characters' ? (characters_used || 0) : (voice_duration || 0)
    const newUsage = currentUsage + usageIncrement
    const monthlyLimit = quotaMode === 'characters' ? user.monthly_char_limit : user.monthly_voice_limit
    const remaining = Math.max(0, monthlyLimit - newUsage)
    const exceeded = newUsage > monthlyLimit

    console.log('📈 [TRACK USAGE] Quota calculation:')
    console.log('   Mode:', quotaMode)
    console.log('   Previous usage:', quotaMode === 'characters' ? currentUsage.toLocaleString() : `${Math.round(currentUsage / 60)} min`)
    console.log('   Increment:', quotaMode === 'characters' ? usageIncrement.toLocaleString() : `${Math.round(usageIncrement / 60)} min`)
    console.log('   New usage:', quotaMode === 'characters' ? newUsage.toLocaleString() : `${Math.round(newUsage / 60)} min`)
    console.log('   Limit:', quotaMode === 'characters' ? monthlyLimit.toLocaleString() : `${Math.round(monthlyLimit / 60)} min`)
    console.log('   Remaining:', quotaMode === 'characters' ? remaining.toLocaleString() : `${Math.round(remaining / 60)} min`)
    console.log('   Exceeded:', exceeded)

    // ============================================
    // STEP 6: Update usage in database
    // ============================================
    const updateData: any = {
      usage_reset_date: resetDate,
      last_usage_update: new Date().toISOString()
    }

    if (quotaMode === 'characters') {
      updateData.current_month_usage = newUsage
    } else {
      updateData.current_month_voice_usage = newUsage
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
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
    const responseQuota: any = {
      quota_mode: quotaMode,
      is_unlimited: false,
      monthly_limit: monthlyLimit,
      current_usage: newUsage,
      remaining: remaining,
      exceeded: exceeded,
      percentage_used: Math.round((newUsage / monthlyLimit) * 1000) / 10,
      reset_date: resetDate
    }

    // Add human-readable formats
    if (quotaMode === 'voice_duration') {
      responseQuota.monthly_limit_minutes = Math.round(monthlyLimit / 60)
      responseQuota.current_usage_minutes = Math.round(newUsage / 60)
      responseQuota.remaining_minutes = Math.round(remaining / 60)
    }

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
      quota: responseQuota
    })

  } catch (error: any) {
    console.error('💥 [TRACK USAGE] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
