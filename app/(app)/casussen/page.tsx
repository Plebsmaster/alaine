import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Casussen" };

export default function Page() {
  return (
    <ComingSoon title="Casussen" phase={4}>
      Casussessies van 3 tot 5 casussen, gemengd over thema&apos;s, met reflectietabel, hints en vergelijken met de expert.
    </ComingSoon>
  );
}
