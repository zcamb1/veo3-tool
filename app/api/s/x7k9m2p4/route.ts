import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import jwt from 'jsonwebtoken'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Secret key từ environment (Vercel ENV)
const SECRET = process.env.SCRIPT_SECRET || 'kz-minimax-2024-secret'

/**
 * Protected script endpoint với JWT authentication
 * Path obfuscated: /api/s/x7k9m2p4
 * 
 * Tool gửi: Authorization: Bearer <jwt-token>
 * Server verify JWT với SECRET (chỉ server biết)
 */
export async function GET(req: Request) {
  try {
    // ============================================
    // 🔒 CHECK: Authorization Header
    // ============================================
    const auth = req.headers.get('authorization')
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Extract token from "Bearer <token>"
    const token = auth.split(' ')[1]
    
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      )
    }

    // ============================================
    // 🔒 VERIFY: JWT Token
    // ============================================
    try {
      // Verify JWT signature với SECRET
      const payload = jwt.verify(token, SECRET) as any
      
      // Optional: Check payload claims
      if (payload.sub !== 'kz-tool-client') {
        return NextResponse.json(
          { error: 'Invalid token subject' },
          { status: 403 }
        )
      }
      
      console.log('✅ [SCRIPT-API] Valid JWT - Client authenticated')
      
    } catch (jwtError: any) {
      console.error('❌ [SCRIPT-API] JWT verification failed:', jwtError.message)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // ============================================
    // ✅ AUTHENTICATED - Serve Script
    // ============================================
    const scriptPath = join(process.cwd(), 'protected', 'script.js')
    const scriptContent = readFileSync(scriptPath, 'utf-8')
    
    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Origin': '*',
      }
    })
    
  } catch (error: any) {
    console.error('❌ [SCRIPT-API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}






