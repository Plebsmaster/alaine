// Menu-items op één plek. Geen "use client": de pagina Meer (server) gebruikt deze lijst ook.

export const MAIN = [
  { href: "/vandaag", label: "Vandaag" },
  { href: "/goedkeuren", label: "Goedkeuren" },
  { href: "/themas", label: "Thema's" },
  { href: "/scripts", label: "Illness scripts" },
  { href: "/casussen", label: "Casussen" },
  { href: "/oefentoets", label: "Oefentoets" },
  { href: "/overzicht", label: "Overzicht" },
  { href: "/instellingen", label: "Instellingen" },
];

export const MORE_LINKS = MAIN.filter((i) => !["/vandaag", "/casussen", "/overzicht"].includes(i.href));
