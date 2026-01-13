'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    storeHash: '',
    accessToken: '',
    channelId: '1',
  })

  useEffect(() => {
    // Load saved credentials if they exist
    const savedHash = localStorage.getItem('bc_store_hash')
    const savedToken = localStorage.getItem('bc_access_token')
    const savedChannel = localStorage.getItem('bc_channel_id')
    if (savedHash && savedToken) {
      setFormData({
        storeHash: savedHash,
        accessToken: savedToken,
        channelId: savedChannel || '1',
      })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Test the connection
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed')
      }

      // Save credentials to localStorage
      localStorage.setItem('bc_store_hash', formData.storeHash)
      localStorage.setItem('bc_access_token', formData.accessToken)
      localStorage.setItem('bc_channel_id', formData.channelId)

      setSuccess('✅ Credentials verified and saved successfully!')
      setTimeout(() => {
        router.push('/migrate')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Configure BigCommerce Credentials</h1>
      <p style={{ marginBottom: '2rem', color: '#718096' }}>
        Enter your BigCommerce API credentials. These are stored securely in your browser.
      </p>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="card">
        <h2>Where to Find These Credentials</h2>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '2', marginBottom: '2rem' }}>
          <li>Log into your BigCommerce admin panel</li>
          <li>Go to <strong>Settings → API Accounts</strong></li>
          <li>Create a new API account (or use an existing one)</li>
          <li>Set permissions: <strong>Promotions: Read, Modify, Delete</strong></li>
          <li>Copy the <strong>Store Hash</strong> and <strong>Access Token</strong></li>
        </ol>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="label" htmlFor="storeHash">
              Store Hash *
            </label>
            <input
              id="storeHash"
              type="text"
              className="input"
              value={formData.storeHash}
              onChange={(e) => setFormData({ ...formData, storeHash: e.target.value })}
              placeholder="e.g., abc123def4"
              required
            />
            <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
              Found in your store URL or API account settings
            </small>
          </div>

          <div className="input-group">
            <label className="label" htmlFor="accessToken">
              Access Token *
            </label>
            <input
              id="accessToken"
              type="password"
              className="input"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
              placeholder="Your API access token"
              required
            />
            <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
              Keep this secure - it provides full API access
            </small>
          </div>

          <div className="input-group">
            <label className="label" htmlFor="channelId">
              Channel ID
            </label>
            <input
              id="channelId"
              type="text"
              className="input"
              value={formData.channelId}
              onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
              placeholder="1"
            />
            <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
              Usually 1 for the default channel
            </small>
          </div>

          <button type="submit" className="button" disabled={loading}>
            {loading && <span className="loading"></span>}
            {loading ? 'Testing Connection...' : 'Save & Test Connection'}
          </button>
        </form>
      </div>
    </div>
  )
}
