import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Fetching users with supabaseAdmin...')
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching users:', error)
      throw error
    }

    console.log('✅ Fetched users:', data?.length || 0)
    console.log('📋 Users data:', JSON.stringify(data, null, 2))

    return NextResponse.json({
      success: true,
      users: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('❌ Error in fetch users API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
