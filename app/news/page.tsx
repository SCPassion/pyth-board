"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NewsHero } from "@/components/news/news-hero";
import { NewsDigestCard } from "@/components/news/news-digest-card";
import { NewsArchive } from "@/components/news/news-archive";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Newspaper } from "lucide-react";
import type { NewsDigest } from "@/lib/news/types";

export default function NewsPage() {
  const latestDigest = useQuery(api.news.getLatestDigest, {});
  const archiveDigests = useQuery(api.news.listDigests, { limit: 12 });
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWeekKey && latestDigest?.weekKey) {
      setSelectedWeekKey(latestDigest.weekKey);
    }
  }, [latestDigest, selectedWeekKey]);

  if (latestDigest === undefined || archiveDigests === undefined) {
    return (
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,34,82,0.96)_0%,rgba(93,47,141,0.88)_54%,rgba(181,88,152,0.72)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded-full bg-white/20" />
            <div className="h-10 w-72 animate-pulse rounded-2xl bg-white/18" />
            <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-xl bg-white/12" />
          </div>
        </section>

        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="flex items-center justify-center gap-3 p-8 text-[#c8c1dc]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading weekly digest...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!latestDigest || archiveDigests.length === 0) {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#342b47] text-white">
            <Newspaper className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl text-white">Weekly Pyth Digest</h1>
            <p className="max-w-xl text-sm leading-6 text-[#c8c1dc]">
              No digest has been generated yet. Once the weekly forum job runs,
              this page will show the latest digest and archive.
            </p>
          </div>
          <Badge
            variant="outline"
            className="rounded-xl border-white/10 bg-[#2d2741] px-3 py-1 text-xs text-[#c3bdd6]"
          >
            Waiting for first weekly run
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const digests = archiveDigests as NewsDigest[];
  const selectedDigest =
    digests.find((digest) => digest.weekKey === selectedWeekKey) ??
    (latestDigest as NewsDigest);

  return (
    <div className="w-full min-w-0 space-y-10 overflow-x-hidden">
      <NewsHero digest={selectedDigest} />
      <NewsDigestCard digest={selectedDigest} />
      <NewsArchive
        digests={digests}
        selectedWeekKey={selectedDigest.weekKey}
        onSelect={setSelectedWeekKey}
      />
    </div>
  );
}
