"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { completeSignup } from "./actions";
import { track } from "@/components/Track";

type Step = "phone" | "code" | "name" | "home";
type Suggestion = { placeId: string; main: string; secondary: string };

const PROGRESS: Record<Step, number> = { phone: 0, code: 0, name: 1, home: 2 };

// "6155551234" -> "(615) 555-1234" as the user types
function formatPhone(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function toE164(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

export default function SignupFlow({ startAt, next }: { startAt: Step; next: string }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [step, setStep] = useState<Step>(startAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [privacy, setPrivacy] = useState<"block" | "hidden">("block");

  const [addressText, setAddressText] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sessionToken] = useState(() => crypto.randomUUID());

  const phone = toE164(phoneDigits);

  async function sendCode() {
    if (!phone) return setError("Enter a 10-digit US phone number.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) {
      const detail = process.env.NODE_ENV === "development" ? ` (${error.message})` : "";
      return setError(`We couldn't send a code to that number. Check it and try again.${detail}`);
    }
    setCode("");
    setStep("code");
  }

  async function verifyCode() {
    if (!phone || code.length !== 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error || !data.user) {
      setBusy(false);
      const detail = process.env.NODE_ENV === "development" && error ? ` (${error.message})` : "";
      return setError(`That code didn't work. Check it or send a new one.${detail}`);
    }
    // Already have an account? Then this was a login.
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    setBusy(false);
    if (profile) {
      track("logged_in");
      router.replace(next);
      router.refresh();
      return;
    }
    setStep("name");
  }

  function saveName() {
    if (!firstName.trim()) return setError("Add your first name.");
    if (!/^[a-z]$/i.test(lastInitial.trim())) return setError("Add the first letter of your last name.");
    setError(null);
    setStep("home");
  }

  async function finish() {
    if (!placeId) return setError("Pick your address from the list.");
    setBusy(true);
    setError(null);
    const result = await completeSignup({ firstName, lastInitial, placeId, sessionToken, privacy });
    setBusy(false);
    if (result.error) return setError(result.error);
    track("signed_up", { privacy, from_invite: next.includes("from=invite") });
    router.replace(next);
    router.refresh();
  }

  // Address suggestions, a moment after the user stops typing
  useEffect(() => {
    if (step !== "home" || placeId || addressText.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/address?q=${encodeURIComponent(addressText)}&session=${sessionToken}`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        if (!res.ok) return setError(data.error ?? "Address search isn't working right now.");
        setSuggestions(data.suggestions ?? []);
      } catch {
        // typing again cancels the previous search
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [addressText, placeId, step, sessionToken]);

  const displayName = `${firstName.trim() || "Zak"} ${(lastInitial.trim() || "H").toUpperCase()}.`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-6 pt-8">
      <div className="flex gap-1.5 pt-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === PROGRESS[step] ? "w-14 bg-green" : i < PROGRESS[step] ? "w-7 bg-green" : "w-7 bg-line"
            }`}
          />
        ))}
      </div>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          if (step === "phone") sendCode();
          else if (step === "code") verifyCode();
          else if (step === "name") saveName();
          else finish();
        }}
      >
        {step === "phone" && (
          <>
            <Title>What&apos;s your number?</Title>
            <Lead>We&apos;ll text you a 6-digit code. Your number is never shown.</Lead>
            <Label htmlFor="phone">Mobile number</Label>
            <Field emoji="📱">
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(615) 555-0123"
                value={formatPhone(phoneDigits)}
                onChange={(e) => {
                  let d = e.target.value.replace(/\D/g, "");
                  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
                  setPhoneDigits(d.slice(0, 10));
                }}
                autoFocus
                className={inputClass}
              />
            </Field>
            <p className="mt-4 text-[13px] leading-snug text-muted">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="font-semibold text-green-deep">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-green-deep">
                Privacy Policy
              </Link>
              . We only text you login codes.
            </p>
          </>
        )}

        {step === "code" && (
          <>
            <Title>Enter your code</Title>
            <Lead>We texted it to {formatPhone(phoneDigits)}.</Lead>
            <Label htmlFor="code">6-digit code</Label>
            <Field emoji="🔑">
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
                className={`${inputClass} tracking-[0.3em]`}
              />
            </Field>
            <div className="mt-4 flex gap-5 text-[15px] font-medium">
              <button type="button" className="text-green-deep" onClick={sendCode} disabled={busy}>
                Send a new code
              </button>
              <button type="button" className="text-muted" onClick={() => setStep("phone")}>
                Change number
              </button>
            </div>
          </>
        )}

        {step === "name" && (
          <>
            <Title>What should neighbors call you?</Title>
            <Lead>Just your first name and last initial, like &ldquo;Zak H.&rdquo;</Lead>
            <Label htmlFor="first">First name</Label>
            <Field>
              <input
                id="first"
                autoComplete="given-name"
                value={firstName}
                maxLength={40}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                className={inputClass}
              />
            </Field>
            <Label htmlFor="initial">Last initial</Label>
            <Field className="w-24">
              <input
                id="initial"
                value={lastInitial}
                maxLength={1}
                onChange={(e) => setLastInitial(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
                className={`${inputClass} text-center`}
              />
            </Field>
          </>
        )}

        {step === "home" && (
          <>
            <Title>Where&apos;s home?</Title>
            <Lead>So you see the pros your actual neighbors use. Your address is never shown.</Lead>
            <Label htmlFor="home-addr">Home address</Label>
            <div className="relative">
              <Field emoji="🏡">
                <input
                  id="home-addr"
                  autoComplete="off"
                  placeholder="Start typing your street"
                  value={addressText}
                  onChange={(e) => {
                    setAddressText(e.target.value);
                    setPlaceId(null);
                  }}
                  autoFocus
                  className={inputClass}
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-controls="addr-list"
                />
                {placeId && <span className="text-lg text-green-deep" aria-label="Address picked">✓</span>}
              </Field>
              {suggestions.length > 0 && (
                <ul
                  id="addr-list"
                  role="listbox"
                  className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-[20px] bg-surface shadow-float"
                >
                  {suggestions.map((s) => (
                    <li key={s.placeId} role="option" aria-selected={false}>
                      <button
                        type="button"
                        className="flex w-full flex-col px-4 py-3 text-left hover:bg-green-wash"
                        onClick={() => {
                          setPlaceId(s.placeId);
                          setAddressText(s.secondary ? `${s.main}, ${s.secondary}` : s.main);
                          setSuggestions([]);
                          setError(null);
                        }}
                      >
                        <span className="text-[15px] font-medium">{s.main}</span>
                        <span className="text-[13px] text-muted">{s.secondary}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <h2 className="mb-3 mt-7 text-xl font-bold">How should you show on the map?</h2>
            <div className="flex flex-col gap-3">
              <PrivacyChoice
                selected={privacy === "block"}
                onClick={() => setPrivacy("block")}
                emoji="📍"
                title="Near my block"
                body={`Neighbors see “${displayName}” and your pros on your block, never your house.`}
              />
              <PrivacyChoice
                selected={privacy === "hidden"}
                onClick={() => setPrivacy("hidden")}
                emoji="🕶️"
                title="Keep me hidden"
                body="Your 👍 and ❤️ still count. No pin, and you show as “a neighbor.”"
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[15px] font-medium text-love">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-auto h-[58px] rounded-[20px] bg-green-deep text-[17px] font-semibold text-white disabled:opacity-60"
        >
          {busy
            ? "One sec…"
            : step === "phone"
              ? "Text me a code"
              : step === "code"
                ? "Verify"
                : step === "name"
                  ? "Next"
                  : "See who my neighbors use"}
        </button>
        {step === "home" && (
          <span className="mt-2.5 text-center text-[13px] text-muted">Change this anytime in your profile.</span>
        )}
      </form>
    </main>
  );
}

const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-muted";

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">{children}</h1>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-base leading-snug text-muted">{children}</p>;
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 mt-6 text-[15px] font-semibold">
      {children}
    </label>
  );
}

function Field({ emoji, className = "", children }: { emoji?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-14 items-center gap-2.5 rounded-[18px] bg-field px-4 ${className}`}>
      {emoji && (
        <span className="text-lg" aria-hidden>
          {emoji}
        </span>
      )}
      {children}
    </div>
  );
}

function PrivacyChoice(props: { selected: boolean; onClick: () => void; emoji: string; title: string; body: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
      className={`flex items-start gap-3.5 rounded-[22px] border-[2.5px] p-4 text-left ${
        props.selected ? "border-green bg-green-wash" : "border-line bg-surface"
      }`}
    >
      <span
        className={`size-12 shrink-0 rounded-2xl text-center text-2xl leading-[48px] ${
          props.selected ? "bg-surface" : "bg-field"
        }`}
        aria-hidden
      >
        {props.emoji}
      </span>
      <span className="flex flex-col gap-[3px]">
        <span className="text-[17px] font-bold">{props.title}</span>
        <span className="text-sm leading-[1.35] text-muted">{props.body}</span>
      </span>
    </button>
  );
}
