import { createBrowserClient } from "@supabase/ssr";

// Supabase client for browser code. Only uses the public (publishable) key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
