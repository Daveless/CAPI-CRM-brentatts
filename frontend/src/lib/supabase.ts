import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in Vercel Environment Variables. Redeploy after setting them."
    )
  }
  _client = createClient(url, key)
  return _client
}

export const supabase = getClient()
