import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, device_id } = body

    console.log('🔐 [LOGIN API] Login attempt:', { username, device_id: device_id?.substring(0, 16) })

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password required' },
        { status: 400 }
      )
    }

    // Query user by username
    const { data: users, error: queryError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .limit(1)

    if (queryError) {
      console.error('❌ [LOGIN API] Query error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      console.log('❌ [LOGIN API] User not found:', username)
      return NextResponse.json(
        { success: false, error: 'Username không tồn tại' },
        { status: 401 }
      )
    }

    const user = users[0]

    // Verify password with bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      console.log('❌ [LOGIN API] Password mismatch for user:', username)
      return NextResponse.json(
        { success: false, error: 'Sai mật khẩu' },
        { status: 401 }
      )
    }

    // Check account status
    if (user.status !== 'active') {
      console.log('❌ [LOGIN API] Account not active:', user.status)
      return NextResponse.json(
        { success: false, error: `Tài khoản đã bị ${user.status}` },
        { status: 403 }
      )
    }

    console.log('✅ [LOGIN API] Password verified for:', username)

    // Handle device binding
    if (device_id) {
      const storedDeviceId = user.device_id

      if (!storedDeviceId) {
        // First login - bind device
        console.log('🆕 [LOGIN API] First login - binding device')
        
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            device_id: device_id,
            last_login: new Date().toISOString()
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('⚠️ [LOGIN API] Failed to bind device:', updateError)
        } else {
          console.log('✅ [LOGIN API] Device bound successfully')
          user.device_id = device_id
        }

      } else if (storedDeviceId !== device_id) {
        // Different device - reject
        console.log('❌ [LOGIN API] Device mismatch!')
        console.log('   Expected:', storedDeviceId.substring(0, 16))
        console.log('   Got:', device_id.substring(0, 16))
        
        return NextResponse.json(
          {
            success: false,
            error: 'Tài khoản đã được kích hoạt trên thiết bị khác!\n\n💡 Liên hệ admin để reset device binding.'
          },
          { status: 403 }
        )

      } else {
        // Same device - update last login
        console.log('✅ [LOGIN API] Device verified')
        
        await supabaseAdmin
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', user.id)
      }
    }

    // Return user data (exclude password_hash)
    const { password_hash, ...userData } = user

    console.log('✅ [LOGIN API] Login successful:', username)

    return NextResponse.json({
      success: true,
      message: `✅ Đăng nhập thành công! Quyền: ${user.account_type}`,
      user: userData
    })

  } catch (error: any) {
    console.error('💥 [LOGIN API] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
