import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * API endpoint để serve script.js cho desktop tool
 * Protected script - chỉ client tool mới dùng
 */
export async function GET() {
  try {
    // Đọc script.js từ folder protected
    const scriptPath = join(process.cwd(), 'protected', 'script.js')
    const scriptContent = readFileSync(scriptPath, 'utf-8')
    
    console.log('✅ [GET-SCRIPT] Serving script.js to client')
    
    // Return script với content-type javascript
    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Origin': '*', // Allow CORS for desktop tool
      }
    })
  } catch (error: any) {
    console.error('❌ [GET-SCRIPT] Error reading script.js:', error)
    return NextResponse.json(
      { error: 'Failed to load script' },
      { status: 500 }
    )
  }
}

