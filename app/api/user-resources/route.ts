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
  user_id: number
  username: string
  device_id: string
  account_type: string
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
    if (decoded.device_id !== deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device ID mismatch' },
        { status: 403 }
      )
    }

    const userId = decoded.user_id

    // 5. Get user's assigned Gmail accounts + proxy from user_resources table
    const { data: userResourcesData, error: resourcesError } = await supabaseAdmin
      .from('user_resources')
      .select(`
        id,
        gmail_account_id,
        proxy_host,
        proxy_port,
        proxy_username,
        proxy_password,
        proxy_pool_id,
        gmail_accounts (
          id,
          email,
          ogg_ticket,
          status,
          expires_at
        ),
        proxy_pools (
          id,
          name,
          proxies,
          is_active
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

    // Get proxy config: Check proxy_pool_id first, then fall back to single proxy
    let proxyConfig = null
    let proxyList = null

    if (userResourcesData.length > 0) {
      const firstResource = userResourcesData[0]

      // Option 1: Proxy Pool (NEW - list of proxies)
      if (firstResource.proxy_pools && firstResource.proxy_pools.is_active) {
        proxyList = firstResource.proxy_pools.proxies // Array of proxies
        console.log(`✅ [API] User ${decoded.username} using Proxy Pool: ${firstResource.proxy_pools.name} (${proxyList.length} proxies)`)
      }
      // Option 2: Single Proxy (OLD - backward compatibility)
      else if (firstResource.proxy_host) {
        proxyConfig = {
          host: firstResource.proxy_host,
          port: firstResource.proxy_port,
          username: firstResource.proxy_username,
          password: firstResource.proxy_password,
        }
        console.log(`✅ [API] User ${decoded.username} using single proxy: ${proxyConfig.host}:${proxyConfig.port}`)
      }
    }

    console.log(`✅ [API] User ${decoded.username} (ID: ${userId}) fetched ${gmailAccounts.length} Gmail accounts`)

    return NextResponse.json({
      success: true,
      resources: {
        gmail_accounts: gmailAccounts,
        proxy: proxyConfig, // Single proxy (backward compatibility)
        proxy_list: proxyList, // New: Array of proxies from proxy pool
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

