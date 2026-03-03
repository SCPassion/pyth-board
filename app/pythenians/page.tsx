"use client";

import dynamic from "next/dynamic";
import { NFTRoles } from "@/components/nft-roles";
import { sortedRolesNFT } from "@/data/nftRoleInfo";

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}

function PytheniansSkeleton() {
  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <PulseBlock className="h-8 w-56" />
              <PulseBlock className="h-4 w-72 max-w-full rounded-xl" />
            </div>
            <PulseBlock className="h-7 w-28 rounded-xl" />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PulseBlock className="h-10 w-full rounded-2xl lg:max-w-md" />
            <div className="flex gap-2">
              <PulseBlock className="h-10 w-24 rounded-2xl" />
              <PulseBlock className="h-10 w-24 rounded-2xl" />
              <PulseBlock className="h-10 w-32 rounded-2xl" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="rounded-[28px] border border-white/8 bg-[linear-gradient(148deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] p-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <PulseBlock className="h-14 w-14 rounded-2xl" />
                    <PulseBlock className="h-7 w-24 rounded-xl" />
                  </div>
                  <PulseBlock className="h-7 w-36 rounded-2xl" />
                  <PulseBlock className="h-4 w-full rounded-xl" />
                  <PulseBlock className="h-4 w-3/4 rounded-xl" />
                  <div className="flex gap-2">
                    <PulseBlock className="h-10 flex-1 rounded-2xl" />
                    <PulseBlock className="h-10 flex-1 rounded-2xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const PytheniansContent = () => {
  return <NFTRoles nftRoles={sortedRolesNFT} />;
};

export default dynamic(() => Promise.resolve(PytheniansContent), {
  ssr: false,
  loading: () => <PytheniansSkeleton />,
});
