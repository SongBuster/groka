import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
)

// Try getting a sample row to see its columns
const { data, error } = await supabase
  .from('shopping_list_items')
  .select('*')
  .limit(1)

if (error) {
  console.error('Error:', error)
} else {
  console.log('Columns in shopping_list_items:', Object.keys(data[0] || {}))
  console.log('Sample row:', data[0])
}
