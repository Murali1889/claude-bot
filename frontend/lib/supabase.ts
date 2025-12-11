import { createClient } from "@supabase/supabase-js";

// Client-side Supabase (uses anon key)
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server-side Supabase (uses service key for admin operations)
export function createServerClient() {
  // Use service key if available, otherwise fall back to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const isServiceKey = !!process.env.SUPABASE_SERVICE_KEY;

  console.log(`[createServerClient] Using ${isServiceKey ? 'service' : 'anon'} key`);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
