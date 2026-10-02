"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { activeWorkspace, matches, SETTINGS_ICON, SUBNAV_ROOTS, WORKSPACES } from "./nav-links";
import { Segmented } from "./ui";

// App-shell volgens docs/design/README.md, 1b. Elementen met data-shell verdwijnen in de
// focusmodus (zie app/globals.css).

export function Icon({ d, size = 22, strokeWidth = 1.9, className = "" }: { d: string; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

function examLabel(days: number) {
  return days === 0 ? "vandaag" : `${days} ${days === 1 ? "dag" : "dagen"}`;
}

/** Laptop: bovenbalk met merk, vier werkruimtes, eerstvolgende toets en instellingen. */
export function TopBar({ today, exam }: { today: number; exam: { module: string; days: number } | null }) {
  const path = usePathname();
  const active = activeWorkspace(path);
  return (
    <header data-shell className="hidden h-[60px] items-stretch gap-9 border-b border-border bg-surface px-7 md:flex">
      <Link href="/vandaag" className="flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-accent-text">
          PA
        </span>
        <span className="text-[15px] font-bold">PA Studie</span>
      </Link>
      <nav aria-label="Werkruimtes" className="flex items-stretch">
        {WORKSPACES.map((w) => (
          <Link
            key={w.key}
            href={w.href}
            aria-current={active?.key === w.key ? "page" : undefined}
            className="flex items-center gap-2 px-3.5 text-[15px] text-muted transition-colors hover:text-text motion-reduce:transition-none aria-[current=page]:font-bold aria-[current=page]:text-text aria-[current=page]:shadow-[inset_0_-2px_0_var(--accent)]"
          >
            {w.label}
            {w.key === "vandaag" && today > 0 ? (
              <span className="rounded-full bg-accent px-[7px] py-px text-xs font-bold tabular-nums text-accent-text">
                <span className="sr-only">, </span>
                {today}
                <span className="sr-only"> te doen</span>
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3.5">
        {exam ? (
          <span className="rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] tabular-nums text-text-2">
            Toets {exam.module} · {examLabel(exam.days)}
          </span>
        ) : null}
        <Link
          href="/instellingen"
          aria-label="Instellingen"
          aria-current={path === "/instellingen" ? "page" : undefined}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface-2 text-text-2 transition-colors hover:text-text motion-reduce:transition-none aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-strong"
        >
          <Icon d={SETTINGS_ICON} size={18} />
        </Link>
      </div>
    </header>
  );
}

/** Laptop: subnavigatie voor Leren en Studiestof. */
export function SubNav({ drafts }: { drafts: number }) {
  const path = usePathname();
  const ws = activeWorkspace(path);
  if (!ws || ws.sub.length === 0) return null;
  return (
    <nav data-shell aria-label={ws.label} className="hidden h-12 items-center gap-1.5 border-b border-border bg-surface-sunk px-7 md:flex">
      {ws.sub.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={matches(path, s.prefixes) ? "page" : undefined}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none aria-[current=page]:bg-accent-soft aria-[current=page]:font-bold aria-[current=page]:text-accent-strong"
        >
          {s.label}
          {s.showDrafts && drafts > 0 ? <span className="text-xs font-bold tabular-nums text-muted">{drafts}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Telefoon: werkruimtewissel bovenaan de hoofdpagina's van Leren en Studiestof. */
export function MobileWorkspaceSwitch({ drafts }: { drafts: number }) {
  const path = usePathname();
  const ws = activeWorkspace(path);
  if (!ws || ws.sub.length === 0 || !SUBNAV_ROOTS.includes(path)) return null;
  const current = ws.sub.find((s) => matches(path, s.prefixes));
  return (
    <div data-shell className="mb-5 md:hidden">
      <Segmented
        label={ws.label}
        value={current?.href ?? ""}
        items={ws.sub.map((s) => ({
          key: s.href,
          href: s.href,
          label: (
            <>
              {s.short ?? s.label}
              {s.showDrafts && drafts > 0 ? (
                <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold tabular-nums text-accent-text">{drafts}</span>
              ) : null}
            </>
          ),
        }))}
      />
    </div>
  );
}

/** Telefoon: onderbalk met de vier werkruimtes. */
export function BottomNav({ today }: { today: number }) {
  const path = usePathname();
  const active = activeWorkspace(path);
  return (
    <nav
      data-shell
      aria-label="Werkruimtes"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-[60px] grid-cols-4">
        {WORKSPACES.map((w) => {
          const on = active?.key === w.key;
          return (
            <li key={w.key}>
              <Link
                href={w.href}
                aria-current={on ? "page" : undefined}
                className="relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted aria-[current=page]:font-bold aria-[current=page]:text-accent"
              >
                <Icon d={w.icon} size={22} strokeWidth={on ? 2.2 : 1.9} />
                {w.label}
                {w.key === "vandaag" && today > 0 ? (
                  <span className="absolute left-[56%] top-1.5 rounded-full bg-accent px-[5px] text-[10px] font-bold tabular-nums text-accent-text">
                    <span className="sr-only">, </span>
                    {today}
                    <span className="sr-only"> te doen</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Kop van de focusmodus: alleen "Stoppen". Zonder `to` terug naar de werkruimte van de pagina.
 * De schermen zelf vullen de rest van de kop in (voortgang, stappen).
 */
export function FocusBar({ to, children }: { to?: string; children?: ReactNode }) {
  const path = usePathname();
  const target =
    to ?? (path.startsWith("/casussen") ? "/casussen" : path.startsWith("/oefentoets") ? "/oefentoets" : "/overzicht");
  return (
    <header className="flex h-16 items-center gap-4 md:gap-7">
      <Link
        href={target}
        aria-label="Stoppen"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-surface text-sm text-text-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none md:h-10 md:w-auto md:px-3"
      >
        <Icon d="M6 6l12 12M18 6L6 18" size={16} />
        <span className="hidden md:inline">Stoppen</span>
      </Link>
      {children}
    </header>
  );
}

/**
 * Zet de focusmodus aan zolang dit element op de pagina staat: de navigatie van de app
 * verdwijnt (CSS in app/globals.css), zonder flits en ook offline.
 */
export function FocusMarker() {
  return <span data-focus hidden />;
}
