import { Badge } from "@/components/ui/badge";

type NewsHeroProps = {
  digest: {
    weekKey: string;
    sourceCounts: {
      forumPosts: number;
      forumTopics: number;
    };
    generatedAtMs: number;
  };
};

export function NewsHero({ digest }: NewsHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,34,82,0.96)_0%,rgba(93,47,141,0.88)_54%,rgba(181,88,152,0.72)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
      <div className="pointer-events-none absolute -right-8 top-2 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-28px] left-[38%] h-24 w-24 rounded-full bg-cyan-300/15 blur-2xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
              Weekly forum digest
            </div>
            <Badge
              className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100 shadow-[0_8px_24px_rgba(73,224,255,0.16)]"
            >
              BETA
            </Badge>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Weekly Pyth Digest
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              An AI-powered weekly briefing that turns high-signal Pyth forum
              activity into a concise digest for token holders, generated with
              OpenAI models to make governance discussions easier to follow.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge className="rounded-xl border-white/12 bg-white/10 px-3 py-1 text-white">
            Week key {digest.weekKey}
          </Badge>
          <Badge className="rounded-xl border-white/12 bg-[#2a1e44] px-3 py-1 text-white/90">
            {digest.sourceCounts.forumTopics} topics
          </Badge>
          <Badge className="rounded-xl border-white/12 bg-[#2a1e44] px-3 py-1 text-white/90">
            {digest.sourceCounts.forumPosts} posts
          </Badge>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-3 text-xs text-white/70 sm:text-sm">
        <span>
          Generated {new Date(digest.generatedAtMs).toLocaleString()}
        </span>
        <span className="hidden h-1 w-1 rounded-full bg-white/35 sm:block" />
        <span>Powered by OpenAI</span>
        <span className="hidden h-1 w-1 rounded-full bg-white/35 sm:block" />
        <span>Sources: Pyth forum proposals and ideas bank</span>
      </div>
    </section>
  );
}
