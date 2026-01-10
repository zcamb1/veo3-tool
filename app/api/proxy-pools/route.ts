/**
 * API Endpoint: /api/proxy-pools
 * 
 * Purpose: Manage proxy pools (list of proxies)
 * 
 * GET:  List all proxy pools
 * POST: Create new proxy pool
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ============================================
// GET: List all proxy pools
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabaseAdmin
      .from('proxy_pools')
      .select('*')
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: proxyPools, error } = await query

    if (error) {
      console.error('❌ [API] Error fetching proxy pools:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch proxy pools' },
        { status: 500 }
      )
    }

    // Parse proxies if stored as string (compatibility fix)
    proxyPools?.forEach(pool => {
      if (typeof pool.proxies === 'string') {
        try {
          pool.proxies = JSON.parse(pool.proxies)
        } catch (e) {
          console.error(`Failed to parse proxies for pool ${pool.id}:`, e)
          pool.proxies = []
        }
      }
    })

    return NextResponse.json({
      success: true,
      proxy_pools: proxyPools || [],
      count: proxyPools?.length || 0,
    })
  } catch (error: any) {
    console.error('❌ [API] GET proxy-pools error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Create new proxy pool
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, proxies, created_by, notes } = body

    // Validation
    if (!name || !proxies) {
      return NextResponse.json(
        { success: false, error: 'name and proxies are required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(proxies) || proxies.length === 0) {
      return NextResponse.json(
        { success: false, error: 'proxies must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate proxy format
    for (const proxy of proxies) {
      if (!proxy.host || !proxy.port) {
        return NextResponse.json(
          { success: false, error: 'Each proxy must have host and port' },
          { status: 400 }
        )
      }
    }

    // Insert proxy pool
    const { data: newPool, error: insertError } = await supabaseAdmin
      .from('proxy_pools')
      .insert({
        name,
        description: description || null,
        proxies: proxies, // JSONB - Supabase auto-handles JSON, no need to stringify!
        created_by: created_by || 'admin',
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Proxy pool with this name already exists' },
          { status: 409 }
        )
      }

      console.error('❌ [API] Error creating proxy pool:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create proxy pool' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Created proxy pool: ${name} (${proxies.length} proxies)`)

    return NextResponse.json({
      success: true,
      message: `Proxy pool "${name}" created successfully`,
      proxy_pool: newPool,
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ [API] POST proxy-pools error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

