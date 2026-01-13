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

    // Fetch all promotions
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

    // Fetch coupon codes for each promotion
    const exports = []
    for (const promotion of promotions) {
      if (promotion.redemption_type === 'COUPON') {
        try {
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
    }

    return NextResponse.json({
      success: true,
      data: exports,
      totalPromotions: promotions.length,
      totalCoupons: exports.reduce((sum, exp) => sum + exp.codes.length, 0),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
