import { NextResponse } from "next/server";

/**
 * JSON response cached at the CDN edge. Every visitor within `sMaxAge`
 * seconds shares one upstream fetch; after that a stale copy is served
 * instantly while it refreshes in the background.
 */
export function cachedJson(
  body: unknown,
  { sMaxAge = 60, staleWhileRevalidate = 600 } = {}
) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    },
  });
}

export function errorJson(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json(
    { error: message },
    { status: 502, headers: { "Cache-Control": "no-store" } }
  );
}
