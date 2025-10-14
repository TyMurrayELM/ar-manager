import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing!')
  console.warn('Create a .env.local file with:')
  console.warn('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
  console.warn('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)