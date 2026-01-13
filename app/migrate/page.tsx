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

interface ProgressState {
  processed: number
  total: number
  created: number
  deleted: number
  errors: number
  currentCode?: string
}

export default function MigratePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exportData, setExportData] = useState<any>(null)
  const [codes, setCodes] = useState<Coupon[]>([])
  const [results, setResults] = useState<any>(null)
  const [progress, setProgress] = useState<ProgressState>({
    processed: 0,
    total: 0,
    created: 0,
    deleted: 0,
    errors: 0
  })

  useEffect(() => {
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
    setProgress({ processed: 0, total: 0, created: 0, deleted: 0, errors: 0 })

    try {
      const creds = getCredentials()
      const batchSize = 50 // Process 50 promotions at a time (safe for timeouts)
      
      // Step 1: Get list of all promotions (fast - just metadata, won't timeout)
      const listResponse = await fetch('/api/export-promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeHash: creds.storeHash,
          accessToken: creds.accessToken,
        }),
      })

      const listData = await listResponse.json()
      if (!listResponse.ok) {
        throw new Error(listData.error || 'Failed to get promotion list')
      }

      const promotions = listData.promotions || []
      const totalPromotions = promotions.length
      setProgress(prev => ({ ...prev, total: totalPromotions }))

      // Step 2: Process codes in batches (client-side batching to avoid timeouts)
      const allExports: any[] = []
      let currentIndex = 0

      while (currentIndex < promotions.length) {
        const batch = promotions.slice(currentIndex, currentIndex + batchSize)
        const promotionIds = batch.map((p: any) => p.id)

        setProgress(prev => ({
          ...prev,
          processed: currentIndex,
          currentCode: `Batch ${Math.floor(currentIndex / batchSize) + 1}/${Math.ceil(totalPromotions / batchSize)}`
        }))

        const batchResponse = await fetch('/api/export-codes-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeHash: creds.storeHash,
            accessToken: creds.accessToken,
            promotionIds: promotionIds,
          }),
        })

        const batchData = await batchResponse.json()
        if (!batchResponse.ok) {
          throw new Error(batchData.error || `Batch export failed at index ${currentIndex}`)
        }

        // Merge batch data with promotion info
        batch.forEach((promotion: any, idx: number) => {
          const codesData = batchData.data.find((d: any) => d.promotionId === promotion.id)
          if (codesData) {
            allExports.push({
              promotion: promotion,
              codes: codesData.codes,
            })
          }
        })

        currentIndex += batchSize
      }

      // Compile final export data
      const exportData = {
        success: true,
        data: allExports,
        totalPromotions: listData.totalPromotions,
        totalCoupons: allExports.reduce((sum, exp) => sum + exp.codes.length, 0),
      }

      setExportData(exportData)
      const extractedCodes: Coupon[] = []
      exportData.data.forEach((exp: any) => {
        exp.codes.forEach((code: any) => {
          extractedCodes.push({
            code: code.code,
            discount: 10,
            oldPromotionId: exp.promotion.id,
            name: exp.promotion.name,
          })
        })
      })
      setCodes(extractedCodes)
      setStep(2)
      setProgress(prev => ({ ...prev, processed: totalPromotions, currentCode: undefined }))
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
    
    const creds = getCredentials()
    const batchSize = 50 // Process 50 at a time
    let currentIndex = 0
    const finalResults = {
      deleted: [] as any[],
      created: [] as any[],
      errors: [] as any[],
    }

    setProgress({
      processed: 0,
      total: codes.length,
      created: 0,
      deleted: 0,
      errors: 0
    })

    try {
      while (currentIndex < codes.length) {
        const batch = codes.slice(currentIndex, currentIndex + batchSize)
        
        setProgress(prev => ({
          ...prev,
          currentCode: batch[0]?.code
        }))

        const response = await fetch('/api/migrate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeHash: creds.storeHash,
            accessToken: creds.accessToken,
            channelId: creds.channelId,
            codes: batch,
            startIndex: currentIndex,
            batchSize: batchSize,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Batch processing failed at index ${currentIndex}`)
        }

        // Accumulate results
        finalResults.created.push(...data.results.created)
        finalResults.deleted.push(...data.results.deleted)
        finalResults.errors.push(...data.results.errors)

        // Update progress
        setProgress(prev => ({
          processed: currentIndex + batch.length,
          total: codes.length,
          created: finalResults.created.length,
          deleted: finalResults.deleted.length,
          errors: finalResults.errors.length,
          currentCode: undefined
        }))

        currentIndex += batchSize
      }

      setResults(finalResults)
      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Migration failed')
      setStep(2)
    } finally {
      setLoading(false)
      setProgress(prev => ({ ...prev, currentCode: undefined }))
    }
  }

  const downloadExportJSON = () => {
    if (!exportData || !exportData.data) return
    
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
      alert('Error generating JSON file.')
    }
  }

  const downloadExportCSV = () => {
    if (!exportData || !exportData.data) return
    
    try {
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
      alert('Error generating CSV file.')
    }
  }

  const retryFailed = async (failedCodes: any[]) => {
    if (failedCodes.length === 0) return

    setLoading(true)
    setError('')
    setStep(3)

    const creds = getCredentials()
    const retryCoupons = failedCodes.map((err: any) => 
      codes.find(c => c.code === err.code)
    ).filter(Boolean) as Coupon[]

    try {
      const response = await fetch('/api/migrate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeHash: creds.storeHash,
          accessToken: creds.accessToken,
          channelId: creds.channelId,
          codes: retryCoupons,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Retry failed')
      }

      // Merge with existing results
      if (results) {
        setResults({
          created: [...results.created, ...data.results.created],
          deleted: [...results.deleted, ...data.results.deleted],
          errors: data.results.errors, // Only new errors
        })
      } else {
        setResults(data.results)
      }

      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Retry failed')
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0

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
            First, let&apos;s create a backup of your existing coupons.
          </p>
          
          {loading && progress.total > 0 && (
            <div className="progress-container" style={{ marginBottom: '1.5rem' }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}>
                  {Math.round((progress.processed / progress.total) * 100)}%
                </div>
              </div>
              <div className="progress-text">
                Processing: {progress.processed} of {progress.total} promotions
              </div>
              {progress.currentCode && (
                <div style={{ textAlign: 'center', marginTop: '0.5rem', color: '#718096', fontSize: '0.875rem' }}>
                  {progress.currentCode}
                </div>
              )}
            </div>
          )}

          <button onClick={handleExport} className="button" disabled={loading}>
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
          
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
                {progressPercent}%
              </div>
            </div>
            <div className="progress-text">
              Processing: {progress.processed} of {progress.total} coupons
            </div>
            <div className="progress-stats">
              <span>✅ Created: {progress.created}</span>
              <span>🗑️ Deleted: {progress.deleted}</span>
              <span>❌ Errors: {progress.errors}</span>
            </div>
            {progress.currentCode && (
              <div style={{ textAlign: 'center', marginTop: '0.5rem', color: '#718096', fontSize: '0.875rem' }}>
                Current: {progress.currentCode}
              </div>
            )}
          </div>

          <p style={{ marginTop: '1.5rem', color: '#718096' }}>
            Processing at ~4 requests/second. Estimated time: {Math.ceil((progress.total - progress.processed) / 4)} seconds remaining
          </p>
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
            <div>
              <h3>Errors ({results.errors.length})</h3>
              <div className="error-list">
                {results.errors.map((err: any, idx: number) => (
                  <div key={idx} className="error-item">
                    <div className="error-details">
                      <div className="error-code">{err.code || 'Unknown'}</div>
                      <div className="error-message">{err.error}</div>
                    </div>
                    {err.retryable !== false && (
                      <button
                        className="retry-button"
                        onClick={() => retryFailed([err])}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => retryFailed(results.errors.filter((e: any) => e.retryable !== false))}
                className="button button-secondary"
                style={{ marginTop: '1rem' }}
              >
                Retry All Failed ({results.errors.filter((e: any) => e.retryable !== false).length})
              </button>
            </div>
          )}

          {results.created.length > 0 && (
            <>
              <h3>Created Coupons ({results.created.length})</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
              </div>
            </>
          )}

          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={() => {
                setStep(1)
                setExportData(null)
                setCodes([])
                setResults(null)
                setProgress({ processed: 0, total: 0, created: 0, deleted: 0, errors: 0 })
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
