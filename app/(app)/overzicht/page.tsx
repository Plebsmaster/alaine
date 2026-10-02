import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Overzicht" };

export default function Page() {
  return (
    <ComingSoon title="Overzicht" phase={6}>
      Retentie per thema, leerdoelendekking, werklast voor de komende 14 dagen, dagen tot de toets en lastige kaarten.
    </ComingSoon>
  );
}
