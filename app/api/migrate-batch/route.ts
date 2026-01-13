import { NextRequest, NextResponse } from 'next/server'

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function apiRequest(
  storeHash: string,
  accessToken: string,
  method: string,
  endpoint: string,
  body?: any
) {
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

  await delay(250) // Faster rate limiting (4 req/sec instead of 2)

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
  const { code, discount = 10, name } = couponData

  const promotionData = {
    name: name || `Coupon: ${code}`,
    channels: [{ id: parseInt(channelId, 10) }],
    rules: [
      {
        action: {
          cart_value: {
            discount: {
              percentage_amount: discount,
            },
          },
        },
      },
    ],
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

export async function POST(request: NextRequest) {
  try {
    const { storeHash, accessToken, channelId, codes } = await request.json()

    if (!storeHash || !accessToken || !codes || !Array.isArray(codes)) {
      return NextResponse.json(
        { error: 'Store hash, access token, and codes array are required' },
        { status: 400 }
      )
    }

    // Process the codes array directly (frontend already sends batches)
    const results = {
      deleted: [] as any[],
      created: [] as any[],
      errors: [] as any[],
    }

    for (const coupon of codes) {
      const code = coupon.code || coupon.coupon_code || coupon

      if (typeof code !== 'string') {
        results.errors.push({ 
          code: JSON.stringify(coupon), 
          error: 'Invalid coupon data: code is not a string',
          retryable: false
        })
        continue
      }

      try {
        if (coupon.oldPromotionId) {
          try {
            await deletePromotion(storeHash, accessToken, coupon.oldPromotionId)
            results.deleted.push({ code, promotionId: coupon.oldPromotionId })
          } catch (error: any) {
            // Log but continue
            console.warn(`Could not delete promotion ${coupon.oldPromotionId}:`, error.message)
          }
        }

        const created = await createStandardCoupon(storeHash, accessToken, channelId || '1', {
          code: code,
          discount: coupon.discount || 10,
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
    }

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
