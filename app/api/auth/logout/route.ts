import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'admin_session'

export async function POST() {
  try {
    // Clear session cookie
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)

    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    })
  } catch (error: any) {
    console.error('❌ Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
