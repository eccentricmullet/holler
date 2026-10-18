import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_COOKIE, followInvite } from "@/lib/invites";

// A pro's invite link. Remembers the invite for a week (so the reaction gets labeled),
// then lands the visitor in that pro's react flow (sign-up first if needed).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await followInvite(createAdminClient(), code);
  if (!invite) return NextResponse.redirect(new URL("/", request.url));

  const res = NextResponse.redirect(new URL(`/react?pro=${invite.proId}`, request.url));
  res.cookies.set(INVITE_COOKIE, invite.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
