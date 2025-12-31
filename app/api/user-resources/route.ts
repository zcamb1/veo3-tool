/**
 * API Endpoint: GET /api/user-resources
 * 
 * Purpose: Desktop tool calls this to get Gmail accounts + proxy for logged-in user
 * 
 * Authentication: JWT token (from desktop-login) + Device ID
 * 
 * Returns:
 * {
 *   success: true,
 *   resources: {
 *     gmail_accounts: [{email, ogg_ticket}, ...],
 *     proxy: {host, port, username, password}
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

interface JWTPayload {
  userId: number
  username: string
  deviceId: string
  accountType: string
}

export async function GET(request: NextRequest) {
  try {
    // 1. Get Device-ID header
    const deviceId = request.headers.get('Device-ID')
    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device-ID header required' },
        { status: 400 }
      )
    }

    // 2. Get Authorization header (JWT token)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer '

    // 3. Verify JWT token
    let decoded: JWTPayload
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // 4. Verify device ID matches token
    if (decoded.deviceId !== deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device ID mismatch' },
        { status: 403 }
      )
    }

    const userId = decoded.userId

    // 5. Get user's assigned Gmail accounts from user_resources table
    const { data: userResourcesData, error: resourcesError } = await supabaseAdmin
      .from('user_resources')
      .select(`
        id,
        gmail_account_id,
        proxy_host,
        proxy_port,
        proxy_username,
        proxy_password,
        gmail_accounts (
          id,
          email,
          ogg_ticket,
          status,
          expires_at
        )
      `)
      .eq('user_id', userId)

    if (resourcesError) {
      console.error('❌ [API] Error fetching user resources:', resourcesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch resources' },
        { status: 500 }
      )
    }

    // 6. Format response
    const gmailAccounts = userResourcesData
      .filter((resource: any) => resource.gmail_accounts) // Filter out null joins
      .map((resource: any) => ({
        id: resource.gmail_accounts.id,
        email: resource.gmail_accounts.email,
        ogg_ticket: resource.gmail_accounts.ogg_ticket,
        status: resource.gmail_accounts.status,
        expires_at: resource.gmail_accounts.expires_at,
      }))

    // Get proxy config (assume same proxy for all accounts, use first one)
    const proxyConfig = userResourcesData.length > 0
      ? {
          host: userResourcesData[0].proxy_host,
          port: userResourcesData[0].proxy_port,
          username: userResourcesData[0].proxy_username,
          password: userResourcesData[0].proxy_password,
        }
      : null

    console.log(`✅ [API] User ${decoded.username} (ID: ${userId}) fetched ${gmailAccounts.length} Gmail accounts`)

    return NextResponse.json({
      success: true,
      resources: {
        gmail_accounts: gmailAccounts,
        proxy: proxyConfig,
      },
    })
  } catch (error: any) {
    console.error('❌ [API] user-resources error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

