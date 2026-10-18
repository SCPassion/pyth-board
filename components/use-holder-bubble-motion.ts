"use client";

import { useEffect, useRef, type PointerEvent, type MouseEvent, type RefObject } from "react";
import type { BubblePoint } from "@/lib/growth/holderBubbles";
import { createBubbleBodies, stepHolderBubbles, type BubbleBody } from "@/lib/growth/holderBubblePhysics";

type Drag = {
  owner: string; pointerId: number; x: number; y: number; offsetX: number; offsetY: number;
  startX: number; startY: number; lastX: number; lastY: number; lastTime: number;
  vx: number; vy: number; moved: boolean;
};

export function useHolderBubbleMotion(points: BubblePoint[], width: number, height: number, enabled: boolean,
  container: RefObject<HTMLDivElement | null>, onSelectOwner: (owner: string | null) => void) {
  const bodies = useRef<BubbleBody[]>([]);
  const previousLayout = useRef<BubblePoint[] | null>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<Drag | null>(null);
  const suppressedClick = useRef<string | null>(null);
  const wake = useRef(() => {});

  useEffect(() => {
    // New dimensions or sizing need the new layout; toggling motion keeps positions.
    bodies.current = createBubbleBodies(points, bodies.current, previousLayout.current !== points);
    previousLayout.current = points;
    drag.current = null;
    let frame: number | null = null;
    let lastTime: number | null = null;
    let settling = 0;
    let inView = true;
    const paint = () => {
      for (const body of bodies.current) {
        const node = nodes.current.get(body.owner);
        if (node) node.style.transform = `translate3d(${body.x - body.radius}px, ${body.y - body.radius}px, 0)`;
      }
    };
    const tick = (time: number) => {
      frame = null;
      if (document.hidden || !inView) return;
      stepHolderBubbles(bodies.current, width, height, time, lastTime == null ? 1000 / 60 : time - lastTime, enabled, drag.current);
      lastTime = time;
      paint();
      if (enabled || drag.current || settling-- > 0) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame == null && !document.hidden && inView) { lastTime = null; frame = requestAnimationFrame(tick); }
    };
    wake.current = () => { settling = 45; start(); };
    const visibilityChanged = () => {
      if (document.hidden && frame != null) { cancelAnimationFrame(frame); frame = null; }
      else if (!document.hidden && (enabled || drag.current || settling > 0)) start();
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!inView && frame != null) { cancelAnimationFrame(frame); frame = null; }
      else if (inView && (enabled || drag.current || settling > 0)) start();
    });
    if (container.current) observer.observe(container.current);
    document.addEventListener("visibilitychange", visibilityChanged);
    stepHolderBubbles(bodies.current, width, height, 0, 0, false);
    paint();
    if (enabled) start();
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
      drag.current = null;
      wake.current = () => {};
    };
  }, [points, width, height, enabled, container]);

  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const body = bodies.current.find(body => body.owner === active.owner);
    if (body && active.moved) { body.vx = active.vx; body.vy = active.vy; }
    suppressedClick.current = active.moved || cancelled ? active.owner : null;
    drag.current = null;
    event.currentTarget.style.cursor = "grab";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    wake.current();
  }

  return (owner: string) => ({
    ref: (node: HTMLButtonElement | null) => { if (node) nodes.current.set(owner, node); else nodes.current.delete(owner); },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !event.isPrimary || drag.current) return;
      const body = bodies.current.find(body => body.owner === owner);
      const bounds = container.current?.getBoundingClientRect();
      if (!body || !bounds) return;
      suppressedClick.current = null;
      drag.current = { owner, pointerId: event.pointerId, x: body.x, y: body.y,
        offsetX: body.x - (event.clientX - bounds.left), offsetY: body.y - (event.clientY - bounds.top),
        startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY,
        lastTime: event.timeStamp, vx: 0, vy: 0, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor = "grabbing";
      wake.current();
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const active = drag.current;
      const bounds = container.current?.getBoundingClientRect();
      if (!active || active.pointerId !== event.pointerId || !bounds) return;
      active.moved ||= Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 4;
      if (!active.moved) return;
      event.preventDefault();
      const elapsed = Math.max(16, event.timeStamp - active.lastTime);
      active.vx = Math.max(-5, Math.min(5, (event.clientX - active.lastX) / elapsed * 1000 / 60));
      active.vy = Math.max(-5, Math.min(5, (event.clientY - active.lastY) / elapsed * 1000 / 60));
      active.x = event.clientX - bounds.left + active.offsetX;
      active.y = event.clientY - bounds.top + active.offsetY;
      active.lastX = event.clientX; active.lastY = event.clientY; active.lastTime = event.timeStamp;
      wake.current();
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finishDrag(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finishDrag(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finishDrag(event, true),
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail !== 0 && suppressedClick.current === owner) { suppressedClick.current = null; event.preventDefault(); return; }
      onSelectOwner(owner);
    },
  });
}
