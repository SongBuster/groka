import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const userArgIndex = args.indexOf('--user')
const userId = userArgIndex >= 0 ? args[userArgIndex + 1] : null
const limitArgIndex = args.indexOf('--limit')
const limit = limitArgIndex >= 0 ? Number(args[limitArgIndex + 1]) : 0

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan variables de entorno. Requiere SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL (o VITE_SUPABASE_URL).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
})

const shouldReprocess = async (ticketId) => {
  if (force) return true
  const { count, error } = await supabase
    .from('ticket_items')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId)

  if (error) throw error
  return (count || 0) === 0
}

const fetchTickets = async () => {
  let query = supabase
    .from('tickets')
    .select('id, user_id, parsed')
    .eq('parsed', true)
    .order('created_at', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  if (limit && Number.isFinite(limit)) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

const resetTicket = async (ticketId) => {
  const { error: delErr } = await supabase
    .from('ticket_items')
    .delete()
    .eq('ticket_id', ticketId)

  if (delErr) throw delErr

  const { error: updErr } = await supabase
    .from('tickets')
    .update({ parsed: false, parsing_error: null })
    .eq('id', ticketId)

  if (updErr) throw updErr
}

const main = async () => {
  const tickets = await fetchTickets()
  let candidates = 0
  let updated = 0
  let skipped = 0

  for (const t of tickets) {
    const needs = await shouldReprocess(t.id)
    if (!needs) {
      skipped++
      continue
    }

    candidates++
    if (dryRun) {
      console.log(`[dry-run] Marcar para reprocesar: ${t.id}`)
      continue
    }

    await resetTicket(t.id)
    updated++
    console.log(`Marcado para reprocesar: ${t.id}`)
  }

  console.log('\nResumen:')
  console.log(`  Tickets revisados: ${tickets.length}`)
  console.log(`  Candidatos: ${candidates}`)
  console.log(`  Actualizados: ${updated}`)
  console.log(`  Omitidos: ${skipped}`)

  if (!dryRun) {
    console.log('\nAhora abre la app en /tickets para que se auto-procesen los tickets pendientes.')
  }
}

main().catch((err) => {
  console.error('Error en el script:', err)
  process.exit(1)
})
