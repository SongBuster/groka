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
import { parseBasicTicket } from './_basic-parser.js'

// Gmail API configuration
const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me'
const DEFAULT_TICKET_TZ = process.env.GMAIL_TICKET_TZ || 'Europe/Madrid'

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

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT'
    const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/) || tzName.match(/UTC([+-])(\d{1,2})(?::?(\d{2}))?/)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    const hours = parseInt(match[2], 10)
    const minutes = match[3] ? parseInt(match[3], 10) : 0
    return sign * (hours * 60 + minutes)
  } catch {
    return 0
  }
}

function buildPurchaseDateTime(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr) return null
  if (!timeStr) return dateStr
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const utcBaseline = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offsetMinutes = getTimeZoneOffsetMinutes(DEFAULT_TICKET_TZ, utcBaseline)
  const utcDate = new Date(utcBaseline.getTime() - offsetMinutes * 60 * 1000)
  return utcDate.toISOString()
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
    console.log('[gmail-poller] start')
    console.log('[gmail-poller] supabase url configured:', Boolean(supabaseUrl))
    console.log('[gmail-poller] gmail tokens configured:', {
      access: Boolean(process.env.GMAIL_ACCESS_TOKEN),
      refresh: Boolean(process.env.GMAIL_REFRESH_TOKEN),
      clientId: Boolean(process.env.GMAIL_CLIENT_ID),
      clientSecret: Boolean(process.env.GMAIL_CLIENT_SECRET)
    })

    // 1. Get unread messages
    const messages = await gmail.getUnreadMessages(50)
    console.log(`[gmail-poller] unread messages: ${messages.length}`)

    if (messages.length === 0) {
      return res.status(200).json({ message: 'No new emails', result })
    }

    // 2. Process each message
    for (const message of messages) {
      try {
        const details = await gmail.getMessageDetails(message.id)
        console.log(`[gmail-poller] processing email from: ${details.from} | subject: ${details.subject || '—'}`)

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
            'Groka - Usuario no registrado',
            `
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.1);">
          <tr>
            <td style="padding:24px 24px 12px 24px; text-align:left; border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://groka.vercel.app/icons/icon-192x192.png" alt="Groka" width="48" height="48" style="border-radius:12px; display:block;" />
                  </td>
                  <td style="vertical-align:middle; padding-left:12px;">
                    <div style="font-size:18px;font-weight:700;color:#0f172a;line-height:1.2;">Groka</div>
                    <div style="font-size:12px;color:#64748b;">Tu lista de compra inteligente</div>
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">Usuario</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 8px 24px; text-align:left;">
              <div style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">No pudimos procesar tu ticket</div>
              <div style="font-size:14px;line-height:1.6;color:#475569;margin:0;">
                <p>El email <strong>${details.from}</strong> no está registrado en Groka.</p>
                <p>Por favor, regístrate en <a href="https://groka.vercel.app">groka.app</a> primero.</p>
                </div>
            </td>
          </tr>
        </table>

        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          ©  https://groka.vercel.app  • Groka
        </div>
      </td>
    </tr>
  </table>
</body>



            <h2>No pudimos procesar tu ticket</h2>
            <p>El email <strong>${details.from}</strong> no está registrado en Groka.</p>
            <p>Por favor, regístrate en <a href="https://groka.app">groka.app</a> primero.</p>
            `
          )
          await gmail.markAsRead(message.id)
          continue
        }

        // 4. Get PDF attachments
        const pdfAttachments = details.attachments.filter((att) => {
          if (att.mimeType === 'application/pdf') return true
          if ((att.filename || '').toLowerCase().endsWith('.pdf')) return true
          return false
        })

        console.log(`[gmail-poller] attachments: ${details.attachments.length} | pdfs: ${pdfAttachments.length}`)

        if (pdfAttachments.length === 0) {
          console.log(`No PDF attachments found in email from ${details.from}`)
          await gmail.sendEmail(
            details.from,
            'Groka - Sin archivos PDF',
            `
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.1);">
          <tr>
            <td style="padding:24px 24px 12px 24px; text-align:left; border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://groka.vercel.app/icons/icon-192x192.png" alt="Groka" width="48" height="48" style="border-radius:12px; display:block;" />
                  </td>
                  <td style="vertical-align:middle; padding-left:12px;">
                    <div style="font-size:18px;font-weight:700;color:#0f172a;line-height:1.2;">Groka</div>
                    <div style="font-size:12px;color:#64748b;">Tu lista de compra inteligente</div>
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">Sin adjunto</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 8px 24px; text-align:left;">
              <div style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">No encontramos PDFs adjuntos</div>
              <div style="font-size:14px;line-height:1.6;color:#475569;margin:0;">
                <p>Por favor, reenvía el email con el ticket en formato PDF adjunto.</p>
                </div>
            </td>
          </tr>
        </table>

        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          ©  https://groka.vercel.app  • Groka
        </div>
      </td>
    </tr>
  </table>
</body>`
          )
          try {
            await gmail.markAsRead(message.id)
          } catch (markError: any) {
            console.error('[gmail-poller] failed to mark as read:', markError?.message || markError)
          }
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

            // Parse basic data from PDF (date, store, total) to show preview
            let basicInfo: any = null
            try {
              const basicData = await parseBasicTicket(Buffer.from(pdfBuffer))
              basicInfo = {
                date: basicData.date,
                time: basicData.time,
                store: basicData.store,
                totalFromPDF: basicData.total,
                invoiceNumber: basicData.invoiceNumber,
                supermarketId: basicData.supermarketId
              }
              console.log(`✓ Basic parse: ${basicInfo.store} - ${basicInfo.date} ${basicInfo.time || ''} - ${basicInfo.totalFromPDF}€`)
            } catch (parseError: any) {
              console.warn(`⚠ Basic parse failed for ${attachment.filename}:`, parseError.message)
              // Continue without parsing - will be marked as pending
            }

            // Upload PDF to Supabase Storage (sanitize filename to avoid invalid keys)
            const sanitizeObjectKey = (name: string): string => {
              const trimmed = (name || '').trim()
              const dotIdx = trimmed.lastIndexOf('.')
              const base = dotIdx !== -1 ? trimmed.slice(0, dotIdx) : trimmed
              const ext = dotIdx !== -1 ? trimmed.slice(dotIdx) : ''
              // Remove diacritics and replace any non-safe chars with '-'
              const normalizedBase = base
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '')
              const safeBase = normalizedBase
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
              const safeExt = (ext.toLowerCase() || '.pdf').replace(/[^a-z0-9.]/g, '')
              const finalName = `${safeBase || 'ticket'}${safeExt || '.pdf'}`
              // Prevent overly long names
              return finalName.length > 128 ? finalName.slice(0, 120) + '.pdf' : finalName
            }

            const sanitizedFileName = sanitizeObjectKey(attachment.filename)
            const fileName = `${authUser.id}/${Date.now()}_${sanitizedFileName}`
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('tickets')
              .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
              })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('tickets').getPublicUrl(fileName)

            // Combine date + time if available
            const purchaseDateTime = buildPurchaseDateTime(basicInfo?.date || null, basicInfo?.time || null)

            // Prevent duplicates: same user + supermarket (or store) + purchase datetime
            if (purchaseDateTime) {
              let duplicateQuery = supabase
                .from('tickets')
                .select('id')
                .eq('user_id', authUser.id)
                .eq('purchase_date', purchaseDateTime)

              if (basicInfo?.supermarketId) {
                duplicateQuery = duplicateQuery.eq('supermarket_id', basicInfo.supermarketId)
              } else if (basicInfo?.store) {
                duplicateQuery = duplicateQuery.ilike('store_name', basicInfo.store)
              }

              const { data: dup, error: dupErr } = await duplicateQuery.limit(1).maybeSingle()
              if (dupErr) {
                console.warn('Duplicate check error:', dupErr)
              }
              if (dup) {
                const dupMsg = `Ticket duplicado detectado (${attachment.filename}).`
                console.log(dupMsg)
                await gmail.sendEmail(
                  details.from,
                  'Groka - Ticket duplicado',
                  `
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.1);">
          <tr>
            <td style="padding:24px 24px 12px 24px; text-align:left; border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://groka.vercel.app/icons/icon-192x192.png" alt="Groka" width="48" height="48" style="border-radius:12px; display:block;" />
                  </td>
                  <td style="vertical-align:middle; padding-left:12px;">
                    <div style="font-size:18px;font-weight:700;color:#0f172a;line-height:1.2;">Groka</div>
                    <div style="font-size:12px;color:#64748b;">Tu lista de compra inteligente</div>
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">Ticket duplicado</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 8px 24px; text-align:left;">
              <div style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">Ticket ya existente</div>
              <div style="font-size:14px;line-height:1.6;color:#475569;margin:0;">
                <p>El ticket <strong>${attachment.filename}</strong> ya existe en tu cuenta con la misma fecha/hora y supermercado.</p>
                  <p>Si necesitas volver a subirlo, hazlo manualmente desde la app.</p>
              </div>
            </td>
          </tr>
        </table>

        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          ©  https://groka.vercel.app  • Groka
        </div>
      </td>
    </tr>
  </table>
</body>
                  `
                )
                continue
              }
            }

            // Save ticket to DB - always mark as parsed=false for full client-side parse
            const { data: ticket, error: ticketError } = await supabase
              .from('tickets')
              .insert({
                user_id: authUser.id,
                supermarket_id: basicInfo?.supermarketId || null,
                file_name: attachment.filename,
                file_url: publicUrl,
                ticket_number: basicInfo?.invoiceNumber || null,
                store_name: basicInfo?.store || null,
                purchase_date: purchaseDateTime,
                total_amount: basicInfo?.totalFromPDF || null,
                parsed: false, // Always false - client will parse products
                parsing_error: 'Pending full parse in app',
                source_type: 'pdf'
              })
              .select()
              .single()

            if (ticketError) throw ticketError

            // No longer save items on server - client will parse products
            // if (basicInfo?.products && basicInfo.products.length > 0) { ... }

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
            'Groka - Tickets recibidos',
            `
            <body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.1);">
          <tr>
            <td style="padding:24px 24px 12px 24px; text-align:left; border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://groka.vercel.app/icons/icon-192x192.png" alt="Groka" width="48" height="48" style="border-radius:12px; display:block;" />
                  </td>
                  <td style="vertical-align:middle; padding-left:12px;">
                    <div style="font-size:18px;font-weight:700;color:#0f172a;line-height:1.2;">Groka</div>
                    <div style="font-size:12px;color:#64748b;">Tu lista de compra inteligente</div>
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">Tickets recibidos</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 8px 24px; text-align:left;">
              <div style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">Tickets recibidos!</div>
              <div style="font-size:14px;line-height:1.6;color:#475569;margin:0;">
                <p>Hemos recibido los siguientes tickets:</p>
                    <ul>${ticketList}</ul>
                    <p>Ya aparecen en tu cuenta de <a href="https://groka.app">Groka</a>. ${errors.length === 0 ? '' : 'Algunos no pudieron ser procesados en el servidor y quedan pendientes de parseo en la app.'}
                    ${errors.length > 0 ? `<p><strong>Errores:</strong></p><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
                </div>
            </td>
          </tr>
        </table>

        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          ©  https://groka.vercel.app  • Groka
        </div>
      </td>
    </tr>
  </table>
</body>
            `
          )
        } else if (errors.length > 0) {
          await gmail.sendEmail(
            details.from,
            'Groka - Error al procesar tickets',
            `
            <body style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.1);">
          <tr>
            <td style="padding:24px 24px 12px 24px; text-align:left; border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://groka.vercel.app/icons/icon-192x192.png" alt="Groka" width="48" height="48" style="border-radius:12px; display:block;" />
                  </td>
                  <td style="vertical-align:middle; padding-left:12px;">
                    <div style="font-size:18px;font-weight:700;color:#0f172a;line-height:1.2;">Groka</div>
                    <div style="font-size:12px;color:#64748b;">Tu lista de compra inteligente</div>
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;">Error</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 8px 24px; text-align:left;">
              <div style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px 0;">No pudimos procesar tus tickets</div>
              <div style="font-size:14px;line-height:1.6;color:#475569;margin:0;">
                  <p>Ocurrieron los siguientes errores:</p>
                  <ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul>
                  <p>Por favor, verifica que los PDFs sean tickets válidos.</p>
              </div>
            </td>
          </tr>
        </table>

        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          ©  https://groka.vercel.app  • Groka
        </div>
      </td>
    </tr>
  </table>
</body>
            `
          )
        }

        // 7. Mark as read
        try {
          await gmail.markAsRead(message.id)
        } catch (markError: any) {
          console.error('[gmail-poller] failed to mark as read:', markError?.message || markError)
        }
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
