import { NextRequest, NextResponse } from 'next/server'

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken, promotionIds } = await request.json()

    if (!storeHash || !accessToken || !promotionIds || !Array.isArray(promotionIds)) {
      return NextResponse.json(
        { error: 'Store hash, access token, and promotion IDs array are required' },
        { status: 400 }
      )
    }

    const API_BASE = `https://api.bigcommerce.com/stores/${storeHash}/v3`
    const exports = []

    // Fetch codes for each promotion (with rate limiting)
    for (const promotionId of promotionIds) {
      try {
        await delay(250) // Rate limiting: 4 req/sec
        const codesResponse = await fetch(`${API_BASE}/promotions/${promotionId}/codes`, {
          headers: {
            'X-Auth-Token': accessToken,
            'Accept': 'application/json',
          },
        })

        if (codesResponse.ok) {
          const codesData = await codesResponse.json()
          exports.push({
            promotionId: promotionId,
            codes: codesData.data || [],
          })
        }
      } catch (error) {
        // Skip promotions that can't fetch codes
      }
    }

    return NextResponse.json({
      success: true,
      data: exports,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Batch export failed' },
      { status: 500 }
    )
  }
}
