import type { Metadata } from "next";

export const SITE_URL = "https://pyth.scptech.xyz";

export const SEO_PAGES = {
  "/": {
    title: "Pyth Board — PYTH Staking & Network Dashboard",
    description:
      "Independent Pyth Network dashboard for PYTH governance staking, DAO reserves, buybacks, protocol revenue, holder growth, and weekly news.",
    index: true,
  },
  "/wallets": {
    title: "PYTH Governance Staking Wallet Tracker | Pyth Board",
    description:
      "Track PYTH governance stake across Solana wallets, including active balances, warmup, and unstaking. No wallet connection or signing required.",
    index: true,
  },
  "/pythenians": {
    title: "Pythenians NFT Roles & Partners | Pyth Board",
    description:
      "Explore the Pythenians NFT role and partner directory in Pyth Board, an independent Pyth Network community dashboard.",
    index: true,
  },
  "/reserve": {
    title: "Pyth Strategic Reserve & PYTH Buybacks | Pyth Board",
    description:
      "Explore Pyth DAO treasury and Pythian Council balances, tracked asset valuations, PYTH buybacks, and reserve history with links to public sources.",
    index: true,
  },
  "/revenue": {
    title: "Pyth Network Revenue & DAO Distributions | Pyth Board",
    description:
      "Explore reported Pyth protocol revenue, DAO distributions, and product breakdowns from Douro Labs reports published on the Pyth forum.",
    index: true,
  },
  "/growth": {
    title: "PYTH Holders, Governance Stakers & Network Growth | Pyth Board",
    description:
      "Track Pyth price-feed coverage, native PYTH holder counts, governance stakers, top wallet rankings, and unstaking through daily snapshots.",
    index: true,
  },
  "/news": {
    title: "Pyth Network News & Weekly Digest | Pyth Board",
    description:
      "Read weekly Pyth Network community digests and browse the archive of updates drawn from the Pyth forum.",
    index: true,
  },
  "/about": {
    title: "About Pyth Board — Independent Community Dashboard",
    description:
      "Learn about Pyth Board, an independent, unofficial Pyth Network dashboard, its public data sources, project disclosures, and data limitations.",
    index: true,
  },
  // Collection is paused and this beta page is hidden from navigation.
  "/activity": {
    title: "PYTH Trading Activity Beta | Pyth Board",
    description:
      "Review retained PYTH trading activity records and execution details. This beta tracker has limited coverage and collection is currently paused.",
    index: false,
  },
} as const;

export type SeoPath = keyof typeof SEO_PAGES;

/** URL slug for a page's social preview image (`/og/<slug>`). */
export function pathToOgSlug(path: SeoPath): string {
  return path === "/" ? "home" : path.slice(1);
}

export function ogSlugToPath(slug: string): SeoPath | undefined {
  const path = slug === "home" ? "/" : `/${slug}`;
  return path in SEO_PAGES ? (path as SeoPath) : undefined;
}

export const OG_SLUGS = (Object.keys(SEO_PAGES) as SeoPath[]).map(
  pathToOgSlug,
);

export function createPageMetadata(
  path: SeoPath,
  options: { index?: boolean } = {},
): Metadata {
  const page = SEO_PAGES[path];
  const url = new URL(path, SITE_URL).href;
  const image = {
    url: `${SITE_URL}/og/${pathToOgSlug(path)}`,
    width: 1200,
    height: 630,
    alt: page.title,
    type: "image/png",
  };

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    robots: {
      index: process.env.VERCEL_ENV !== "preview" && (options.index ?? page.index),
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Pyth Board",
      title: page.title,
      description: page.description,
      url,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image],
    },
  };
}
