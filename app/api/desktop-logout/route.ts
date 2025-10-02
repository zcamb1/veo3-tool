import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      )
    }

    console.log(`🚪 [LOGOUT] User: ${username}`)

    // Update last_login timestamp in database
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        last_login: new Date().toISOString()
      })
      .eq('username', username)

    if (error) {
      console.error('❌ [LOGOUT] Database error:', error)
      // Don't fail logout even if DB update fails
    } else {
      console.log('✅ [LOGOUT] Last login updated')
    }

    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    })

  } catch (error: any) {
    console.error('❌ [LOGOUT] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
