import localFont from "next/font/local";

/**
 * Site-wide typography system: a distinctive grotesk for UI/body copy, a
 * refined display serif for headings, and a monospace face for figures,
 * timestamps and addresses. Loaded once here and wired into CSS variables
 * in `app/layout.tsx` / `app/globals.css` (`.font-display`, `.font-data`)
 * so every page shares the same identity instead of the generic default
 * Inter font.
 *
 * All three faces are self-hosted: Google Fonts started serving fonts to
 * Vercel's build machines as `/l/font?kit=…&skey=…` URLs, which Turbopack's
 * next/font/google loader can't resolve ("next/font/google queries have
 * exactly one entry"), failing the production build. These are the same
 * latin woff2 files Google serves from fonts.gstatic.com.
 */
export const uiSansFont = localFont({
  src: [
    {
      // Archivo v25, variable weight.
      path: "../app/fonts/archivo-latin-normal.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

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

export const monoFont = localFont({
  src: [
    // IBM Plex Mono v23, static weights.
    { path: "../app/fonts/ibm-plex-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/ibm-plex-mono-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../app/fonts/ibm-plex-mono-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  adjustFontFallback: false,
});
