"use client";

import { useId, useState } from "react";

export type AddressRankResult = { message: string; tone: "found" | "info" };

const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function AddressRankSearch({ onLookup }: { onLookup: (address: string) => AddressRankResult }) {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [checkedAddress, setCheckedAddress] = useState("");
  const result = checkedAddress
    ? solanaAddress.test(checkedAddress)
      ? onLookup(checkedAddress)
      : { message: "Enter a valid Solana wallet address.", tone: "info" as const }
    : null;

  return <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
    <form onSubmit={event => { event.preventDefault(); setCheckedAddress(input.trim()); }}>
      <label htmlFor={inputId} className="block text-xs font-medium text-white/80">Check a wallet address</label>
      <div className="mt-2 flex gap-2">
        <input id={inputId} type="search" value={input} onChange={event => { setInput(event.target.value); setCheckedAddress(""); }} autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder="Paste a Solana address" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#292238] px-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-cyan-300" />
        <button type="submit" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-cyan-300">Check</button>
      </div>
    </form>
    {result ? <p role="status" className={`mt-2 text-xs leading-relaxed ${result.tone === "found" ? "text-emerald-200" : "text-white/65"}`}>{result.message}</p>
      : <p className="mt-2 text-[11px] text-white/50">Checks this daily snapshot. Paste the full address to see its rank.</p>}
  </div>;
}
