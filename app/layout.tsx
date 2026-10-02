import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

// Interface: Atkinson Hyperlegible Next. Leestekst en titels: Newsreader. Zie docs/design/README.md.
const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-atkinson",
  display: "swap",
  // Next kent geen maten van dit lettertype voor een aangepaste fallback; gewoon de systeemletter.
  adjustFontFallback: false,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "PA Studie", template: "%s · PA Studie" },
  description: "Persoonlijke studie-app voor de master Physician Assistant",
  applicationName: "PA Studie",
  appleWebApp: { capable: true, title: "PA Studie", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      {/* Browserextensies (bijv. ColorZilla: cz-shortcut-listen) zetten attributen op <body> vóór React laadt.
          Dit onderdrukt alleen dat verschil op <body> zelf, niet in de inhoud. */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
