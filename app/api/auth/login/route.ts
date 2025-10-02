import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_USERNAME = 'kztool'
const ADMIN_PASSWORD = 'veo3'
const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_SECRET = 'kztool_admin_secret_2025' // In production, use env variable

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Validate credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Create session token (simple implementation)
      const sessionToken = Buffer.from(
        `${username}:${Date.now()}:${SESSION_SECRET}`
      ).toString('base64')

      // Set HTTP-Only cookie
      const cookieStore = await cookies()
      cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,      // Cannot be accessed by JavaScript
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',  // CSRF protection
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })

      return NextResponse.json({
        success: true,
        message: 'Login successful',
        username
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }
  } catch (error: any) {
    console.error('❌ Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
