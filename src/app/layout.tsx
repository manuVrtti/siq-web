import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { validateCoreEnv } from "@/lib/env";

/*
 * Plan 019 UI redesign — two-font pairing.
 *   Inter    — body + UI (400/500/600). Neutral, honest, no personality where
 *              personality would hurt.
 *   Outfit   — display + headings (500/600/700). Slightly geometric, more
 *              character than Inter, wide enough to feel confident.
 *   JetBrains Mono — code + KPI numerics (400/500). Tabular by default.
 * All three self-host via next/font — no runtime CSS-of-the-day fetch.
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});
const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Plan 002 — fail fast on a misconfigured database rather than at the first
// query. Service-specific vars validate on first use; see src/lib/env.ts.
validateCoreEnv();

export const metadata: Metadata = {
  title: "SelectIQ",
  description:
    "Campus recruitment and assessment platform for Indian engineering colleges.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Plan 019 UI redesign — light theme, monochromatic blue palette.
      // The .dark tokens remain in globals.css so a future toggle is a
      // one-line change, not a rewrite.
      className={`${inter.variable} ${outfit.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
