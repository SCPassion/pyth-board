import { Archivo, Fraunces, IBM_Plex_Mono } from "next/font/google";

/**
 * Site-wide typography system: a distinctive grotesk for UI/body copy, a
 * refined display serif for headings, and a monospace face for figures,
 * timestamps and addresses. Loaded once here and wired into CSS variables
 * in `app/layout.tsx` / `app/globals.css` (`.font-display`, `.font-data`)
 * so every page shares the same identity instead of the generic default
 * Inter font.
 */
export const uiSansFont = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const displayFont = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});
