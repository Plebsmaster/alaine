// Informatiearchitectuur: vier werkruimtes (docs/design/README.md, 1b). Geen "use client",
// zodat server- en clientcomponenten dezelfde lijst gebruiken.

export type SubItem = {
  href: string;
  label: string;
  /** Kortere naam voor de werkruimtewissel op de telefoon. */
  short?: string;
  prefixes: string[];
  showDrafts?: boolean;
};

export type Workspace = {
  key: "vandaag" | "leren" | "studiestof" | "inzicht";
  label: string;
  /** Eerste pagina van de werkruimte. */
  href: string;
  /** Icoon (24 × 24, stroke). */
  icon: string;
  prefixes: string[];
  sub: SubItem[];
};

export const WORKSPACES: Workspace[] = [
  { key: "vandaag", label: "Vandaag", href: "/vandaag", icon: "M4 12l5 5L20 6", prefixes: ["/vandaag"], sub: [] },
  {
    key: "leren",
    label: "Leren",
    href: "/casussen",
    icon: "M3 8l9-4 9 4-9 4-9-4zM7 10v5c1.5 1.5 3 2 5 2s3.5-.5 5-2v-5",
    prefixes: ["/casussen", "/oefentoets"],
    sub: [
      { href: "/casussen", label: "Casussen", prefixes: ["/casussen"] },
      { href: "/oefentoets", label: "Oefentoets", prefixes: ["/oefentoets"] },
    ],
  },
  {
    key: "studiestof",
    label: "Studiestof",
    href: "/themas",
    icon: "M6 3h9l3 3v15H6zM9 11h6M9 15h6",
    prefixes: ["/themas", "/thema", "/scripts", "/goedkeuren", "/kaart"],
    sub: [
      { href: "/themas", label: "Thema's", prefixes: ["/themas", "/thema", "/kaart"] },
      { href: "/scripts", label: "Illness scripts", short: "Scripts", prefixes: ["/scripts"] },
      { href: "/goedkeuren", label: "Goedkeuren", prefixes: ["/goedkeuren"], showDrafts: true },
    ],
  },
  { key: "inzicht", label: "Inzicht", href: "/overzicht", icon: "M5 20V10M12 20V4M19 20v-7", prefixes: ["/overzicht"], sub: [] },
];

/** Icoon van de instellingenknop (schuifjes). */
export const SETTINGS_ICON = "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4";

export function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Actieve werkruimte bij een pad; /instellingen hoort bij geen enkele. */
export function activeWorkspace(path: string): Workspace | undefined {
  return WORKSPACES.find((w) => matches(path, w.prefixes));
}

/** Hoofdpagina's waar de telefoon bovenaan de werkruimtewissel toont. */
export const SUBNAV_ROOTS = WORKSPACES.flatMap((w) => w.sub.map((s) => s.href));
