import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { validateCoreEnv } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
