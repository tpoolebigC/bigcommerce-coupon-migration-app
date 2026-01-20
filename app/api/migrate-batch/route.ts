import { NextRequest, NextResponse } from 'next/server'

// Rate limiting: track last request time per endpoint type
let lastV2Request = 0
let lastV3Request = 0
const MIN_REQUEST_INTERVAL = 200 // 200ms = ~5 req/sec per endpoint type

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function rateLimitedRequest(endpointType: 'v2' | 'v3') {
  const now = Date.now()
  const lastRequest = endpointType === 'v2' ? lastV2Request : lastV3Request
  const timeSinceLastRequest = now - lastRequest
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest)
  }
  
  if (endpointType === 'v2') {
    lastV2Request = Date.now()
  } else {
    lastV3Request = Date.now()
  }
}

async function apiRequest(
  storeHash: string,
  accessToken: string,
  method: string,
  endpoint: string,
  body?: any
) {
  await rateLimitedRequest('v3')
  
  const url = `https://api.bigcommerce.com/stores/${storeHash}/v3${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      'X-Auth-Token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText.substring(0, 200)}`)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  } catch (error: any) {
    // Re-throw with more context
    if (error.message.includes('fetch failed')) {
      throw new Error(`Network error: Connection failed. Check your internet connection.`)
    }
    throw error
  }
}

async function deleteLegacyCoupon(storeHash: string, accessToken: string, couponId: number) {
  try {
    await rateLimitedRequest('v2')
    const url = `https://api.bigcommerce.com/stores/${storeHash}/v2/coupons/${couponId}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Auth-Token': accessToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText.substring(0, 200)}`)
    }

    return true
  } catch (error: any) {
    throw new Error(`Failed to delete legacy coupon ${couponId}: ${error.message}`)
  }
}

async function deletePromotion(storeHash: string, accessToken: string, promotionId: number) {
  try {
    const codesResponse = await apiRequest(storeHash, accessToken, 'GET', `/promotions/${promotionId}/codes`)
    const codes = codesResponse?.data || []

    for (const code of codes) {
      try {
        await apiRequest(storeHash, accessToken, 'DELETE', `/promotions/${promotionId}/codes/${code.id}`)
      } catch (error) {
        // Continue even if code deletion fails
      }
    }

    await apiRequest(storeHash, accessToken, 'DELETE', `/promotions/${promotionId}`)
    return true
  } catch (error: any) {
    throw new Error(`Failed to delete promotion ${promotionId}: ${error.message}`)
  }
}

async function createStandardCoupon(
  storeHash: string,
  accessToken: string,
  channelId: string,
  couponData: any
) {
  const { code, discount = 10, discountType = 'percentage', name } = couponData

  // Build promotion rules based on discount type
  let rules: any[] = []

  if (discountType === 'fixed') {
    // Fixed dollar amount discount on cart value
    rules = [
      {
        action: {
          cart_value: {
            discount: {
              fixed_amount: discount,
            },
          },
        },
      },
    ]
  } else if (discountType === 'per_item') {
    // Percentage discount on each item (cart_items)
    rules = [
      {
        action: {
          cart_items: {
            discount: {
              percentage_amount: discount,
            },
          },
        },
      },
    ]
  } else {
    // Default: percentage discount on cart value
    rules = [
      {
        action: {
          cart_value: {
            discount: {
              percentage_amount: discount,
            },
          },
        },
      },
    ]
  }

  const promotionData = {
    name: name || `Coupon: ${code}`,
    channels: [{ id: parseInt(channelId, 10) }],
    rules: rules,
    redemption_type: 'COUPON',
    status: 'ENABLED',
  }

  const promotionResponse = await apiRequest(storeHash, accessToken, 'POST', '/promotions', promotionData)
  const promotionId = promotionResponse.data.id

  const couponResponse = await apiRequest(storeHash, accessToken, 'POST', `/promotions/${promotionId}/codes`, {
    code: code,
    max_uses: couponData.max_uses || null,
  })

  return {
    promotionId: promotionId,
    couponId: couponResponse.data.id,
    code: code,
  }
}

// Process coupons in parallel with concurrency control
async function processCouponsInParallel(
  coupons: any[],
  storeHash: string,
  accessToken: string,
  channelId: string,
  concurrency: number = 5
) {
  const results = {
    deleted: [] as any[],
    created: [] as any[],
    errors: [] as any[],
  }

  // Process coupons in batches with concurrency limit
  for (let i = 0; i < coupons.length; i += concurrency) {
    const batch = coupons.slice(i, i + concurrency)
    
    await Promise.all(
      batch.map(async (coupon) => {
        const code = coupon.code || coupon.coupon_code || coupon

        if (typeof code !== 'string') {
          results.errors.push({ 
            code: JSON.stringify(coupon), 
            error: 'Invalid coupon data: code is not a string',
            retryable: false
          })
          return
        }

        try {
          // Delete legacy coupon if oldCouponId is provided (V2 API)
          if (coupon.oldCouponId) {
            try {
              await deleteLegacyCoupon(storeHash, accessToken, coupon.oldCouponId)
              results.deleted.push({ code, couponId: coupon.oldCouponId, type: 'legacy' })
            } catch (error: any) {
              // Log but continue
              console.warn(`Could not delete legacy coupon ${coupon.oldCouponId}:`, error.message)
            }
          }
          
          // Delete standard promotion if oldPromotionId is provided (V3 API)
          if (coupon.oldPromotionId) {
            try {
              await deletePromotion(storeHash, accessToken, coupon.oldPromotionId)
              results.deleted.push({ code, promotionId: coupon.oldPromotionId, type: 'standard' })
            } catch (error: any) {
              // Log but continue
              console.warn(`Could not delete promotion ${coupon.oldPromotionId}:`, error.message)
            }
          }

          const created = await createStandardCoupon(storeHash, accessToken, channelId || '1', {
            code: code,
            discount: coupon.discount || 10,
            discountType: coupon.discountType || 'percentage',
            name: coupon.name,
            max_uses: coupon.max_uses,
          })

          results.created.push(created)
        } catch (error: any) {
          // Enhanced error information
          let errorMessage = error.message || 'Unknown error'
          
          // Provide actionable error messages
          if (errorMessage.includes('422')) {
            errorMessage = `Code already exists or invalid format: ${code}`
          } else if (errorMessage.includes('429')) {
            errorMessage = `Rate limit exceeded. Please wait and retry.`
          } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
            errorMessage = `Authentication failed. Please check your API credentials.`
          } else if (errorMessage.includes('Network error')) {
            errorMessage = `Network connection failed. Check your internet and retry.`
          }

          results.errors.push({ 
            code, 
            error: errorMessage,
            retryable: !errorMessage.includes('already exists')
          })
        }
      })
    )
  }

  return results
}

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken, channelId, codes } = await request.json()

    if (!storeHash || !accessToken || !codes || !Array.isArray(codes)) {
      return NextResponse.json(
        { error: 'Store hash, access token, and codes array are required' },
        { status: 400 }
      )
    }

    // Process coupons in parallel (5 at a time) for better performance
    // Rate limiting is handled within the API request functions
    const results = await processCouponsInParallel(
      codes,
      storeHash,
      accessToken,
      channelId || '1',
      5 // Process 5 coupons concurrently
    )

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    )
  }
}
