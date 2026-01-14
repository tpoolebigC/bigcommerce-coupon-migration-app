'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Coupon {
  code: string
  discount?: number
  discountType?: 'percentage' | 'fixed' | 'per_item'
  oldPromotionId?: number
  oldCouponId?: number
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

  const handleImportCodes = (importedCodes: Coupon[]) => {
    setError('')
    setCodes(importedCodes)
    
    // Create mock export data for compatibility
    setExportData({
      success: true,
      data: importedCodes.map(coupon => ({
        promotion: {
          id: coupon.oldPromotionId || 0,
          name: coupon.name || `Coupon: ${coupon.code}`,
        },
        codes: [{
          code: coupon.code,
          discount: coupon.discount || 10,
        }],
      })),
      totalPromotions: importedCodes.length,
      totalCoupons: importedCodes.length,
    })
    
    setStep(2)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const fileName = file.name.toLowerCase()
        
        let importedCodes: Coupon[] = []
        
        if (fileName.endsWith('.csv')) {
          // Parse CSV file
          const lines = content.split('\n').filter(line => line.trim())
          if (lines.length < 2) {
            setError('CSV file must have a header row and at least one data row.')
            return
          }
          
          // Parse header
          const headers = lines[0].split(',').map(h => h.trim())
          const codeIndex = headers.findIndex(h => h.toLowerCase() === 'code')
          const idIndex = headers.findIndex(h => h.toLowerCase().includes('coupon id') || h.toLowerCase().includes('id'))
          const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'))
          const discountIndex = headers.findIndex(h => h.toLowerCase() === 'discount')
          const maxUsesIndex = headers.findIndex(h => h.toLowerCase().includes('max uses'))
          
          if (codeIndex === -1) {
            setError('CSV file must have a "Code" column.')
            return
          }
          
          // Parse CSV rows (skip header)
          const typeIndex = headers.findIndex(h => h.toLowerCase() === 'type')
          importedCodes = lines.slice(1).map((line, idx) => {
            // Handle quoted fields
            const fields: string[] = []
            let currentField = ''
            let inQuotes = false
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                  currentField += '"'
                  i++ // Skip next quote
                } else {
                  inQuotes = !inQuotes
                }
              } else if (char === ',' && !inQuotes) {
                fields.push(currentField.trim())
                currentField = ''
              } else {
                currentField += char
              }
            }
            fields.push(currentField.trim()) // Add last field
            
            const code = fields[codeIndex]?.trim()
            if (!code) return null
            
            const discountStr = fields[discountIndex] || '10'
            const discount = parseFloat(discountStr) || 10
            
            // Parse discount type from Type column
            const typeStr = typeIndex >= 0 ? fields[typeIndex]?.toLowerCase() : 'percentage_discount'
            let discountType: 'percentage' | 'fixed' | 'per_item' = 'percentage'
            if (typeStr?.includes('fixed')) {
              discountType = 'fixed'
            } else if (typeStr?.includes('per_item') || typeStr?.includes('per item')) {
              discountType = 'per_item'
            } else {
              discountType = 'percentage'
            }
            
            const maxUsesStr = fields[maxUsesIndex]?.trim().toLowerCase()
            const max_uses = maxUsesStr === 'unlimited' || !maxUsesStr ? null : parseInt(maxUsesStr) || null
            
            return {
              code,
              discount,
              discountType,
              oldCouponId: idIndex >= 0 && fields[idIndex] ? parseInt(fields[idIndex]) : undefined,
              name: nameIndex >= 0 ? fields[nameIndex]?.replace(/^"|"$/g, '') : undefined,
              max_uses,
            }
          }).filter((code): code is Coupon => code !== null)
          
          if (importedCodes.length === 0) {
            setError('No valid codes found in CSV file.')
            return
          }
        } else {
          // Parse JSON file
          const parsed = JSON.parse(content)
          
          if (!Array.isArray(parsed)) {
            setError('Invalid file format. Expected a JSON array of coupon codes.')
            return
          }

          // Validate and transform codes
          importedCodes = parsed.map((item: any) => ({
            code: item.code || item.coupon_code || item,
            discount: item.discount || 10,
            discountType: item.discountType || item.discount_type || 'percentage',
            oldCouponId: item.oldCouponId || item['Coupon ID'],
            oldPromotionId: item.oldPromotionId,
            name: item.name || item.promotion_name || item['Coupon Name'],
            max_uses: item.max_uses === 'Unlimited' || item.max_uses === null || item.max_uses === undefined ? null : item.max_uses,
          }))
        }

        if (importedCodes.length === 0) {
          setError('No valid codes found in file.')
          return
        }

        handleImportCodes(importedCodes)
      } catch (error: any) {
        setError(`Error parsing file: ${error.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handlePasteJSON = () => {
    const jsonText = prompt('Paste your JSON codes array:')
    if (!jsonText) return

    try {
      const importedCodes = JSON.parse(jsonText)
      
      if (!Array.isArray(importedCodes)) {
        setError('Invalid format. Expected a JSON array of coupon codes.')
        return
      }

      // Validate and transform codes
      const codes: Coupon[] = importedCodes.map((item: any) => ({
        code: item.code || item.coupon_code || item,
        discount: item.discount || 10,
        discountType: item.discountType || item.discount_type || 'percentage',
        oldCouponId: item.oldCouponId,
        oldPromotionId: item.oldPromotionId,
        name: item.name || item.promotion_name,
        max_uses: item.max_uses,
      }))

      if (codes.length === 0) {
        setError('No valid codes found.')
        return
      }

      handleImportCodes(codes)
    } catch (error: any) {
      setError(`Error parsing JSON: ${error.message}`)
    }
  }

  const handleExport = async () => {
    setLoading(true)
    setError('')
    setProgress({ processed: 0, total: 0, created: 0, deleted: 0, errors: 0 })

    try {
      const creds = getCredentials()
      
      // Export legacy coupons from V2 API
      const response = await fetch('/api/export-legacy-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeHash: creds.storeHash,
          accessToken: creds.accessToken,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to export legacy coupons')
      }

      const coupons = data.coupons || []
      const totalCoupons = coupons.length
      
      setProgress(prev => ({ ...prev, total: totalCoupons, processed: totalCoupons }))

      // Map legacy coupon structure to our Coupon interface
      const extractedCodes: Coupon[] = coupons.map((coupon: any) => {
        // Extract discount from legacy coupon structure
        // V2 coupons have: type (percentage_discount/fixed_discount/per_item_discount) and amount
        let discount = 10 // default
        let discountType: 'percentage' | 'fixed' | 'per_item' = 'percentage'
        
        if (coupon.type === 'percentage_discount' || coupon.type === 'percentage') {
          discountType = 'percentage'
          discount = coupon.amount ? parseFloat(coupon.amount) : 10
        } else if (coupon.type === 'fixed_discount' || coupon.type === 'fixed') {
          discountType = 'fixed'
          discount = coupon.amount ? parseFloat(coupon.amount) : 10
        } else if (coupon.type === 'per_item_discount') {
          discountType = 'per_item'
          discount = coupon.amount ? parseFloat(coupon.amount) : 10
        } else if (coupon.amount) {
          // Default to percentage if type is unknown but amount exists
          discount = parseFloat(coupon.amount)
        }

        return {
          code: coupon.code,
          discount: discount,
          discountType: discountType,
          oldCouponId: coupon.id,
          name: coupon.name,
          max_uses: coupon.max_uses || null,
        }
      })

      // Create export data structure for compatibility with CSV/JSON download
      const exportData = {
        success: true,
        data: coupons.map((coupon: any) => ({
          coupon: coupon,
          codes: [{
            code: coupon.code,
            discount: coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount}`,
          }],
        })),
        totalCoupons: totalCoupons,
        totalPromotions: totalCoupons, // For compatibility
      }

      setExportData(exportData)
      setCodes(extractedCodes)
      setStep(2)
      setProgress(prev => ({ ...prev, currentCode: undefined }))
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

    if (!confirm(`This will delete ${codes.length} legacy coupon codes and create new standard promotions. Continue?`)) {
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
    if (!codes || codes.length === 0) return
    
    try {
      // Export in the format expected by the import (array of coupon objects)
      const exportFormat = codes.map(coupon => ({
        code: coupon.code,
        discount: coupon.discount || 10,
        discountType: coupon.discountType || 'percentage',
        oldCouponId: coupon.oldCouponId,
        name: coupon.name,
        max_uses: coupon.max_uses,
      }))
      
      const blob = new Blob([JSON.stringify(exportFormat, null, 2)], { type: 'application/json' })
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
      const csvRows = ['Code,Coupon ID,Coupon Name,Discount,Type,Enabled,Max Uses,Current Uses,Min Purchase,Expires']
      
      exportData.data.forEach((item: any) => {
        const coupon = item.coupon || item
        if (coupon.code) {
          const discount = coupon.type === 'percentage' 
            ? `${coupon.amount}%` 
            : coupon.type === 'fixed' 
            ? `$${coupon.amount}`
            : coupon.amount || 'N/A'
          const maxUses = coupon.max_uses === 0 || coupon.max_uses === null ? 'Unlimited' : coupon.max_uses
          const enabled = coupon.enabled ? 'Yes' : 'No'
          const expires = coupon.expires || 'N/A'
          const minPurchase = coupon.min_purchase ? `$${coupon.min_purchase}` : 'N/A'
          
          const row = [
            coupon.code || '',
            coupon.id || '',
            `"${(coupon.name || '').replace(/"/g, '""')}"`,
            discount,
            coupon.type || '',
            enabled,
            maxUses,
            coupon.num_uses || 0,
            minPurchase,
            expires
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
          <h2>Step 1: Export or Import Coupons</h2>
          
          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f7fafc', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Option 1: Export Legacy Coupons from BigCommerce</h3>
            <p style={{ marginBottom: '1rem', color: '#4a5568' }}>
              Export your legacy coupon codes from the "Coupon codes" section in BigCommerce to create a backup before migration.
            </p>
            
            {loading && progress.total > 0 && (
              <div className="progress-container" style={{ marginBottom: '1rem' }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}>
                    {Math.round((progress.processed / progress.total) * 100)}%
                  </div>
                </div>
                <div className="progress-text">
                  Processing: {progress.processed} of {progress.total} coupons
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
              {loading ? 'Exporting...' : 'Export Legacy Coupons from BigCommerce'}
            </button>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#f7fafc', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Option 2: Import Codes (Skip Export)</h3>
            <p style={{ marginBottom: '1rem', color: '#4a5568' }}>
              If you already have your codes exported or want to import from a file, you can skip the export step.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label className="button button-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                📁 Upload File (CSV or JSON)
                <input
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              
              <button onClick={handlePasteJSON} className="button button-secondary">
                📋 Paste JSON
              </button>
            </div>
            
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#718096' }}>
              <strong>Supported formats:</strong>
              <div style={{ marginTop: '0.5rem' }}>
                <strong>CSV:</strong> Code, Coupon ID, Coupon Name, Discount, Type, Enabled, Max Uses, Current Uses, Min Purchase, Expires
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <strong>JSON:</strong>
                <pre style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#edf2f7', borderRadius: '4px', overflow: 'auto', fontSize: '0.75rem' }}>
{`[
  {
    "code": "COUPON1",
    "discount": 10,
    "discountType": "percentage",
    "oldCouponId": 123,
    "name": "Coupon Name",
    "max_uses": null
  },
  ...
]`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && codes.length > 0 && (
        <div className="card">
          <h2>Step 2: Review Your Coupons</h2>
          {exportData && (
            <div className="alert alert-success">
              ✅ {exportData.totalCoupons ? `Exported ${exportData.totalCoupons} legacy coupon codes` : `Ready to migrate ${codes.length} coupon codes`}
            </div>
          )}
          {exportData && exportData.data && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={downloadExportCSV} className="button button-secondary">
                📊 Download CSV (Excel)
              </button>
              <button onClick={downloadExportJSON} className="button button-secondary">
                📄 Download JSON (Backup)
              </button>
            </div>
          )}

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
