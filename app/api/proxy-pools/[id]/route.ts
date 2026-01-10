/**
 * API Endpoint: /api/proxy-pools/[id]
 * 
 * Purpose: Manage individual proxy pool
 * 
 * GET:    Get proxy pool by ID
 * PUT:    Update proxy pool
 * DELETE: Delete proxy pool
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteParams {
  params: {
    id: string
  }
}

// ============================================
// GET: Get proxy pool by ID
// ============================================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    const { data: proxyPool, error } = await supabaseAdmin
      .from('proxy_pools')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !proxyPool) {
      return NextResponse.json(
        { success: false, error: 'Proxy pool not found' },
        { status: 404 }
      )
    }

    // Parse proxies if stored as string (compatibility fix)
    if (typeof proxyPool.proxies === 'string') {
      try {
        proxyPool.proxies = JSON.parse(proxyPool.proxies)
      } catch (e) {
        console.error(`Failed to parse proxies for pool ${id}:`, e)
        proxyPool.proxies = []
      }
    }

    return NextResponse.json({
      success: true,
      proxy_pool: proxyPool,
    })
  } catch (error: any) {
    console.error('❌ [API] GET proxy-pool error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT: Update proxy pool
// ============================================
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, description, proxies, is_active, notes } = body

    // Validate proxies if provided
    if (proxies) {
      if (!Array.isArray(proxies) || proxies.length === 0) {
        return NextResponse.json(
          { success: false, error: 'proxies must be a non-empty array' },
          { status: 400 }
        )
      }

      for (const proxy of proxies) {
        if (!proxy.host || !proxy.port) {
          return NextResponse.json(
            { success: false, error: 'Each proxy must have host and port' },
            { status: 400 }
          )
        }
      }
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (proxies !== undefined) updateData.proxies = proxies // Supabase JSONB auto-handles JSON
    if (is_active !== undefined) updateData.is_active = is_active
    if (notes !== undefined) updateData.notes = notes

    // Update proxy pool
    const { data: updatedPool, error: updateError } = await supabaseAdmin
      .from('proxy_pools')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Proxy pool with this name already exists' },
          { status: 409 }
        )
      }

      console.error('❌ [API] Error updating proxy pool:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update proxy pool' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Updated proxy pool: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Proxy pool updated successfully',
      proxy_pool: updatedPool,
    })
  } catch (error: any) {
    console.error('❌ [API] PUT proxy-pool error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE: Delete proxy pool
// ============================================
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    // Check if proxy pool is being used by any user
    const { data: usersUsingPool, error: checkError } = await supabaseAdmin
      .from('user_resources')
      .select('id')
      .eq('proxy_pool_id', id)
      .limit(1)

    if (checkError) {
      console.error('❌ [API] Error checking proxy pool usage:', checkError)
      return NextResponse.json(
        { success: false, error: 'Failed to check proxy pool usage' },
        { status: 500 }
      )
    }

    if (usersUsingPool && usersUsingPool.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete proxy pool that is assigned to users. Remove assignments first.' 
        },
        { status: 400 }
      )
    }

    // Delete proxy pool
    const { error: deleteError } = await supabaseAdmin
      .from('proxy_pools')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('❌ [API] Error deleting proxy pool:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete proxy pool' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Deleted proxy pool: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Proxy pool deleted successfully',
    })
  } catch (error: any) {
    console.error('❌ [API] DELETE proxy-pool error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


