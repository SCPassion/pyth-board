import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SEO_PAGES, ogSlugToPath, OG_SLUGS } from "@/lib/seo";

// Prerendered at build time: one PNG per page, so link previews on X,
// Telegram, Discord, etc. show the Pyth logo and that page's own title.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return OG_SLUGS.map((slug) => ({ slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const path = ogSlugToPath(slug);
  if (!path) return new Response("Not found", { status: 404 });

  const page = SEO_PAGES[path];
  const [headline] = page.title.split(" | ");
  const logo = await readFile(join(process.cwd(), "public", "pyth-512.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(circle at 85% 15%, #2e1065 0%, #020617 55%)",
          color: "#f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={88} height={88} alt="" />
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: "#e6dafe",
            }}
          >
            Pyth Board
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: headline.length > 48 ? 58 : 68,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "#94a3b8",
              maxWidth: 1000,
            }}
          >
            {page.description}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#a78bfa" }}>
          pyth.scptech.xyz
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
