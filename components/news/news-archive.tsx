"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NewsDigest } from "@/lib/news/types";

type NewsArchiveProps = {
  digests: NewsDigest[];
  selectedWeekKey: string;
  onSelect: (weekKey: string) => void;
};

export function NewsArchive({
  digests,
  selectedWeekKey,
  onSelect,
}: NewsArchiveProps) {
  const formatSummaryParagraphs = (summary: string) =>
    summary
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">Archive</h2>
          <p className="text-sm text-[#958daf]">
            Browse recent digests without leaving the page.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-xl border-white/10 bg-[#2d2741] px-3 py-1 text-xs text-[#c3bdd6]"
        >
          {digests.length} weeks
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {digests.map((digest) => {
          const selected = digest.weekKey === selectedWeekKey;
          const summaryParagraphs = formatSummaryParagraphs(digest.summary);

          return (
            <button
              key={digest.weekKey}
              className="text-left"
              onClick={() => onSelect(digest.weekKey)}
              type="button"
            >
              <Card
                className={cn(
                  "h-full rounded-[24px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] py-0 transition-all hover:border-white/20 hover:bg-[#342b47]",
                  selected &&
                    "border-cyan-300/30 bg-[linear-gradient(148deg,rgba(58,44,91,0.92)_0%,rgba(37,29,58,0.9)_100%)] shadow-[0_16px_40px_rgba(8,5,18,0.22)]"
                )}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#928bb0]">
                        {digest.weekKey}
                      </p>
                      <h3 className="text-base font-semibold text-white">
                        {digest.title}
                      </h3>
                    </div>
                    {selected ? (
                      <Badge className="rounded-xl border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] text-cyan-100">
                        Selected
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {summaryParagraphs.map((paragraph, index) => (
                      <p
                        key={`${digest.weekKey}-archive-summary-${index}`}
                        className="text-sm leading-7 text-[#c8c1dc]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-[#9f97b8]">
                    <span>{digest.sourceCounts.forumTopics} topics</span>
                    <span>{digest.sourceCounts.forumPosts} posts</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </section>
  );
}
