"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { MAIN } from "./nav-links";

const MOBILE = [
  { href: "/vandaag", label: "Vandaag", icon: "M4 12l5 5L20 6" },
  { href: "/casussen", label: "Casussen", icon: "M5 4h14v16H5zM9 9h6M9 13h6" },
  { href: "/overzicht", label: "Overzicht", icon: "M5 20V10M12 20V4M19 20v-7" },
  { href: "/meer", label: "Meer", icon: "M5 12h.01M12 12h.01M19 12h.01" },
];

const isActive = (path: string, href: string) =>
  path === href || path.startsWith(`${href}/`) || (href === "/themas" && path.startsWith("/thema/"));

export function SideNav({ signOut }: { signOut: () => Promise<void> }) {
  const path = usePathname();
  return (
    <nav aria-label="Hoofdmenu" className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-6 md:flex">
      <Link href="/vandaag" className="mb-6 px-3 text-lg font-semibold tracking-tight">
        PA Studie
      </Link>
      <ul className="space-y-1">
        {MAIN.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(path, item.href) ? "page" : undefined}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <LogoutButton signOut={signOut} className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2" />
      </div>
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  const moreActive = !MOBILE.slice(0, 3).some((i) => isActive(path, i.href));
  return (
    <nav
      aria-label="Hoofdmenu"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {MOBILE.map((item) => {
          const active = item.href === "/meer" ? moreActive : isActive(path, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted aria-[current=page]:font-semibold aria-[current=page]:text-accent"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

