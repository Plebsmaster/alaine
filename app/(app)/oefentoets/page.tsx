import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Oefentoets" };

export default function Page() {
  return (
    <ComingSoon title="Oefentoets" phase={5}>
      Pretest vóór een thema en een gemengde proeftoets met resultaat per leerdoel.
    </ComingSoon>
  );
}
