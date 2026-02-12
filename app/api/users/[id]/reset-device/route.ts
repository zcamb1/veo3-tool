import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Reset Device Binding API
 * 
 * Endpoint: POST /api/users/[id]/reset-device
 * 
 * This allows admin to reset a user's device_id to NULL,
 * enabling the user to login from a different device.
 * 
 * Returns:
 * - 200: Device reset successfully
 * - 400: Invalid user ID
 * - 404: User not found
 * - 500: Server error
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const userId = parseInt(params.id)

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    console.log('🔄 [RESET DEVICE] Resetting device for user ID:', userId)

    // Check if user exists
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, username, device_id')
      .eq('id', userId)
      .single()

    if (fetchError || !user) {
      console.error('❌ [RESET DEVICE] User not found:', userId)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('👤 [RESET DEVICE] User:', user.username)
    console.log('   Current device_id:', user.device_id || 'NULL')

    // Reset device_id to NULL
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ device_id: null })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ [RESET DEVICE] Update error:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ [RESET DEVICE] Device reset successfully for user:', user.username)

    return NextResponse.json({
      success: true,
      message: `Device reset successfully. User ${user.username} can now login from a new device.`,
      user: {
        id: user.id,
        username: user.username,
        device_id: null
      }
    })

  } catch (error: any) {
    console.error('💥 [RESET DEVICE] Exception:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
