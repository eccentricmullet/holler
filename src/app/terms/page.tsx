import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { LEGAL } from "@/config/legal";
import LegalPage, { H, List } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Terms · ${SITE.name}` };

export default function TermsPage() {
  const n = SITE.name;
  return (
    <LegalPage title="Terms of use">
      <p>
        These terms are the rules for using {n}, run by {LEGAL.operator}. By creating an account or using the app, you agree
        to them. Please also read our <Link href="/privacy" className="font-semibold text-green-deep">privacy policy</Link>.
      </p>

      <H>Who can use {n}</H>
      <p>You must be 18 or older, use your own phone number, and give your real home address. One account per person.</p>

      <H>Reacting to pros</H>
      <List
        items={[
          "Only react to pros you've actually hired. Be honest.",
          "Don't react to your own business, or to a business you work for or are paid by.",
          "Notes must be true, friendly and short. No phone numbers, links, ads, personal attacks or private information.",
          "Public reactions are positive only (👍 or ❤️). If you had a bad experience, use the private “Had a bad experience?” report instead.",
        ]}
      />

      <H>Your content</H>
      <p>
        You own what you post. By posting a reaction or note, you let {n} show it in the app and in link previews, so neighbors
        can find good pros. You can edit or remove your reactions anytime.
      </p>

      <H>Keeping it trustworthy</H>
      <p>
        We may hide reactions or notes, merge duplicate businesses, limit how many reactions an account can add, or suspend
        accounts that break these rules or look fake. We review private reports but can&apos;t promise to act on every one.
      </p>

      <H>About the pros</H>
      <p>
        Pros on {n} are independent businesses. We don&apos;t employ, vet, license or guarantee them. Reactions are
        neighbors&apos; opinions. Any agreement you make is between you and the pro. Check licenses and insurance yourself
        for anything important.
      </p>

      <H>Text messages</H>
      <p>
        By signing up you agree to receive one-time login codes by text. Message and data rates may apply. We don&apos;t
        send marketing texts.
      </p>

      <H>The legal fine print</H>
      <List
        items={[
          `${n} is provided "as is." To the extent the law allows, we aren't liable for the work of pros, for what other users post, or for indirect damages.`,
          "You can stop using the app and delete your account at any time. We may change or end the service.",
          `These terms are governed by the laws of the State of ${LEGAL.governingState}.`,
          "If we change these terms in a way that matters, we'll let you know in the app.",
        ]}
      />

      <H>Contact</H>
      <p>Questions about these terms? Email {LEGAL.contactEmail}.</p>
    </LegalPage>
  );
}
