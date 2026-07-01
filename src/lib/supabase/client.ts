import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

let client: SupabaseClient<Database> | undefined

export function createClient() {
  if (client) return client

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables.")
  }

  client = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)

  return client
}
