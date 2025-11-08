import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || ''

if (!JWT_SECRET) {
  console.error('❌ [CRITICAL] JWT_SECRET not found in environment variables!')
  console.error('   Please add JWT_SECRET to your .env.local file')
}

/**
 * Verify JWT Token API
 * 
 * Endpoint: POST /api/verify-token
 * Headers: Authorization: Bearer <token>
 * Body: { device_id: string }
 * 
 * Returns:
 * - 200: Token valid
 * - 401: Token expired or invalid
 * - 403: Device mismatch or user inactive
 * - 404: User not found
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    // ============================================
    // STEP 1: Extract token from Authorization header
    // ============================================
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [VERIFY TOKEN] No token provided')
      return NextResponse.json(
        { success: false, error: 'No token provided', code: 'NO_TOKEN' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)  // Remove 'Bearer ' prefix
    const body = await request.json()
    const { device_id } = body

    console.log('🔍 [VERIFY TOKEN] Verifying token...')
    console.log('   Token preview:', token.substring(0, 40) + '...')
    if (device_id) {
      console.log('   Device ID:', device_id.substring(0, 16) + '...')
    }

    // ============================================
    // STEP 2: Verify JWT token signature and expiry
    // ============================================
    let payload: any
    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
      console.log('✅ [VERIFY TOKEN] Token signature valid')
      console.log('   Username:', payload.username)
      console.log('   Account type:', payload.account_type)
      console.log('   Issued at:', new Date(payload.iat * 1000).toISOString())
      console.log('   Expires at:', new Date(payload.exp * 1000).toISOString())
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        console.log('❌ [VERIFY TOKEN] Token expired')
        console.log('   Expired at:', new Date(error.expiredAt).toISOString())
        return NextResponse.json(
          { success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      
      console.log('❌ [VERIFY TOKEN] Invalid token signature')
      console.log('   Error:', error.message)
      return NextResponse.json(
        { success: false, error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    }

    // ============================================
    // STEP 3: Verify device ID match (if provided)
    // ============================================
    if (device_id && payload.device_id && payload.device_id !== device_id) {
      console.log('❌ [VERIFY TOKEN] Device mismatch!')
      console.log('   Token device:', payload.device_id.substring(0, 16) + '...')
      console.log('   Request device:', device_id.substring(0, 16) + '...')
      return NextResponse.json(
        { success: false, error: 'Device mismatch', code: 'DEVICE_MISMATCH' },
        { status: 403 }
      )
    }

    // ============================================
    // STEP 4: Check if user still exists and is active
    // ============================================
    const { data: users, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, username, status, account_type')
      .eq('id', payload.user_id)
      .limit(1)

    if (queryError) {
      console.error('❌ [VERIFY TOKEN] Database query error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database error', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('❌ [VERIFY TOKEN] User not found in database')
      console.log('   User ID:', payload.user_id)
      return NextResponse.json(
        { success: false, error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      )
    }

    const user = users[0]

    // ============================================
    // STEP 5: Check user status
    // ============================================
    if (user.status !== 'active') {
      console.log('❌ [VERIFY TOKEN] User account inactive')
      console.log('   Status:', user.status)
      return NextResponse.json(
        { success: false, error: `Account ${user.status}`, code: 'USER_INACTIVE' },
        { status: 403 }
      )
    }

    // ============================================
    // STEP 6: All checks passed - return success
    // ============================================
    const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000)
    const remainingHours = Math.floor(remainingSeconds / 3600)
    const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60)

    console.log('✅ [VERIFY TOKEN] All checks passed')
    console.log('   User:', user.username)
    console.log('   Account type:', user.account_type)
    console.log('   Token remaining:', `${remainingHours}h ${remainingMinutes}m`)

    return NextResponse.json({
      success: true,
      message: 'Token valid',
      user: {
        username: user.username,
        account_type: user.account_type,
        status: user.status
      },
      token_info: {
        issued_at: payload.iat,
        expires_at: payload.exp,
        remaining_seconds: remainingSeconds,
        remaining_time: `${remainingHours}h ${remainingMinutes}m`
      }
    })

  } catch (error: any) {
    console.error('💥 [VERIFY TOKEN] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

