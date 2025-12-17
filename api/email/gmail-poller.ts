/**
 * Gmail Poller API - Processes incoming emails with ticket PDFs
 * 
 * This endpoint:
 * 1. Reads unread emails from a dedicated Gmail account
 * 2. Validates sender is a registered Groka user
 * 3. Downloads PDF attachments
 * 4. Parses tickets and saves to Supabase
 * 5. Sends confirmation email back to sender
 * 6. Marks email as read
 * 
 * Can be:
 * - Called manually via HTTP GET
 * - Triggered by Vercel Cron (every 10 minutes)
 * - Executed as a CLI script for testing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Gmail API configuration
const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'

interface EmailProcessor {
  processedCount: number
  errors: Array<{ email: string; error: string }>
  tickets: Array<{ email: string; ticketId: string; fileName: string }>
}

interface GmailMessage {
  id: string
  threadId: string
}

interface GmailAttachment {
  filename: string
  mimeType: string
  attachmentId: string
  size: number
}

interface MessageDetails {
  id: string
  from: string
  subject: string
  date: string
  attachments: GmailAttachment[]
}

/**
 * Gmail API helper class
 */
class GmailAPI {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Gmail API request failed')
    }

    return response.json()
  }

  /**
   * Get unread messages
   */
  async getUnreadMessages(maxResults = 50): Promise<GmailMessage[]> {
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      q: 'is:unread', // Only unread emails
    })

    const data = await this.makeRequest(`/messages?${params}`)
    return data.messages || []
  }

  /**
   * Get message details with attachments
   */
  async getMessageDetails(messageId: string): Promise<MessageDetails> {
    const data = await this.makeRequest(`/messages/${messageId}?format=full`)

    const headers = data.payload?.headers || []
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
      return header?.value || ''
    }

    const from = getHeader('From')
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = from.match(/<([^>]+)>/)
    const email = emailMatch ? emailMatch[1] : from

    return {
      id: data.id,
      from: email.toLowerCase().trim(),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      attachments: this.extractAttachments(data.payload),
    }
  }

  /**
   * Extract PDF attachments recursively
   */
  private extractAttachments(payload: any, attachments: GmailAttachment[] = []): GmailAttachment[] {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size,
          })
        }
        if (part.parts) {
          this.extractAttachments(part, attachments)
        }
      }
    }
    return attachments
  }

  /**
   * Download attachment as base64
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<string> {
    const data = await this.makeRequest(`/messages/${messageId}/attachments/${attachmentId}`)
    return data.data // Base64 encoded
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.makeRequest(`/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    })
  }

  /**
   * Send email reply
   */
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
    ].join('\r\n')

    // Convert to base64url
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    await this.makeRequest('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw: encodedEmail }),
    })
  }
}

/**
 * Convert base64 to Buffer (for PDF processing)
 */
function base64ToBuffer(base64: string): Buffer {
  // Gmail uses base64url encoding
  const base64Standard = base64.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64Standard, 'base64')
}

/**
 * Main polling function
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authorization (simple secret for manual/cron calls)
  const authHeader = req.headers.authorization
  const expectedSecret = process.env.GMAIL_POLLER_SECRET

  if (!expectedSecret) {
    return res.status(500).json({ error: 'GMAIL_POLLER_SECRET not configured' })
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Get Gmail access token from env
  // Get Gmail access token (refresh if possible)
  const getAccessToken = async (): Promise<string> => {
    const staticToken = process.env.GMAIL_ACCESS_TOKEN
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN
    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET

    // If refresh credentials are available, try to refresh on every run to avoid expirations
    if (refreshToken && clientId && clientSecret) {
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Failed to refresh Gmail token: ${text}`)
        }

        const data = (await response.json()) as { access_token: string }
        if (data?.access_token) {
          return data.access_token
        }
      } catch (error: any) {
        console.error('Error refreshing Gmail access token, falling back to static token if available:', error)
      }
    }

    if (!staticToken) {
      throw new Error('GMAIL_ACCESS_TOKEN not configured and refresh failed')
    }

    return staticToken
  }

  let gmailAccessToken: string
  try {
    gmailAccessToken = await getAccessToken()
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to obtain Gmail access token' })
  }

  // Initialize Supabase with service role key (server-side)
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const gmail = new GmailAPI(gmailAccessToken)

  const result: EmailProcessor = {
    processedCount: 0,
    errors: [],
    tickets: [],
  }

  try {
    // 1. Get unread messages
    const messages = await gmail.getUnreadMessages(50)
    console.log(`Found ${messages.length} unread messages`)

    if (messages.length === 0) {
      return res.status(200).json({ message: 'No new emails', result })
    }

    // 2. Process each message
    for (const message of messages) {
      try {
        const details = await gmail.getMessageDetails(message.id)
        console.log(`Processing email from: ${details.from}`)

        // 3. Check if sender is a registered user in Supabase Auth
        const admin = supabase.auth.admin
        const { data: usersPage, error: adminError } = await admin.listUsers()

        if (adminError) {
          console.error('Auth admin error:', adminError)
        }

        const authUser = usersPage?.users?.find(
          (u: any) => (u.email || '').toLowerCase() === details.from.toLowerCase()
        )

        if (!authUser) {
          console.log(`Auth user not found: ${details.from}`)
          // Send notification email
          await gmail.sendEmail(
            details.from,
            '❌ Groka - Usuario no registrado',
            `
            <h2>No pudimos procesar tu ticket</h2>
            <p>El email <strong>${details.from}</strong> no está registrado en Groka.</p>
            <p>Por favor, regístrate en <a href="https://groka.app">groka.app</a> primero.</p>
            `
          )
          await gmail.markAsRead(message.id)
          continue
        }

        // 4. Get PDF attachments
        const pdfAttachments = details.attachments.filter((att) => att.mimeType === 'application/pdf')

        if (pdfAttachments.length === 0) {
          console.log(`No PDF attachments found in email from ${details.from}`)
          await gmail.sendEmail(
            details.from,
            '⚠️ Groka - Sin archivos PDF',
            `
            <h2>No encontramos PDFs adjuntos</h2>
            <p>Por favor, reenvía el email con el ticket en formato PDF adjunto.</p>
            `
          )
          await gmail.markAsRead(message.id)
          continue
        }

        // 5. Process each PDF
        const processedTickets: string[] = []
        const errors: string[] = []

        for (const attachment of pdfAttachments) {
          try {
            console.log(`Processing PDF: ${attachment.filename}`)

            // Download PDF
            const base64Data = await gmail.getAttachment(message.id, attachment.attachmentId)
            const pdfBuffer = base64ToBuffer(base64Data)

            // Create File-like object for parser (ensure BlobPart is a typed array)
            const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' })
            const file = new File([blob], attachment.filename, { type: 'application/pdf' })

            // Parse PDF (try server-side). If unavailable, fallback to store as pending
            let parsed: any = null
            try {
              const pdfParser = await import('../../src/services/pdfParser')
              parsed = await pdfParser.default.parseTicketFromFile(file)
            } catch (parseImportError: any) {
              console.warn('Server-side parser not available, storing as pending:', parseImportError?.message)
            }

            // Upload PDF to Supabase Storage
            const fileName = `${authUser.id}/${Date.now()}_${attachment.filename}`
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('tickets')
              .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
              })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('tickets').getPublicUrl(fileName)

            // Save ticket to DB
            const { data: ticket, error: ticketError } = await supabase
              .from('tickets')
              .insert({
                user_id: authUser.id,
                supermarket_id: parsed?.supermarketId || null,
                file_name: attachment.filename,
                file_url: publicUrl,
                ticket_number: parsed?.invoiceNumber || null,
                store_name: parsed?.store || null,
                purchase_date: parsed?.date || null,
                total_amount: parsed?.totalFromPDF || parsed?.totalAmount || null,
                parsed: !!parsed,
                parsing_error: parsed ? null : 'Server-side parser unavailable. Please parse in app.',
              })
              .select()
              .single()

            if (ticketError) throw ticketError

            // Save ticket items if parsed
            if (parsed?.products && parsed.products.length > 0) {
              const items = parsed.products.map((product: any) => ({
                ticket_id: ticket.id,
                product_name: product.name,
                quantity: product.quantity,
                unit_price: product.unitPrice,
                total_price: product.totalPrice,
              }))

              const { error: itemsError } = await supabase.from('ticket_items').insert(items)
              if (itemsError) console.error('Error saving ticket items:', itemsError)
            }

            processedTickets.push(attachment.filename)
            result.tickets.push({
              email: authUser.email ?? details.from,
              ticketId: ticket.id,
              fileName: attachment.filename,
            })

            console.log(`✓ Ticket saved: ${ticket.id}`)
          } catch (parseError: any) {
            console.error(`Error processing PDF ${attachment.filename}:`, parseError)
            errors.push(`${attachment.filename}: ${parseError.message}`)
          }
        }

        // 6. Send confirmation email
        if (processedTickets.length > 0) {
          const ticketList = processedTickets.map((name) => `<li>${name}</li>`).join('')
          await gmail.sendEmail(
            details.from,
            '✅ Groka - Tickets recibidos',
            `
            <h2>¡Tickets recibidos!</h2>
            <p>Hemos recibido los siguientes tickets:</p>
            <ul>${ticketList}</ul>
            <p>Ya aparecen en tu cuenta de <a href="https://groka.app">Groka</a>. ${errors.length === 0 ? '' : 'Algunos no pudieron ser procesados en el servidor y quedan pendientes de parseo en la app.'}
            ${errors.length > 0 ? `<p><strong>Errores:</strong></p><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
            `
          )
        } else if (errors.length > 0) {
          await gmail.sendEmail(
            details.from,
            '❌ Groka - Error al procesar tickets',
            `
            <h2>No pudimos procesar tus tickets</h2>
            <p>Ocurrieron los siguientes errores:</p>
            <ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>
            <p>Por favor, verifica que los PDFs sean tickets válidos.</p>
            `
          )
        }

        // 7. Mark as read
        await gmail.markAsRead(message.id)
        result.processedCount++
      } catch (error: any) {
        console.error(`Error processing message ${message.id}:`, error)
        result.errors.push({
          email: 'unknown',
          error: error.message,
        })
      }
    }

    return res.status(200).json({
      message: `Processed ${result.processedCount} emails`,
      result,
    })
  } catch (error: any) {
    console.error('Gmail polling error:', error)
    return res.status(500).json({ error: error.message })
  }
}
