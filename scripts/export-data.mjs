import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

// Read production .env
const prodEnv = readFileSync('.env.production.local', 'utf-8')
const env = {}
prodEnv.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
)

async function exportData() {
  console.log('🔄 Exportando datos desde producción...\n')
  
  const tables = [
    'categories',
    'products', 
    'tickets',
    'ticket_items',
    'shopping_lists',
    'shopping_list_items',
    'shopping_list_shares'
  ]
  
  let sqlContent = `-- Seed data from production
-- Generated: ${new Date().toISOString()}
-- This file will be automatically loaded by supabase db reset

SET session_replication_role = replica;

`
  
  for (const table of tables) {
    console.log(`  📦 Exportando ${table}...`)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1000) // Límite de seguridad
    
    if (error) {
      console.log(`  ⚠️  Error en ${table}:`, error.message)
      continue
    }
    
    if (!data || data.length === 0) {
      console.log(`  ℹ️  ${table} está vacía`)
      continue
    }
    
    console.log(`  ✓ ${table}: ${data.length} registros`)
    
    // Generar INSERT statements
    for (const row of data) {
      const columns = Object.keys(row).join(', ')
      const values = Object.values(row).map(v => {
        if (v === null) return 'NULL'
        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
        if (typeof v === 'boolean') return v ? 'true' : 'false'
        if (Array.isArray(v)) {
          // Manejar arrays de PostgreSQL
          if (v.length === 0) return 'ARRAY[]::text[]'
          const arrayValues = v.map(item => `'${String(item).replace(/'/g, "''")}'`).join(',')
          return `ARRAY[${arrayValues}]::text[]`
        }
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
        return v
      }).join(', ')
      
      sqlContent += `INSERT INTO public.${table} (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`
    }
    
    sqlContent += '\n'
  }
  
  sqlContent += 'SET session_replication_role = DEFAULT;\n'
  
  writeFileSync('supabase/seed.sql', sqlContent)
  console.log('\n✅ Datos exportados a supabase/seed.sql')
  console.log('\nPara aplicar los datos:')
  console.log('  supabase db reset')
}

exportData().catch(console.error)
