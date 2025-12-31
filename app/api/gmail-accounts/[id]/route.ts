/**
 * API Endpoint: /api/gmail-accounts/[id]
 * 
 * Purpose: Update or delete specific Gmail account
 * 
 * PUT:    Update Gmail account
 * DELETE: Delete Gmail account (and all assignments)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ============================================
// PUT: Update Gmail account
// ============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id)
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, ogg_ticket, password, expires_at, status, notes } = body

    // Build update object (only include provided fields)
    const updateData: any = {}
    if (email !== undefined) updateData.email = email
    if (ogg_ticket !== undefined) updateData.ogg_ticket = ogg_ticket
    if (password !== undefined) updateData.password = password
    if (expires_at !== undefined) updateData.expires_at = expires_at
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update Gmail account
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from('gmail_accounts')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ [API] Error updating Gmail account:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update Gmail account' },
        { status: 500 }
      )
    }

    if (!updatedAccount) {
      return NextResponse.json(
        { success: false, error: 'Gmail account not found' },
        { status: 404 }
      )
    }

    console.log(`✅ [API] Gmail account updated: ${updatedAccount.email}`)

    return NextResponse.json({
      success: true,
      message: 'Gmail account updated successfully',
      account: updatedAccount,
    })
  } catch (error: any) {
    console.error('❌ [API] PUT gmail-accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE: Delete Gmail account
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = parseInt(params.id)
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    // Get account info before deletion
    const { data: account } = await supabaseAdmin
      .from('gmail_accounts')
      .select('id, email')
      .eq('id', accountId)
      .single()

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Gmail account not found' },
        { status: 404 }
      )
    }

    // Delete Gmail account (CASCADE will delete user_resources and ogg_ticket_updates)
    const { error: deleteError } = await supabaseAdmin
      .from('gmail_accounts')
      .delete()
      .eq('id', accountId)

    if (deleteError) {
      console.error('❌ [API] Error deleting Gmail account:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete Gmail account' },
        { status: 500 }
      )
    }

    console.log(`✅ [API] Gmail account deleted: ${account.email}`)

    return NextResponse.json({
      success: true,
      message: `Gmail account deleted: ${account.email}`,
    })
  } catch (error: any) {
    console.error('❌ [API] DELETE gmail-accounts/[id] error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

