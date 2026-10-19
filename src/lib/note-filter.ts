// Checks a reaction note before it goes public. Notes can't carry phone numbers, links or
// profanity; neighbors can still report anything that slips through (admin queue, step 9).

const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|biz|info|io|co|us|me|ly|app|site|xyz|online)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

// Whole-word matches after undoing common letter swaps (f*ck, sh1t, b!tch).
const PROFANITY = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "shitty", "bullshit", "bitch", "asshole", "bastard",
  "cunt", "dick", "dickhead", "pussy", "cock", "whore", "slut", "fag", "faggot", "nigger", "nigga", "retard",
];
const SWAPS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "*": "u" };

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[013457@$!*]/g, (c) => SWAPS[c] ?? c)
    .replace(/(.)\1{2,}/g, "$1$1"); // "shiiiit" -> "shiit"
}

export type NoteCheck = { ok: true } | { ok: false; reason: string };

export function checkNote(note: string, max = 140): NoteCheck {
  const text = note.trim();
  if (!text) return { ok: true };
  if (text.length > max) return { ok: false, reason: `Keep it to ${max} characters.` };
  if (PHONE.test(text) || /\d{7,}/.test(text.replace(/[\s().-]/g, ""))) {
    return { ok: false, reason: "Notes can't include phone numbers. Neighbors can call from the pro's page." };
  }
  if (EMAIL.test(text) || LINK.test(text)) return { ok: false, reason: "Notes can't include links or emails." };
  const words = normalize(text).split(/[^a-z]+/);
  const loose = words.map((w) => w.replace(/(.)\1+/g, "$1"));
  if (words.some((w) => PROFANITY.includes(w)) || loose.some((w) => PROFANITY.includes(w))) {
    return { ok: false, reason: "Let's keep it friendly. Try different words." };
  }
  return { ok: true };
}
