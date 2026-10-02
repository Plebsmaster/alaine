import Link from "next/link";
import { MORE_LINKS } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";
import { PageHeader } from "@/components/ui";
import { signOut } from "../actions";

export const metadata = { title: "Meer" };

export default function MorePage() {
  return (
    <>
      <PageHeader title="Meer" />
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {MORE_LINKS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-12 items-center px-4 hover:bg-surface-2">
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <LogoutButton signOut={signOut} className="flex min-h-12 w-full items-center px-4 text-left text-muted hover:bg-surface-2" />
        </li>
      </ul>
    </>
  );
}
