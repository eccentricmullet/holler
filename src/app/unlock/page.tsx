import type { Metadata } from "next";
import { SITE } from "@/config/site";
import UnlockForm from "./UnlockForm";

export const metadata: Metadata = {
  title: `Unlock your town · ${SITE.name}`,
  description: `${SITE.tagline}. Get your neighbors on the list and we'll bring ${SITE.name} to your town.`,
};

export default function UnlockPage() {
  return <UnlockForm threshold={SITE.unlockThreshold} launchTown={SITE.launchTownShort} />;
}
