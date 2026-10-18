import "server-only";
import { createClient } from "@supabase/supabase-js";

// Full-access client for trusted server code only. Bypasses RLS: check the user yourself first.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
