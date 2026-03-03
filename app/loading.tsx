function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(49,37,84,0.96)_0%,rgba(87,51,131,0.92)_52%,rgba(181,95,150,0.75)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
        <div className="pointer-events-none absolute -right-8 top-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-24px] right-[20%] h-20 w-20 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <PulseBlock className="h-3 w-32 rounded-lg bg-white/15" />
            <PulseBlock className="h-12 w-72 max-w-full rounded-3xl bg-white/20" />
            <PulseBlock className="h-4 w-80 max-w-full rounded-xl bg-white/12" />
          </div>
          <PulseBlock className="h-7 w-28 rounded-xl bg-white/15" />
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <PulseBlock className="h-8 w-48" />
              <PulseBlock className="h-4 w-64 rounded-xl" />
            </div>
            <PulseBlock className="h-7 w-20 rounded-xl" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-[28px] border border-white/8 bg-[#312940]/70 p-5">
              <PulseBlock className="h-5 w-28 rounded-xl" />
              <PulseBlock className="mt-4 h-10 w-44 rounded-2xl" />
              <PulseBlock className="mt-4 h-40 w-full rounded-[22px]" />
            </div>
            <div className="rounded-[28px] border border-white/8 bg-[#312940]/70 p-5">
              <PulseBlock className="h-5 w-36 rounded-xl" />
              <PulseBlock className="mt-4 h-10 w-28 rounded-2xl" />
              <PulseBlock className="mt-4 h-28 w-full rounded-[22px]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
