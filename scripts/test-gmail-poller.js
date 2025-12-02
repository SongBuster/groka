#!/usr/bin/env node
/**
 * Test Gmail Poller Locally
 * 
 * This script calls the gmail-poller API endpoint locally or remotely
 * Useful for testing without waiting for Vercel Cron
 * 
 * Usage:
 *   node scripts/test-gmail-poller.js
 *   node scripts/test-gmail-poller.js https://groka.vercel.app
 */

const baseUrl = process.argv[2] || 'http://localhost:5173'
const secret = process.env.GMAIL_POLLER_SECRET

if (!secret) {
  console.error('❌ Error: GMAIL_POLLER_SECRET environment variable not set')
  console.error('Set it in your .env.local file or run:')
  console.error('  GMAIL_POLLER_SECRET=your-secret node scripts/test-gmail-poller.js')
  process.exit(1)
}

console.log(`🔄 Calling Gmail poller at: ${baseUrl}/api/email/gmail-poller`)

fetch(`${baseUrl}/api/email/gmail-poller`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${secret}`,
  },
})
  .then(async (res) => {
    const data = await res.json()
    if (res.ok) {
      console.log('✅ Success:', data)
    } else {
      console.error('❌ Error:', data)
    }
  })
  .catch((error) => {
    console.error('❌ Request failed:', error.message)
  })
