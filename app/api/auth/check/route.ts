import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_SECRET = 'kztool_admin_secret_2025'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) {
      return NextResponse.json(
        { authenticated: false, error: 'No session found' },
        { status: 401 }
      )
    }

    // Validate session token
    try {
      const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8')
      const [username, timestamp, secret] = decoded.split(':')

      if (secret !== SESSION_SECRET) {
        throw new Error('Invalid session')
      }

      // Check if session expired (7 days)
      const sessionAge = Date.now() - parseInt(timestamp)
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

      if (sessionAge > maxAge) {
        throw new Error('Session expired')
      }

      return NextResponse.json({
        authenticated: true,
        username
      })
    } catch (error) {
      // Invalid token format
      cookieStore.delete(SESSION_COOKIE_NAME)
      return NextResponse.json(
        { authenticated: false, error: 'Invalid session' },
        { status: 401 }
      )
    }
  } catch (error: any) {
    console.error('❌ Check auth error:', error)
    return NextResponse.json(
      { authenticated: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
