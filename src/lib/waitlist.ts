import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164 } from "@/lib/reactions";

export type WaitlistInput = { contact: string; zip: string; town: string };
export type WaitlistResult = { ok: true; count: number; already: boolean } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Adds someone to a town's waitlist (once per phone/email per ZIP) and returns how many are waiting there.
export async function joinWaitlist(db: SupabaseClient, input: WaitlistInput): Promise<WaitlistResult> {
  const contact = input.contact.trim();
  const zip = input.zip.trim();
  const town = input.town.trim().replace(/\s+/g, " ").slice(0, 60) || null;
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: "Enter a 5-digit ZIP code." };

  const phone = toE164(contact);
  const email = !phone && EMAIL.test(contact) ? contact.toLowerCase().slice(0, 200) : null;
  if (!phone && !email) return { ok: false, error: "Enter a phone number or email." };

  let dupe = db.from("waitlist").select("id", { count: "exact", head: true }).eq("zip", zip);
  dupe = phone ? dupe.eq("phone", phone) : dupe.eq("email", email!);
  const { count: existing } = await dupe;
  const already = (existing ?? 0) > 0;
  if (!already) {
    const { error } = await db.from("waitlist").insert({ phone, email, zip, town });
    if (error) return { ok: false, error: "Couldn't save that. Try again." };
  }
  const { count } = await db.from("waitlist").select("id", { count: "exact", head: true }).eq("zip", zip);
  return { ok: true, count: count ?? 1, already };
}
