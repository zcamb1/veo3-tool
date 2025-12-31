/**
 * API Endpoint: /api/gmail-accounts
 * 
 * Purpose: Admin CRUD operations for Gmail accounts
 * 
 * GET:  List all Gmail accounts
 * POST: Add new Gmail account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ============================================
// GET: List all Gmail accounts
// ============================================
export async function GET(request: NextRequest) {
  try {
    // Get all Gmail accounts with assignment count
    const { data: accounts, error } = await supabaseAdmin
      .from('gmail_accounts')
      .select(`
        *,
        user_resources (
          id,
          user_id,
          users (
            id,
            username
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ [API] Error fetching Gmail accounts:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch Gmail accounts' },
        { status: 500 }
      )
    }

    // Format response with assigned users count
    const formattedAccounts = accounts.map((account: any) => ({
      ...account,
      assigned_users_count: account.user_resources?.length || 0,
      assigned_users: account.user_resources
        ?.map((ur: any) => ur.users?.username)
        .filter(Boolean) || [],
    }))

    return NextResponse.json({
      success: true,
      accounts: formattedAccounts,
      total: formattedAccounts.length,
    })
  } catch (error: any) {
    console.error('❌ [API] GET gmail-accounts error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Add new Gmail account
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, ogg_ticket, password, expires_at, status, notes } = body

    // Validation
    if (!email || !ogg_ticket) {
      return NextResponse.json(
        { success: false, error: 'Email and ogg_ticket are required' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if Gmail account already exists
    const { data: existing } = await supabaseAdmin
      .from('gmail_accounts')
      .select('id, email')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Gmail account already exists: ${email}` },
        { status: 409 }
      )
    }

    // Insert new Gmail account
    const { data: newAccount, error: insertError } = await supabaseAdmin
      .from('gmail_accounts')
      .insert({
        email,
        ogg_ticket,
        password: password || null,
        expires_at: expires_at || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: status || 'active',
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [API] Error inserting Gmail account:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to add Gmail account' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Gmail account added: ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Gmail account added successfully',
      account: newAccount,
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ [API] POST gmail-accounts error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

