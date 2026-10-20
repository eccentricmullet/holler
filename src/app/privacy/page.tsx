import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { LEGAL } from "@/config/legal";
import LegalPage, { H, List } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Privacy policy · ${SITE.name}` };

export default function PrivacyPage() {
  const n = SITE.name;
  return (
    <LegalPage title="Privacy policy">
      <p>
        {n} is a map of the local pros your neighbors trust. This policy explains, in plain language, what we collect, what
        neighbors can see, and how to delete it. {n} is run by {LEGAL.operator}.
      </p>

      <H>The short version</H>
      <List
        items={[
          "Your exact address, exact location and phone number are never shown to anyone.",
          "Neighbors see your first name and last initial, your city, and the pros you react to, placed near your block. You can choose to stay hidden instead.",
          "We don't sell your information, and we don't show ads.",
          "You can delete your account and everything in it from your profile at any time.",
        ]}
      />

      <H>What we collect</H>
      <List
        items={[
          <><strong>Phone number</strong>, to send you a login code and to stop people from reacting to their own business.</>,
          <><strong>First name and last initial</strong>, shown with your reactions and notes.</>,
          <><strong>Home address</strong>, to find neighbors and pros near you. We store the exact spot privately and show only a rough block-level area (about 150 meters), never your house.</>,
          <><strong>Your reactions and notes</strong> (👍 or ❤️ for a pro, plus an optional short note).</>,
          <><strong>Private reports</strong> you send about a pro or a note. Only the admin sees these.</>,
          <><strong>Waitlist details</strong> (phone or email and ZIP code) if you ask us to bring {n} to your town.</>,
          <><strong>How the app is used</strong>: anonymous events like &ldquo;opened a pro page&rdquo; or &ldquo;tapped call,&rdquo; tied to an account ID, not your name or phone number.</>,
        ]}
      />

      <H>What neighbors can see</H>
      <p>
        If you choose &ldquo;Near my block,&rdquo; neighbors see your first name and last initial, your city, the pros
        you react to, and your notes. Your pins sit at a block-level spot, not your house. If you choose &ldquo;Keep me
        hidden,&rdquo; your reactions still count toward a pro&apos;s totals, but you have no pin and show as &ldquo;a
        neighbor.&rdquo; You can switch anytime in your profile.
      </p>

      <H>Who helps us run {n}</H>
      <p>We use a few service providers. They only get what they need to do their job:</p>
      <List
        items={[
          "Supabase stores the database and handles logins.",
          "Twilio sends the text messages with your login code.",
          "Google Places helps you find addresses and businesses.",
          "Mapbox draws the map.",
          "Vercel hosts the website.",
          "PostHog counts how the app is used so we can improve it.",
        ]}
      />

      <H>Deleting your information</H>
      <p>
        In the app, go to your profile, then Privacy and details, then Delete my account. This removes your reactions,
        notes, reports, name and login right away, and your home too if no one else in your household still has an account.
        Copies in routine backups are cleared within 30 days. You can also email {LEGAL.contactEmail}.
      </p>

      <H>Text messages</H>
      <p>
        We text you only to send login codes. Message and data rates may apply. We don&apos;t send marketing texts. If you
        join the waitlist, we&apos;ll contact you once, when your town unlocks.
      </p>

      <H>Kids</H>
      <p>{n} is for adults 18 and older. We don&apos;t knowingly collect information from children.</p>

      <H>Changes and contact</H>
      <p>
        If we change this policy in a way that matters, we&apos;ll let you know in the app. Questions? Email{" "}
        {LEGAL.contactEmail}.
      </p>
    </LegalPage>
  );
}
