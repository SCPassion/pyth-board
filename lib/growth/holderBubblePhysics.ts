import type { BubblePoint } from "./holderBubbles";

export type BubbleBody = BubblePoint & { vx: number; vy: number; phase: number };
export type BubbleDrag = { owner: string; x: number; y: number };
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function createBubbleBodies(points: BubblePoint[], previous: BubbleBody[] = [], resetPositions = false): BubbleBody[] {
  const byOwner = new Map(previous.map(body => [body.owner, body]));
  return points.map((point, index) => {
    const old = byOwner.get(point.owner);
    const phase = old?.phase ?? index * 2.399963;
    return { ...point, x: resetPositions ? point.x : old?.x ?? point.x, y: resetPositions ? point.y : old?.y ?? point.y, phase,
      vx: old?.vx ?? Math.cos(phase) * 0.7, vy: old?.vy ?? Math.sin(phase) * 0.7 };
  });
}

/** Mutate one simulation frame; the renderer writes transforms without React renders. */
export function stepHolderBubbles(bodies: BubbleBody[], width: number, height: number, time: number, elapsed: number, drift: boolean, drag: BubbleDrag | null = null) {
  const frames = clamp(elapsed / (1000 / 60), 0, 2);
  const bound = (body: BubbleBody) => {
    const x = clamp(body.x, body.radius + 2, width - body.radius - 2);
    const y = clamp(body.y, body.radius + 2, height - body.radius - 2);
    if (x !== body.x) body.vx *= -0.6;
    if (y !== body.y) body.vy *= -0.6;
    body.x = x; body.y = y;
  };
  for (const body of bodies) {
    if (body.owner === drag?.owner) {
      body.x = drag.x; body.y = drag.y; body.vx = 0; body.vy = 0;
    } else {
      if (drift) {
        // A sustained cruising speed keeps idle motion visible without any pointer input.
        const heading = body.phase + Math.sin(time * 0.00018 + body.phase) * 0.9;
        const speed = 0.55 + Math.min(1, 24 / body.radius) * 0.35;
        body.vx += (Math.cos(heading) * speed - body.vx) * 0.035 * frames;
        body.vy += (Math.sin(heading) * speed - body.vy) * 0.035 * frames;
        // Gentle inward steering prevents bubbles collecting against the walls.
        body.vx += (width / 2 - body.x) * 0.000012 * frames;
        body.vy += (height / 2 - body.y) * 0.000012 * frames;
      }
      const damping = Math.pow(drift ? 0.997 : 0.86, frames);
      body.vx = clamp(body.vx * damping, -5, 5);
      body.vy = clamp(body.vy * damping, -5, 5);
      body.x += body.vx * frames; body.y += body.vy * frames;
    }
    bound(body);
  }
  // Several passes let a dragged bubble displace a group instead of passing through it.
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const minimum = a.radius + b.radius + 3;
      const squared = dx * dx + dy * dy;
      if (squared >= minimum * minimum) continue;
      if (squared < 0.000001) { dx = 0.001; dy = 0; }
      const distance = Math.hypot(dx, dy), nx = dx / distance, ny = dy / distance;
      const inverseA = a.owner === drag?.owner ? 0 : 1 / (a.radius * a.radius);
      const inverseB = b.owner === drag?.owner ? 0 : 1 / (b.radius * b.radius);
      const total = inverseA + inverseB;
      const push = minimum - distance;
      a.x -= nx * push * inverseA / total; a.y -= ny * push * inverseA / total;
      b.x += nx * push * inverseB / total; b.y += ny * push * inverseB / total;
      const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approach < 0) {
        const impulse = -1.6 * approach / total;
        a.vx -= impulse * nx * inverseA; a.vy -= impulse * ny * inverseA;
        b.vx += impulse * nx * inverseB; b.vy += impulse * ny * inverseB;
      }
      bound(a); bound(b);
    }
  }
}
