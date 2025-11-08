import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

const JWT_SECRET = process.env.JWT_SECRET || ''

if (!JWT_SECRET) {
  console.error('❌ [CRITICAL] JWT_SECRET not found in environment variables!')
}

/**
 * GET AUTHENTICATED SCRIPT API
 * 
 * Endpoint: GET /api/get-authenticated-script?device_id=xxx
 * Headers: Authorization: Bearer <jwt-token>
 * 
 * Checks:
 * 1. JWT token signature valid
 * 2. Token not expired
 * 3. Device ID matches token payload
 * 4. User exists and is active in database
 * 
 * Returns:
 * - 200: script.js content
 * - 401: Unauthorized (invalid token)
 * - 403: Forbidden (device mismatch, user inactive)
 * - 404: User not found
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔒 [GET-SCRIPT] Script request received')
    
    // ============================================
    // STEP 1: Extract token from Authorization header
    // ============================================
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [GET-SCRIPT] No token provided')
      return NextResponse.json(
        { success: false, error: 'No token provided', code: 'NO_TOKEN' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)  // Remove 'Bearer ' prefix
    
    // Get device_id from query params
    const { searchParams } = new URL(request.url)
    const device_id = searchParams.get('device_id')

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
      console.log('✅ [GET-SCRIPT] Token signature valid')
      console.log('   Username:', payload.username)
      console.log('   Account type:', payload.account_type)
      console.log('   Expires at:', new Date(payload.exp * 1000).toISOString())
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        console.log('❌ [GET-SCRIPT] Token expired')
        return NextResponse.json(
          { success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }
      
      console.log('❌ [GET-SCRIPT] Invalid token signature')
      return NextResponse.json(
        { success: false, error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      )
    }

    // ============================================
    // STEP 3: Verify device ID match (if provided)
    // ============================================
    if (device_id && payload.device_id && payload.device_id !== device_id) {
      console.log('❌ [GET-SCRIPT] Device mismatch!')
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
      console.error('❌ [GET-SCRIPT] Database query error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database error', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('❌ [GET-SCRIPT] User not found in database')
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
      console.log('❌ [GET-SCRIPT] User account inactive')
      console.log('   Status:', user.status)
      return NextResponse.json(
        { success: false, error: `Account ${user.status}`, code: 'USER_INACTIVE' },
        { status: 403 }
      )
    }

    // ============================================
    // STEP 6: All checks passed - Serve script
    // ============================================
    console.log('✅ [GET-SCRIPT] All checks passed - serving script')
    console.log('   User:', user.username)
    console.log('   Account type:', user.account_type)

    const scriptPath = join(process.cwd(), 'protected', 'script_ud.js')
    const scriptContent = readFileSync(scriptPath, 'utf-8')
    
    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Origin': '*',
        'X-Authenticated-User': user.username,
        'X-Account-Type': user.account_type
      }
    })
    
  } catch (error: any) {
    console.error('💥 [GET-SCRIPT] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

