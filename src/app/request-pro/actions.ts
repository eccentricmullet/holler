"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlert } from "@/lib/push";
import { adminIds, createVendorRequest, newRequestAlert } from "@/lib/vendor-requests";

export async function createVendorRequestAction(input: { name: string; tags: string[]; details: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Please sign in first." };
  const db = createAdminClient();
  const r = await createVendorRequest(db, user.id, input);
  if (r.ok) {
    // Phone alert to the admin (if they turned alerts on), after the screen has answered
    const name = input.name.trim();
    after(async () => sendAlert(db, await adminIds(db), newRequestAlert(name)));
    revalidatePath("/profile");
    revalidatePath("/admin");
  }
  return r;
}
