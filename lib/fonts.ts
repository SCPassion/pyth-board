import { Archivo, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";

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

// Self-hosted: Google Fonts started serving Fraunces to Vercel's build
// machines as `/l/font?kit=…&skey=…` URLs, which Turbopack's next/font/google
// loader can't resolve ("next/font/google queries have exactly one entry"),
// failing the production build. These are the same latin variable-weight
// files Google serves (fonts.gstatic.com/s/fraunces/v38).
export const displayFont = localFont({
  src: [
    {
      path: "../app/fonts/fraunces-latin-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../app/fonts/fraunces-latin-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

export const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});
