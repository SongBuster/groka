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
  env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
)

console.log('=== Checking shopping_lists ===')
const { data: lists, error: listsError } = await supabase
  .from('shopping_lists')
  .select('*')
  .limit(5)

if (listsError) {
  console.error('Lists error:', listsError)
} else {
  console.log('Lists found:', lists?.length || 0)
  lists?.forEach(list => {
    console.log(`  - ${list.name} (${list.id}) by ${list.owner_id || list.user_id}`)
  })
}

console.log('\n=== Checking shopping_list_shares ===')
const { data: shares, error: sharesError } = await supabase
  .from('shopping_list_shares')
  .select('*')
  .limit(5)

if (sharesError) {
  console.error('Shares error:', sharesError)
} else {
  console.log('Shares found:', shares?.length || 0)
  shares?.forEach(share => {
    console.log(`  - List ${share.list_id} shared by ${share.shared_by_user_id} with ${share.shared_with_user_id} (${share.permission})`)
  })
}

console.log('\n=== Checking shopping_list_items (all) ===')
const { data: allItems, error: allItemsError } = await supabase
  .from('shopping_list_items')
  .select('*')
  .limit(5)

if (allItemsError) {
  console.error('All items error:', allItemsError)
} else {
  console.log('Items found:', allItems?.length || 0)
  if (allItems && allItems.length > 0) {
    console.log('Sample item columns:', Object.keys(allItems[0]))
    console.log('Sample item:', allItems[0])
  }
}
