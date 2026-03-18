import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <CardContent className="space-y-6 p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white sm:text-[30px]">
              {digest.title}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-[#c9c3dc] sm:text-[15px]">
              {digest.summary}
            </p>
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
              className="rounded-[24px] border border-white/10 bg-[#2d263d]/80 p-5"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#928bb0]">
                    Section
                  </p>
                  <h3 className="text-base font-semibold text-white">
                    {section.title}
                  </h3>
                  <p className="text-sm leading-6 text-[#c8c1dc]">
                    {section.summary}
                  </p>
                </div>
              </div>
              {section.sources.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {section.sources.map((source) => (
                    <a
                      key={`${section.id}-${source.url}`}
                      className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100 transition-colors hover:bg-cyan-300/20"
                      href={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9f97b8]">
          <span>{digest.sourceCounts.forumTopics} topics reviewed</span>
          <span>{digest.sourceCounts.forumPosts} posts retained</span>
          <span>Generated {new Date(digest.generatedAtMs).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
