import { redirect } from "next/navigation";

// "Meer" bestaat niet meer: de telefoon heeft nu vier werkruimtes (docs/design/README.md, 1b).
export default function MorePage() {
  redirect("/themas");
}
