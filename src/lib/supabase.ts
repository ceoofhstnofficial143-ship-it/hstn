import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 🔒 SINGLETON PATTERN: Prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createClient> | null = null

export const getSupabase = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    // Return a dummy client to prevent crashes - operations will fail gracefully
    if (!supabaseInstance) {
      supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key')
    }
    return supabaseInstance
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

// Export for backward compatibility
export const supabase = getSupabase()

// 🔐 SUPABASE ADMIN (Service Role - Server Side Only)
// Use for backend operations that require absolute control or bypass RLS after verification.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null

export const getSupabaseAdmin = () => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  return supabaseAdminInstance
}

export const supabaseAdmin = getSupabaseAdmin()