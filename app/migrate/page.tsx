'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Coupon {
  code: string
  discount?: number
  oldPromotionId?: number
  name?: string
  max_uses?: number
}

export default function MigratePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exportData, setExportData] = useState<any>(null)
  const [codes, setCodes] = useState<Coupon[]>([])
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    // Check if credentials exist
    const storeHash = localStorage.getItem('bc_store_hash')
    const accessToken = localStorage.getItem('bc_access_token')
    if (!storeHash || !accessToken) {
      router.push('/setup')
    }
  }, [router])

  const getCredentials = () => {
    return {
      storeHash: localStorage.getItem('bc_store_hash') || '',
      accessToken: localStorage.getItem('bc_access_token') || '',
      channelId: localStorage.getItem('bc_channel_id') || '1',
    }
  }

  const handleExport = async () => {
    setLoading(true)
    setError('')

    try {
      const creds = getCredentials()
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeHash: creds.storeHash,
          accessToken: creds.accessToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Export failed')
      }

      setExportData(data)
      // Extract codes from export
      const extractedCodes: Coupon[] = []
      data.data.forEach((exp: any) => {
        exp.codes.forEach((code: any) => {
          extractedCodes.push({
            code: code.code,
            discount: 10, // Default
            oldPromotionId: exp.promotion.id,
            name: exp.promotion.name,
          })
        })
      })
      setCodes(extractedCodes)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const handleMigrate = async () => {
    if (codes.length === 0) {
      setError('No codes to migrate')
      return
    }

    if (!confirm(`This will delete ${codes.length} old promotions and create new ones. Continue?`)) {
      return
    }

    setLoading(true)
    setError('')
    setStep(3)

    try {
      const creds = getCredentials()
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeHash: creds.storeHash,
          accessToken: creds.accessToken,
          channelId: creds.channelId,
          codes: codes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed')
      }

      setResults(data.results)
      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Migration failed')
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const downloadExportJSON = () => {
    if (!exportData || !exportData.data) {
      console.error('No export data available')
      return
    }
    
    try {
      const blob = new Blob([JSON.stringify(exportData.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `coupon-export-${new Date().toISOString()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating JSON:', error)
      alert('Error generating JSON file. Please check the browser console for details.')
    }
  }

  const downloadExportCSV = () => {
    if (!exportData || !exportData.data) {
      console.error('No export data available')
      return
    }
    
    try {
      // Helper function to extract discount from rules
      const getDiscount = (rules: any[]) => {
        if (!rules || rules.length === 0) return 'N/A'
        
        const rule = rules[0]
        if (rule.action?.cart_value?.discount?.percentage_amount) {
          return `${rule.action.cart_value.discount.percentage_amount}%`
        }
        if (rule.action?.cart_value?.discount?.fixed_amount) {
          return `$${rule.action.cart_value.discount.fixed_amount}`
        }
        if (rule.action?.cart_items?.discount?.percentage_amount) {
          return `${rule.action.cart_items.discount.percentage_amount}% (items)`
        }
        return 'Custom'
      }
      
      // Convert to CSV format
      const csvRows = ['Code,Promotion ID,Promotion Name,Discount,Status,Max Uses,Current Uses']
      
      exportData.data.forEach((exp: any) => {
        if (exp.codes && exp.codes.length > 0) {
          exp.codes.forEach((code: any) => {
            const discount = getDiscount(exp.promotion.rules || [])
            const maxUses = code.max_uses === 0 || code.max_uses === null ? 'Unlimited' : code.max_uses
            const row = [
              code.code || '',
              exp.promotion.id || '',
              `"${(exp.promotion.name || '').replace(/"/g, '""')}"`,
              discount,
              exp.promotion.status || '',
              maxUses,
              code.current_uses || 0
            ]
            csvRows.push(row.join(','))
          })
        } else {
          // If no codes, still include the promotion
          const discount = getDiscount(exp.promotion.rules || [])
          const row = [
            '(No code)',
            exp.promotion.id || '',
            `"${(exp.promotion.name || '').replace(/"/g, '""')}"`,
            discount,
            exp.promotion.status || '',
            '',
            ''
          ]
          csvRows.push(row.join(','))
        }
      })
      
      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `coupon-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating CSV:', error)
      alert('Error generating CSV file. Please check the browser console for details.')
    }
  }

  return (
    <div className="container">
      <h1>Migrate Coupons</h1>

      <div className="step-indicator">
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div>Export</div>
        </div>
        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div>Review</div>
        </div>
        <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <div className="step-number">3</div>
          <div>Migrate</div>
        </div>
        <div className={`step ${step >= 4 ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div>Results</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>Step 1: Export Current Coupons</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            First, let&apos;s create a backup of your existing coupons. This downloads all your current
            coupon codes so you have a record before migration.
          </p>
          <button
            onClick={handleExport}
            className="button"
            disabled={loading}
          >
            {loading && <span className="loading"></span>}
            {loading ? 'Exporting...' : 'Export Coupons'}
          </button>
        </div>
      )}

      {step === 2 && exportData && (
        <div className="card">
          <h2>Step 2: Review Your Coupons</h2>
          <div className="alert alert-success">
            ✅ Exported {exportData.totalCoupons} coupon codes from {exportData.totalPromotions} promotions
          </div>
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={downloadExportCSV} className="button button-secondary">
              📊 Download CSV (Excel)
            </button>
            <button onClick={downloadExportJSON} className="button button-secondary">
              📄 Download JSON (Backup)
            </button>
          </div>

          <h3>Coupons to Migrate ({codes.length})</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((coupon, idx) => (
                  <tr key={idx}>
                    <td><strong>{coupon.code}</strong></td>
                    <td>{coupon.discount}%</td>
                    <td>{coupon.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleMigrate}
            className="button"
            disabled={loading || codes.length === 0}
          >
            {loading && <span className="loading"></span>}
            {loading ? 'Migrating...' : `Migrate ${codes.length} Coupons`}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>Step 3: Migration in Progress</h2>
          <p>Please wait while we migrate your coupons. This may take a few minutes...</p>
          {loading && <div className="loading" style={{ display: 'block', margin: '2rem auto' }}></div>}
        </div>
      )}

      {step === 4 && results && (
        <div className="card">
          <h2>✅ Migration Complete!</h2>
          <div className="alert alert-success">
            Successfully migrated {results.created.length} coupons!
          </div>

          <h3>Summary</h3>
          <ul style={{ lineHeight: '2', marginBottom: '2rem' }}>
            <li>✅ Created: {results.created.length} new coupons</li>
            <li>🗑️ Deleted: {results.deleted.length} old promotions</li>
            <li>❌ Errors: {results.errors.length}</li>
          </ul>

          {results.errors.length > 0 && (
            <div className="alert alert-error">
              <strong>Errors:</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                {results.errors.map((err: any, idx: number) => (
                  <li key={idx}>{err.code}: {err.error}</li>
                ))}
              </ul>
            </div>
          )}

          <h3>Created Coupons</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Promotion ID</th>
                <th>Coupon ID</th>
              </tr>
            </thead>
            <tbody>
              {results.created.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td><strong>{item.code}</strong></td>
                  <td>{item.promotionId}</td>
                  <td>{item.couponId}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={() => {
                setStep(1)
                setExportData(null)
                setCodes([])
                setResults(null)
              }}
              className="button"
            >
              Start New Migration
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
