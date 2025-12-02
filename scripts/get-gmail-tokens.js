#!/usr/bin/env node
/**
 * Get Gmail OAuth Tokens
 * 
 * This script helps you obtain the OAuth tokens needed for Gmail API access.
 * Run: node scripts/get-gmail-tokens.js
 */

import readline from 'readline'
import { google } from 'googleapis'

// Configuration (get these from Google Cloud Console)
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || 'YOUR_CLIENT_ID'
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET'
const REDIRECT_URI = 'http://localhost:5173/oauth/callback'

if (CLIENT_ID === 'YOUR_CLIENT_ID' || CLIENT_SECRET === 'YOUR_CLIENT_SECRET') {
  console.error('❌ Error: Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables')
  console.error('Or edit this script and replace YOUR_CLIENT_ID and YOUR_CLIENT_SECRET')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// Required scopes for reading, modifying and sending emails
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

// Generate authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Required to get refresh token
  scope: SCOPES,
  prompt: 'consent', // Force consent screen to get refresh token
})

console.log('\n📧 Gmail OAuth Token Generator\n')
console.log('1. Visit this URL and authorize the app:')
console.log('\n   ', authUrl, '\n')
console.log('2. After authorization, you will be redirected to a URL like:')
console.log('   http://localhost:5173/oauth/callback?code=XXXXX')
console.log('\n3. Copy the "code" parameter from that URL\n')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.question('Enter the authorization code: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code)
    
    console.log('\n✅ Success! Save these tokens as environment variables:\n')
    console.log('GMAIL_ACCESS_TOKEN=' + tokens.access_token)
    console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token)
    console.log('\n⚠️  Keep these tokens secret! Never commit them to git.\n')
    
    // Test the tokens
    oauth2Client.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    
    console.log(`✅ Tokens are valid! Email: ${profile.data.emailAddress}\n`)
    
  } catch (error) {
    console.error('❌ Error getting tokens:', error.message)
  } finally {
    rl.close()
  }
})
