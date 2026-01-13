'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Home() {
  const [hasCredentials, setHasCredentials] = useState(false)

  useEffect(() => {
    // Check if credentials are stored
    const storeHash = localStorage.getItem('bc_store_hash')
    const accessToken = localStorage.getItem('bc_access_token')
    setHasCredentials(!!(storeHash && accessToken))
  }, [])

  return (
    <div className="container">
      <h1>BigCommerce Coupon Migration Tool</h1>
      <p style={{ marginBottom: '2rem', color: '#718096' }}>
        Easily migrate your legacy coupon codes to BigCommerce standard edition promotions
      </p>

      {hasCredentials ? (
        <div className="card">
          <h2>✅ Credentials Configured</h2>
          <p style={{ marginBottom: '1rem' }}>
            Your BigCommerce credentials are saved. You can start the migration process.
          </p>
          <Link href="/setup" className="button button-secondary" style={{ marginRight: '1rem' }}>
            Update Credentials
          </Link>
          <Link href="/migrate" className="button">
            Start Migration
          </Link>
        </div>
      ) : (
        <div className="card">
          <h2>🚀 Get Started</h2>
          <p style={{ marginBottom: '1rem' }}>
            First, you&apos;ll need to configure your BigCommerce API credentials.
            Don&apos;t worry - we&apos;ll guide you through it step by step!
          </p>
          <Link href="/setup" className="button">
            Configure Credentials
          </Link>
        </div>
      )}

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>How It Works</h3>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>Configure Credentials:</strong> Enter your BigCommerce API credentials (one-time setup)</li>
          <li><strong>Export Current Coupons:</strong> Download a backup of your existing coupons</li>
          <li><strong>Review & Edit:</strong> Review your coupon codes and make any necessary changes</li>
          <li><strong>Migrate:</strong> The tool will delete old promotions and create new standard edition coupons</li>
          <li><strong>Done!</strong> Your coupons are now in the standard format</li>
        </ol>
      </div>
    </div>
  )
}
