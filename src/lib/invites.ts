import type { SupabaseClient } from "@supabase/supabase-js";

// Pro invite links: /i/CODE lands a customer in that pro's react flow.
export const INVITE_COOKIE = "holler_invite";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L mix-ups

function makeCode() {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return code;
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

// One invite link per pro; reuses the existing one.
export async function getOrCreateInvite(db: SupabaseClient, proId: string): Promise<{ code: string; uses: number } | null> {
  const { data: existing } = await db.from("invites").select("code, uses").eq("pro_id", proId).limit(1).maybeSingle();
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db.from("invites").insert({ pro_id: proId, code: makeCode() }).select("code, uses").single();
    if (!error) return data;
    if (error.code !== "23505") return null;
  }
  return null;
}

// Follows an invite: counts the visit and returns the pro (following merges).
export async function followInvite(db: SupabaseClient, rawCode: string): Promise<{ proId: string; code: string } | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const { data: invite } = await db.from("invites").select("id, pro_id, uses").eq("code", code).maybeSingle();
  if (!invite) return null;
  const { data: pro } = await db.from("pros").select("id, status, merged_into_id").eq("id", invite.pro_id).maybeSingle();
  if (!pro) return null;
  const proId = pro.merged_into_id ?? pro.id;
  if (!pro.merged_into_id && pro.status !== "active") return null;
  await db.from("invites").update({ uses: invite.uses + 1 }).eq("id", invite.id);
  return { proId, code };
}

// Which pro the visitor's invite cookie points at (for labeling reactions).
export async function inviteProId(db: SupabaseClient, code: string | undefined): Promise<string | null> {
  if (!code) return null;
  const { data: invite } = await db.from("invites").select("pro_id").eq("code", normalizeCode(code)).maybeSingle();
  if (!invite) return null;
  const { data: pro } = await db.from("pros").select("id, merged_into_id").eq("id", invite.pro_id).maybeSingle();
  return pro ? (pro.merged_into_id ?? pro.id) : null;
}
