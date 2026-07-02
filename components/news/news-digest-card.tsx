import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { NewsDigest } from "@/lib/news/types";

type NewsDigestCardProps = {
  digest: NewsDigest;
};

export function NewsDigestCard({ digest }: NewsDigestCardProps) {
  const cleanText = (text: string) =>
    text
      .replace(/^sources?:\s+/i, "")
      .replace(/\s*\(Sources?:[\s\S]*$/i, "")
      .trim();

  const summaryParagraphs = digest.summary
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const digestSections = digest.sections.map((section, index) => ({
    id: `${section.title}-${index}`,
    title: section.title,
    summary:
      section.summary ||
      (section.bullets ?? [])
        .map(cleanText)
        .filter(Boolean)
        .join(" "),
    sources: section.sources ?? [],
  }));

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardContent className="space-y-7 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h2 className="font-display text-2xl text-white sm:text-[30px]">
              {digest.title}
            </h2>
            <div className="max-w-4xl rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 sm:px-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9e97b8]">
                This Week
              </p>
              <div className="space-y-3">
                {summaryParagraphs.map((paragraph, index) => (
                  <p
                    key={`${digest.weekKey}-summary-${index}`}
                    className="max-w-[72ch] text-sm leading-8 text-[#d3cde4] sm:text-[15px]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className="rounded-xl border-white/10 bg-[#2d2741] px-3 py-1 text-xs text-[#c3bdd6]"
          >
            {digest.status}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {digestSections.map((section) => (
            <div
              key={section.id}
              className="rounded-[24px] border border-white/10 bg-[#2d263d]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#928bb0]">
                    Section
                  </p>
                  <h3 className="text-base font-semibold text-white">
                    {section.title}
                  </h3>
                  <p className="text-sm leading-7 text-[#c8c1dc]">
                    {section.summary}
                  </p>
                </div>
              </div>
              {section.sources.length > 0 ? (
                <div className="mt-7 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
                    Related sources
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                  {section.sources.map((source) => (
                    <a
                      key={`${section.id}-${source.url}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-300/14 px-3.5 py-2 text-xs font-medium text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.08)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300/22 hover:text-white hover:shadow-[0_10px_24px_rgba(34,211,238,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      href={source.url}
                      rel="noreferrer"
                      target="_blank"
                      title={`Open source: ${source.label}`}
                    >
                      {source.label}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    </a>
                  ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="font-data flex flex-wrap items-center gap-3 text-xs text-[#9f97b8]">
          <span>{digest.sourceCounts.forumTopics} topics reviewed</span>
          <span>{digest.sourceCounts.forumPosts} posts retained</span>
          <span>Generated {new Date(digest.generatedAtMs).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
