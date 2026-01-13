import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken } = await request.json()

    if (!storeHash || !accessToken) {
      return NextResponse.json(
        { error: 'Store hash and access token are required' },
        { status: 400 }
      )
    }

    const API_BASE = `https://api.bigcommerce.com/stores/${storeHash}/v3`
    const promotions: any[] = []
    let page = 1
    let hasMore = true

    // Fetch all promotions (just metadata - fast)
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

    return NextResponse.json({
      success: true,
      totalPromotions: promotions.length,
      totalCouponPromotions: couponPromotions.length,
      promotions: couponPromotions.map(p => ({
        id: p.id,
        name: p.name,
        redemption_type: p.redemption_type,
        status: p.status,
        rules: p.rules || [],
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
