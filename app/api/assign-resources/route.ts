/**
 * API Endpoint: POST /api/assign-resources
 * 
 * Purpose: Assign Gmail accounts + proxy/proxy_pool to a user
 * 
 * Request Body:
 * {
 *   user_id: 123,
 *   gmail_account_ids: [1, 2, 3],
 *   // Option 1: Single proxy (backward compatibility)
 *   proxy: {
 *     host: "208.214.165.10",
 *     port: 50100,
 *     username: "proxy_user",
 *     password: "proxy_pass"
 *   },
 *   // Option 2: Proxy Pool (NEW)
 *   proxy_pool_id: 5,
 *   assigned_by: "admin_username",
 *   notes: "Optional notes"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, gmail_account_ids, proxy, proxy_pool_id, assigned_by, notes } = body

    // Validation
    if (!user_id || !gmail_account_ids || !Array.isArray(gmail_account_ids)) {
      return NextResponse.json(
        { success: false, error: 'user_id and gmail_account_ids (array) are required' },
        { status: 400 }
      )
    }

    if (gmail_account_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one Gmail account must be provided' },
        { status: 400 }
      )
    }

    // Validate proxy_pool_id if provided
    if (proxy_pool_id) {
      const { data: proxyPool, error: poolError } = await supabaseAdmin
        .from('proxy_pools')
        .select('id, name, is_active')
        .eq('id', proxy_pool_id)
        .single()

      if (poolError || !proxyPool) {
        return NextResponse.json(
          { success: false, error: 'Proxy pool not found' },
          { status: 404 }
        )
      }

      if (!proxyPool.is_active) {
        return NextResponse.json(
          { success: false, error: 'Proxy pool is not active' },
          { status: 400 }
        )
      }
    }

    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if all Gmail accounts exist
    const { data: gmailAccounts, error: gmailError } = await supabaseAdmin
      .from('gmail_accounts')
      .select('id, email')
      .in('id', gmail_account_ids)

    if (gmailError || !gmailAccounts || gmailAccounts.length !== gmail_account_ids.length) {
      return NextResponse.json(
        { success: false, error: 'One or more Gmail accounts not found' },
        { status: 404 }
      )
    }

    // Prepare assignments
    const assignments = gmail_account_ids.map((gmail_account_id: number) => ({
      user_id: user_id,
      gmail_account_id: gmail_account_id,
      // Single proxy fields (backward compatibility)
      proxy_host: proxy?.host || null,
      proxy_port: proxy?.port || null,
      proxy_username: proxy?.username || null,
      proxy_password: proxy?.password || null,
      // New: Proxy pool ID
      proxy_pool_id: proxy_pool_id || null,
      assigned_by: assigned_by || 'admin',
      notes: notes || null,
    }))

    // Insert assignments (upsert to handle existing assignments)
    const { data: insertedAssignments, error: insertError } = await supabaseAdmin
      .from('user_resources')
      .upsert(assignments, {
        onConflict: 'user_id,gmail_account_id',
        ignoreDuplicates: false, // Update existing
      })
      .select()

    if (insertError) {
      console.error('❌ [API] Error assigning resources:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to assign resources' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Assigned ${gmail_account_ids.length} Gmail accounts to user ${user.username}`)

    return NextResponse.json({
      success: true,
      message: `Assigned ${gmail_account_ids.length} Gmail accounts to ${user.username}`,
      assignments: insertedAssignments,
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ [API] assign-resources error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// GET: Get user's assigned resources
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'user_id query parameter required' },
        { status: 400 }
      )
    }

    // Get user's assigned resources
    const { data: resources, error } = await supabaseAdmin
      .from('user_resources')
      .select(`
        *,
        gmail_accounts (
          id,
          email,
          ogg_ticket,
          status,
          expires_at
        ),
        users (
          id,
          username
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('❌ [API] Error fetching user resources:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user resources' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resources: resources || [],
      count: resources?.length || 0,
    })
  } catch (error: any) {
    console.error('❌ [API] GET assign-resources error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE: Remove resource assignment
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('id')

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'Assignment ID required' },
        { status: 400 }
      )
    }

    // Delete assignment
    const { error: deleteError } = await supabaseAdmin
      .from('user_resources')
      .delete()
      .eq('id', assignmentId)

    if (deleteError) {
      console.error('❌ [API] Error deleting assignment:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete assignment' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Assignment deleted: ${assignmentId}`)

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully',
    })
  } catch (error: any) {
    console.error('❌ [API] DELETE assign-resources error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

