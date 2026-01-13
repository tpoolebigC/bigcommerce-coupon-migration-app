import { NextRequest, NextResponse } from 'next/server'

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken, startIndex = 0, batchSize = 100 } = await request.json()

    if (!storeHash || !accessToken) {
      return NextResponse.json(
        { error: 'Store hash and access token are required' },
        { status: 400 }
      )
    }

    const API_BASE = `https://api.bigcommerce.com/stores/${storeHash}/v3`
    
    // First, get all promotions (this is fast - just metadata)
    const promotions: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await fetch(`${API_BASE}/promotions?page=${page}&limit=250`, {
        headers: {
          'X-Auth-Token': accessToken,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch promotions: ${response.statusText}`)
      }

      const data = await response.json()
      promotions.push(...data.data)

      const pagination = data.meta?.pagination
      if (pagination && page < pagination.total_pages) {
        page++
      } else {
        hasMore = false
      }
    }

    // Filter to only coupon promotions
    const couponPromotions = promotions.filter(p => p.redemption_type === 'COUPON')
    
    // Return promotion list if this is the first request (to get total count)
    if (startIndex === 0) {
      return NextResponse.json({
        success: true,
        totalPromotions: promotions.length,
        totalCouponPromotions: couponPromotions.length,
        promotions: couponPromotions.map(p => ({
          id: p.id,
          name: p.name,
          redemption_type: p.redemption_type,
          status: p.status,
        })),
      })
    }

    // Process a batch of codes (fetch codes for specific promotions)
    const batchPromotions = couponPromotions.slice(startIndex, startIndex + batchSize)
    const exports = []

    for (const promotion of batchPromotions) {
      try {
        await delay(250) // Rate limiting: 4 req/sec
        const codesResponse = await fetch(`${API_BASE}/promotions/${promotion.id}/codes`, {
          headers: {
            'X-Auth-Token': accessToken,
            'Accept': 'application/json',
          },
        })

        if (codesResponse.ok) {
          const codesData = await codesResponse.json()
          exports.push({
            promotion: {
              id: promotion.id,
              name: promotion.name,
              redemption_type: promotion.redemption_type,
              status: promotion.status,
              rules: promotion.rules || [],
            },
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
      hasMore: startIndex + batchSize < couponPromotions.length,
      nextIndex: startIndex + batchSize,
      processed: startIndex + batchSize,
      total: couponPromotions.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
