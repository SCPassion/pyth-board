import { expect, it } from "vitest";
import { createBubbleBodies, stepHolderBubbles } from "../lib/growth/holderBubblePhysics";
import { layoutHolderBubbles } from "../lib/growth/holderBubbles";

it("drifts over time while staying finite and within the map", () => {
  const bodies = createBubbleBodies(layoutHolderBubbles(Array.from({length:30},(_,i)=>({owner:`wallet${i}`,weight:BigInt(i+1)})),375,560));
  const start = bodies.map(body=>({x:body.x,y:body.y}));
  for(let frame=0;frame<600;frame++) stepHolderBubbles(bodies,375,560,frame*1000/60,1000/60,true);
  expect(bodies.some((body,i)=>Math.hypot(body.x-start[i].x,body.y-start[i].y)>2)).toBe(true);
  for(const body of bodies){
    expect(Number.isFinite(body.x+body.y+body.vx+body.vy)).toBe(true);
    expect(body.x-body.radius).toBeGreaterThanOrEqual(1.99);
    expect(body.x+body.radius).toBeLessThanOrEqual(373.01);
    expect(body.y-body.radius).toBeGreaterThanOrEqual(1.99);
    expect(body.y+body.radius).toBeLessThanOrEqual(558.01);
  }
});

it("floats visibly from idle without any drag input and continues after the first few seconds", () => {
  const bodies=createBubbleBodies([{owner:"one",x:400,y:250,radius:50}]);
  const start={x:bodies[0].x,y:bodies[0].y};
  for(let frame=0;frame<120;frame++) stepHolderBubbles(bodies,1000,600,frame*1000/60,1000/60,true);
  expect(Math.hypot(bodies[0].x-start.x,bodies[0].y-start.y)).toBeGreaterThan(45);
  const later={x:bodies[0].x,y:bodies[0].y};
  for(let frame=120;frame<240;frame++) stepHolderBubbles(bodies,1000,600,frame*1000/60,1000/60,true);
  expect(Math.hypot(bodies[0].x-later.x,bodies[0].y-later.y)).toBeGreaterThan(40);
});

it("pins a dragged bubble to the pointer and pushes neighbors out of its way", () => {
  const bodies=createBubbleBodies([{owner:"dragged",x:100,y:100,radius:25},{owner:"neighbor",x:180,y:100,radius:25}]);
  stepHolderBubbles(bodies,400,300,0,1000/60,false,{owner:"dragged",x:170,y:100});
  expect(bodies[0].x).toBe(170);
  expect(bodies[0].y).toBe(100);
  expect(bodies[1].x).toBeGreaterThan(222.9);
  expect(Math.hypot(bodies[1].x-bodies[0].x,bodies[1].y-bodies[0].y)).toBeGreaterThanOrEqual(52.999);
  stepHolderBubbles(bodies,400,300,0,1000/60,false,{owner:"dragged",x:-1000,y:1000});
  expect(bodies[0].x).toBe(27);
  expect(bodies[0].y).toBe(273);
});

it("damps release momentum, caps long frames, and preserves positions when selection rerenders", () => {
  const points=[{owner:"one",x:200,y:150,radius:25}];
  const bodies=createBubbleBodies(points);
  bodies[0].vx=5;
  for(let i=0;i<60;i++) stepHolderBubbles(bodies,400,300,i*16,16,false);
  expect(Math.abs(bodies[0].vx)).toBeLessThan(0.01);
  const refreshed=createBubbleBodies([{...points[0],radius:30}],bodies);
  expect(refreshed[0].x).toBe(bodies[0].x);
  expect(refreshed[0].radius).toBe(30);
  refreshed[0].vx=100;
  const x=refreshed[0].x;
  stepHolderBubbles(refreshed,400,300,100000,100000,true);
  expect(Math.abs(refreshed[0].x-x)).toBeLessThanOrEqual(10);
});

it("uses the newly measured layout on resize instead of keeping placeholder positions", () => {
  const previous=createBubbleBodies([{owner:"one",x:500,y:250,radius:40}]);
  previous[0].x=410;
  const measured=[{owner:"one",x:700,y:280,radius:45}];
  const reset=createBubbleBodies(measured,previous,true);
  expect(reset[0]).toMatchObject({x:700,y:280,radius:45,vx:previous[0].vx,vy:previous[0].vy});
  expect(createBubbleBodies(measured,previous)[0].x).toBe(410);
});
