"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play } from "lucide-react";
import { HOLDER_ENTITY_BY_OWNER } from "@/lib/growth/holderEntities";
import { layoutHolderBubbles } from "@/lib/growth/holderBubbles";
import type { HolderPeriod } from "@/lib/growth/holderRankings";
import { formatHolderTokens as tokens } from "@/lib/growth/holderHistory";
import { PythHolderHistory } from "@/components/pyth-holder-history";
import { useHolderBubbleMotion } from "@/components/use-holder-bubble-motion";
import styles from "./pyth-holder-bubbles.module.css";
import { growthActionClassName, growthSelectClassName } from "@/components/growth-controls";

type BubbleHolder = {
  owner: string;
  amount: string;
  viewRank: number;
  changes: { days: number; amountDelta: string | null; percentageDelta: string | null }[];
};
function changeFor(row: BubbleHolder, days: HolderPeriod, ready: boolean) {
  return ready ? row.changes.find(change => change.days === days) : undefined;
}
function percentageLabel(change: BubbleHolder["changes"][number] | undefined) {
  if (change?.amountDelta == null || change.percentageDelta == null) return "No comparison";
  const amount = BigInt(change.amountDelta);
  if (amount !== 0n && change.percentageDelta === "0.00") return `${amount > 0n ? "+" : "−"}<0.01%`;
  return `${amount > 0n ? "+" : ""}${change.percentageDelta}%`;
}
function bubbleEntityLabel(label: string) {
  return label.replace(/^Pyth Network: Stake Custody Auth.*$/, "Pyth Stake")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+(?:Hot|Cold)\s+Wallet\s*(\d*)/i, (_, number) => number ? ` #${number}` : "")
    .replace(/\s+Wallet\s+(\d+)/i, " #$1")
    .replace(/^(Binance)\s+(\d+)$/, "$1 #$2").trim();
}

export function PythHolderBubbles({ entries, days, ready, selectedOwner, onSelectOwner }: {
  entries: BubbleHolder[]; days: HolderPeriod; ready: boolean;
  selectedOwner: string | null; onSelectOwner: (owner: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [sizeBy, setSizeBy] = useState<"balance" | "change">("change");
  const [motion, setMotion] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hover, setHover] = useState<{ owner: string; x: number; y: number } | null>(null);
  const tooltip = useRef<HTMLDivElement | null>(null);
  const motionEnabled = motion ?? !reducedMotion;
  const sizing = sizeBy === "change" && ready ? "change" : "balance";
  const detailId = useId();
  const tooltipId = useId();
  function positionTooltip(x: number, y: number) {
    const node = tooltip.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(x + 12, window.innerWidth - bounds.width - 8))}px`;
    node.style.top = `${y + 18 + bounds.height > window.innerHeight - 8 ? Math.max(8, y - bounds.height - 12) : y + 18}px`;
  }
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(64, Math.round(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!hover) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setHover(null); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [hover]);
  const height = width < 640 ? 560 : 500;
  const points = useMemo(() => layoutHolderBubbles(entries.map(row => {
    const delta = changeFor(row, days, ready)?.amountDelta;
    const raw = sizing === "change" ? BigInt(delta ?? "0") : BigInt(row.amount);
    return { owner: row.owner, weight: raw < 0n ? -raw : raw };
  }), width, height), [entries, days, ready, sizing, width, height]);
  const bindBubble = useHolderBubbleMotion(points, width, height, motionEnabled, container, onSelectOwner);
  const byOwner = new Map(entries.map(row => [row.owner, row]));
  const selected = entries.find(row => row.owner === selectedOwner);
  const selectedChange = selected && changeFor(selected, days, ready);
  const selectedEntity = selected && HOLDER_ENTITY_BY_OWNER.get(selected.owner);
  const hovered = entries.find(row => row.owner === hover?.owner);
  return <div className="mt-4">
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/65">
      <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Bubble color legend">
        <span><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-300" />Increase +</span>
        <span><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-300" />Reduction −</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => setMotion(!motionEnabled)} aria-pressed={motionEnabled} className={growthActionClassName}>{motionEnabled ? <Pause aria-hidden="true" className="h-3.5 w-3.5" /> : <Play aria-hidden="true" className="h-3.5 w-3.5" />}{motionEnabled ? "Pause motion" : "Resume motion"}</button>
      <label className="flex items-center gap-2">Bubble size
        <select value={sizing} onChange={event => setSizeBy(event.target.value as typeof sizeBy)} className={growthSelectClassName}>
          <option value="balance">PYTH balance</option><option value="change" disabled={!ready}>Absolute PYTH change</option>
        </select>
      </label>
      </div>
    </div>
    <div ref={container} className="relative mt-3 overflow-hidden rounded-xl border border-white/10" style={{ height, background: "#101112" }} role="group" aria-label="PYTH holder bubble map">
      {points.map(point => {
        const row = byOwner.get(point.owner)!;
        const entity = HOLDER_ENTITY_BY_OWNER.get(row.owner);
        const delta = changeFor(row, days, ready);
        const amount = delta?.amountDelta != null ? BigInt(delta.amountDelta) : null;
        const color = amount == null || amount === 0n ? "#94a3b8" : amount > 0n ? "#54e45b" : "#ed6570";
        const center = amount != null && amount > 0n ? "#101d13" : "#221316";
        const label = entity ? bubbleEntityLabel(entity.label) : `${row.owner.slice(0, 4)}…${row.owner.slice(-4)}`;
        const changeLabel = percentageLabel(delta);
        const labelSize = Math.max(10, Math.min(40, point.radius * 1.5 / (label.length * 0.7)));
        const changeSize = Math.max(10, Math.min(36, point.radius * 1.5 / (changeLabel.length * 0.57)));
        const description = `${entity?.label ? `${entity.label} · ` : ""}${row.owner} · ${tokens(row.amount)} PYTH · ${amount != null ? `${tokens(amount.toString(), true)} PYTH (${changeLabel})` : "Previous balance unavailable"}`;
        const interaction = bindBubble(row.owner);
        return <button key={row.owner} type="button" aria-label={description} aria-pressed={selected?.owner === row.owner} aria-controls={detailId} aria-describedby={hovered?.owner === row.owner ? tooltipId : undefined}
          {...interaction}
          onPointerEnter={event => { if (event.pointerType !== "touch" && event.buttons === 0) setHover({ owner: row.owner, x: event.clientX, y: event.clientY }); }}
          onPointerLeave={() => setHover(null)}
          onPointerMove={event => {
            interaction.onPointerMove(event);
            if (event.buttons !== 0) setHover(null);
            else if (event.pointerType !== "touch") {
              if (hovered?.owner === row.owner) positionTooltip(event.clientX, event.clientY);
              else setHover({ owner: row.owner, x: event.clientX, y: event.clientY });
            }
          }}
          onPointerDown={event => { setHover(null); interaction.onPointerDown(event); }}
          onFocus={event => {
            if (!event.currentTarget.matches(":focus-visible")) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            setHover({ owner: row.owner, x: bounds.left + bounds.width / 2, y: bounds.bottom });
          }}
          onBlur={() => setHover(null)}
          onKeyDown={event => { if (event.key === "Escape") setHover(null); }}
          className={`${styles.bubble} absolute flex flex-col items-center justify-center rounded-full text-center outline-offset-4 hover:z-10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white`}
          style={{ left: 0, top: 0, transform: `translate3d(${point.x - point.radius}px, ${point.y - point.radius}px, 0)`, transition: "none", willChange: "transform", cursor: "grab", touchAction: "none", userSelect: "none", overflow: "hidden", width: point.radius * 2, height: point.radius * 2, color,
            border: `1px solid ${color}c0`, background: `radial-gradient(circle at 50% 50%, ${center} 42%, ${center} 60%, ${color}45 84%, ${color}c0 100%)`,
            boxShadow: `inset 0 0 ${Math.max(8, point.radius * 0.28)}px ${color}95, inset 0 1px 3px #ffffff60, 0 0 ${selected?.owner === row.owner ? 18 : 3}px ${color}35`,
            outline: selected?.owner === row.owner ? "2px solid white" : undefined }}>
          {point.radius >= 42 && <span aria-hidden="true" className="pointer-events-none mb-1 flex items-center justify-center rounded-full border border-white/20 bg-white/10 font-medium text-white/90" style={{ width: Math.min(28, point.radius * 0.42), height: Math.min(28, point.radius * 0.42), fontSize: Math.min(12, point.radius * 0.19) }}>{entity ? label.slice(0, 2).toUpperCase() : `#${row.viewRank}`}</span>}
          <span className="pointer-events-none block truncate font-medium text-white" style={{ width: "82%", fontSize: point.radius < 24 ? 10 : labelSize, lineHeight: 1.1, letterSpacing: "-0.025em", textShadow: "0 1px 5px #0008" }}>{point.radius < 24 ? `#${row.viewRank}` : label}</span>
          {point.radius >= 29 && <span className="pointer-events-none mt-1 font-medium text-white" style={{ fontSize: changeSize, lineHeight: 1.1, letterSpacing: "-0.02em", textShadow: "0 1px 5px #0008" }}>{changeLabel === "No comparison" ? "—" : changeLabel}</span>}
        </button>;
      })}
    </div>
    {hover && hovered && createPortal(<div id={tooltipId} role="tooltip" className={styles.tooltip} ref={node => { tooltip.current = node; if (node) positionTooltip(hover.x, hover.y); }}>
      {HOLDER_ENTITY_BY_OWNER.get(hovered.owner)?.label ?? `${hovered.owner.slice(0, 6)}…${hovered.owner.slice(-6)}`} — Rank {hovered.viewRank}
    </div>, document.body)}
    <p className="mt-2 text-xs leading-relaxed text-white/55">Drag bubbles to move them; click to inspect a wallet. Only wallets with a recorded nonzero change in this interval appear. Larger bubbles represent larger {sizing === "balance" ? "PYTH balances" : "absolute net PYTH changes"}; a minimum size keeps small values visible. Percentages show balance change. Placement does not indicate wallet relationships.</p>
    <div id={detailId} className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4" aria-live="polite">
      {selected ? <>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white">{selectedEntity?.label ?? "Wallet details"}<span className="ml-2 text-xs font-normal text-white/55">Holder rank #{selected.viewRank}</span></p>
          <button type="button" onClick={() => onSelectOwner(null)} className="rounded px-2 py-1 text-xs text-white/65 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300">Close</button>
        </div>
        <a href={`https://solscan.io/account/${selected.owner}`} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all rounded font-data text-xs text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300">{selected.owner} ↗</a>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-white/55">Current balance</dt><dd className="mt-1 text-sm tabular-nums text-white">{tokens(selected.amount)} PYTH</dd></div>
          <div><dt className="text-xs text-white/55">Net change · {days === 1 ? "24 hours" : `${days} days`}</dt><dd className={`mt-1 text-sm tabular-nums ${selectedChange?.amountDelta == null || BigInt(selectedChange.amountDelta) === 0n ? "text-white/70" : BigInt(selectedChange.amountDelta) > 0n ? "text-emerald-300" : "text-rose-300"}`}>{selectedChange?.amountDelta != null ? `${tokens(selectedChange.amountDelta, true)} PYTH (${percentageLabel(selectedChange)})` : "Previous balance unavailable"}</dd></div>
          <div><dt className="text-xs text-white/55">Previous balance</dt><dd className="mt-1 text-sm tabular-nums text-white/80">{selectedChange?.amountDelta != null ? `${tokens((BigInt(selected.amount) - BigInt(selectedChange.amountDelta)).toString())} PYTH` : "Unknown"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-white/50">Net balance changes can include transfers and staking activity; they do not establish buys or sells.</p>
        <PythHolderHistory key={`${selected.owner}-${days}`} owner={selected.owner} days={days} />
      </> : <p className="text-sm text-white/60">Choose a wallet bubble to see its full address, exact PYTH balance, and change over the selected period.</p>}
    </div>
  </div>;
}
