import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id)
    const { username, password, account_type, status } = await request.json()

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    console.log('✏️ Updating user:', userId)

    // Build update object
    const updateData: any = {}
    
    if (username) updateData.username = username
    if (account_type) updateData.account_type = account_type
    if (status) updateData.status = status
    
    // Hash new password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10)
      updateData.password_hash = await bcrypt.hash(password, salt)
      console.log('🔐 Password updated and hashed')
    }

    // Update user in database using admin client
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('❌ Update error:', error)
      throw error
    }

    console.log('✅ User updated successfully')

    return NextResponse.json({
      success: true,
      user: data
    })
  } catch (error: any) {
    console.error('❌ Error in update user API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
