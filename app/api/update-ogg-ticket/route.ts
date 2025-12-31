/**
 * API Endpoint: POST /api/update-ogg-ticket
 * 
 * Purpose: Auto-refresh script calls this to update ogg_ticket for a Gmail account
 * 
 * Authentication: Secret key (for auto script) or JWT admin token
 * 
 * Request Body:
 * {
 *   email: "gmail@gmail.com",
 *   ogg_ticket: "new_ticket_value",
 *   expires_at?: "2025-01-03T00:00:00Z"  // Optional, defaults to +3 days
 * }
 * 
 * Returns:
 * {
 *   success: true,
 *   message: "OGG ticket updated successfully",
 *   account: { id, email, updated_at }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Secret key for auto-refresh script (store in .env)
const AUTO_SCRIPT_SECRET = process.env.AUTO_SCRIPT_SECRET || 'change-this-secret-key-in-production'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins (or specify 'https://www.minimax.io')
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication (Bearer token with secret key)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.substring(7)

    // Verify secret key (simple approach - can enhance with JWT if needed)
    if (token !== AUTO_SCRIPT_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Invalid authorization token' },
        { status: 403, headers: corsHeaders }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { email, ogg_ticket, expires_at } = body

    // Validation
    if (!email || !ogg_ticket) {
      return NextResponse.json(
        { success: false, error: 'Email and ogg_ticket are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 3. Check if Gmail account exists
    const { data: existingAccount, error: findError } = await supabaseAdmin
      .from('gmail_accounts')
      .select('id, email, ogg_ticket, status')
      .eq('email', email)
      .single()

    let accountId: number
    let oldTicket: string | null = null
    let isNewAccount = false

    // ============================================
    // UPSERT LOGIC: Create if not exists, Update if exists
    // ============================================
    
    if (findError || !existingAccount) {
      // ========================================
      // 4A. CREATE NEW GMAIL ACCOUNT
      // ========================================
      console.log(`🆕 [API] Creating new Gmail account: ${email}`)
      
      const { data: newAccount, error: createError } = await supabaseAdmin
        .from('gmail_accounts')
        .insert({
          email: email,
          ogg_ticket: ogg_ticket,
          status: 'active',
          expires_at: expires_at || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Auto-created by console script'
        })
        .select()
        .single()

      if (createError || !newAccount) {
        console.error('❌ [API] Error creating Gmail account:', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create Gmail account' },
          { status: 500, headers: corsHeaders }
        )
      }

      accountId = newAccount.id
      isNewAccount = true
      
      console.log(`✅ [API] Gmail account created: ${email} (ID: ${accountId})`)

      return NextResponse.json({
        success: true,
        message: 'Gmail account created successfully',
        created: true,
        account: {
          id: newAccount.id,
          email: newAccount.email,
          updated_at: newAccount.last_updated,
          expires_at: newAccount.expires_at,
        },
      }, { status: 201, headers: corsHeaders })
      
    } else {
      // ========================================
      // 4B. UPDATE EXISTING GMAIL ACCOUNT
      // ========================================
      console.log(`🔄 [API] Updating existing Gmail account: ${email}`)
      
      accountId = existingAccount.id
      oldTicket = existingAccount.ogg_ticket

      const updateData: any = {
        ogg_ticket: ogg_ticket,
        status: 'active', // Reset status to active
        expires_at: expires_at || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }

      const { data: updatedAccount, error: updateError } = await supabaseAdmin
        .from('gmail_accounts')
        .update(updateData)
        .eq('email', email)
        .select()
        .single()

      if (updateError) {
        console.error('❌ [API] Error updating ogg_ticket:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update ogg_ticket' },
          { status: 500, headers: corsHeaders }
        )
      }

      // 5. Log the update to ogg_ticket_updates table
      await supabaseAdmin
        .from('ogg_ticket_updates')
        .insert({
          gmail_account_id: accountId,
          old_ticket: oldTicket,
          new_ticket: ogg_ticket,
          updated_by: 'auto_script',
          success: true,
        })

      console.log(`✅ [API] OGG ticket updated for ${email}`)

      return NextResponse.json({
        success: true,
        message: 'OGG ticket updated successfully',
        created: false,
        account: {
          id: updatedAccount.id,
          email: updatedAccount.email,
          updated_at: updatedAccount.last_updated,
          expires_at: updatedAccount.expires_at,
        },
      }, { headers: corsHeaders })
    }
  } catch (error: any) {
    console.error('❌ [API] update-ogg-ticket error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

