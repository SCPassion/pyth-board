import { PageMasthead } from "@/components/page-masthead";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";

const disclosures = [
  {
    icon: Info,
    label: "Project status",
    text: "Pyth Board is an independent dashboard built and maintained by a member of the Pyth community. It is a personal, unofficial project.",
  },
  {
    icon: ShieldCheck,
    label: "No affiliation",
    text: "It is not affiliated with, sponsored by, or endorsed by the Pyth Data Association, Douro Labs, the Pythian Council, or any institution that publishes data to the Pyth Network. None of those parties develops, operates, reviews, or verifies this site, and none of them is responsible for its content, availability, or accuracy.",
  },
  {
    icon: AlertTriangle,
    label: "Data limits",
    text: "Figures shown here are derived from public on-chain data and third-party price sources, and may be incomplete, delayed, or wrong. Nothing on this site is financial advice. Always verify against official sources before acting on anything you see here.",
  },
];

export default function AboutPage() {
  return (
    <div className="w-full min-w-0 space-y-10 sm:space-y-14">
      <PageMasthead
        eyebrow="About This Project"
        title="Independent community dashboard."
        description="Pyth Board summarizes public network data for community research and visibility. This page clarifies the project's unofficial status and the limits of the information shown here."
        right={
          <Badge
            variant="outline"
            className="font-data w-fit rounded-xl border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100"
          >
            Unofficial
          </Badge>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.075)_0%,rgba(255,255,255,0.025)_100%)] p-6 shadow-[0_24px_60px_rgba(9,5,20,0.22)] sm:p-8">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-300/70 via-fuchsia-300/50 to-transparent"
          />
          <div className="space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-200/20">
              <Info className="h-6 w-6" />
            </div>
            <div className="space-y-3">
              <p className="font-data text-[11px] uppercase tracking-[0.28em] text-cyan-300/65">
                Public Notice
              </p>
              <h2 className="font-display text-2xl italic leading-tight text-white sm:text-3xl">
                About this project.
              </h2>
              <p className="text-sm leading-7 text-[#c7c0d8] sm:text-base">
                Pyth Board is an independent dashboard built and maintained by a
                member of the Pyth community. It is a personal, unofficial
                project.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          {disclosures.slice(1).map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className="rounded-[26px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_20px_50px_rgba(9,5,20,0.18)]"
              >
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#342b47] text-[#d8d1ea] ring-1 ring-white/8">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-display text-xl text-white">
                      {item.label}
                    </h3>
                    <p className="text-sm leading-7 text-[#b8b0d0]">
                      {item.text}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-[#21192f]/70 p-6 shadow-[0_18px_45px_rgba(9,5,20,0.2)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="font-data text-[11px] uppercase tracking-[0.28em] text-fuchsia-200/65">
              Verification
            </p>
            <h2 className="font-display text-2xl italic text-white">
              Use official sources before taking action.
            </h2>
            <p className="text-sm leading-7 text-[#b8b0d0] sm:text-base">
              This dashboard can be useful for community monitoring, but it is
              not a source of financial advice or official confirmation.
            </p>
          </div>
          <Link
            href="https://pyth.network/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#2f2942] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3a3350]"
          >
            Official Pyth Site
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
