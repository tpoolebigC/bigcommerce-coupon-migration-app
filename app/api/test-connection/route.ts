import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken, channelId } = await request.json()

    if (!storeHash || !accessToken) {
      return NextResponse.json(
        { error: 'Store hash and access token are required' },
        { status: 400 }
      )
    }

    const API_BASE = `https://api.bigcommerce.com/stores/${storeHash}/v3`

    // Test store connection
    const storeResponse = await fetch(`${API_BASE.replace('/v3', '/v2')}/store`, {
      headers: {
        'X-Auth-Token': accessToken,
        'Accept': 'application/json',
      },
    })

    if (!storeResponse.ok) {
      throw new Error('Invalid credentials or store not found')
    }

    // Test promotions API
    const promotionsResponse = await fetch(`${API_BASE}/promotions?limit=1`, {
      headers: {
        'X-Auth-Token': accessToken,
        'Accept': 'application/json',
      },
    })

    if (!promotionsResponse.ok) {
      const errorText = await promotionsResponse.text()
      throw new Error(`Promotions API access denied: ${errorText}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Connection failed' },
      { status: 500 }
    )
  }
}
