import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const userId = parseInt(params.id)
    const { status } = await request.json()

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    if (!['active', 'inactive', 'banned'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    console.log('🔄 Updating user status:', userId, '→', status)

    // Update user status using admin client
    const { error } = await supabaseAdmin
      .from('users')
      .update({ status })
      .eq('id', userId)

    if (error) {
      console.error('❌ Update error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ User status updated successfully')

    return NextResponse.json({
      success: true,
      message: 'User status updated successfully'
    })
  } catch (error: any) {
    console.error('❌ Error in update user status API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
