import { NextRequest, NextResponse } from 'next/server'

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken } = await request.json()

    if (!storeHash || !accessToken) {
      return NextResponse.json(
        { error: 'Store hash and access token are required' },
        { status: 400 }
      )
    }

    const API_BASE = `https://api.bigcommerce.com/stores/${storeHash}/v2`
    const coupons: any[] = []
    let page = 1
    let hasMore = true

    // Fetch all legacy coupons from V2 API
    while (hasMore) {
      await delay(250) // Rate limiting: 4 req/sec
      
      const response = await fetch(`${API_BASE}/coupons?page=${page}&limit=250`, {
        headers: {
          'X-Auth-Token': accessToken,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch coupons: ${response.statusText} - ${errorText.substring(0, 200)}`)
      }

      const data = await response.json()
      
      // V2 API returns array directly, not wrapped in data property
      if (Array.isArray(data)) {
        coupons.push(...data)
        // If we got fewer than the limit, we've reached the end
        hasMore = data.length === 250
        page++
      } else {
        // Some V2 endpoints wrap in data, check both formats
        const couponList = data.data || data
        if (Array.isArray(couponList)) {
          coupons.push(...couponList)
          hasMore = couponList.length === 250 && page < (data.meta?.pagination?.total_pages || 999)
          page++
        } else {
          hasMore = false
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalCoupons: coupons.length,
      coupons: coupons,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}
