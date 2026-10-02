import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Illness scripts" };

export default function Page() {
  return (
    <ComingSoon title="Illness scripts" phase={3}>
      Illness scripts per aandoening, automatisch kaarten per veld, en aandoeningen naast elkaar vergelijken.
    </ComingSoon>
  );
}
