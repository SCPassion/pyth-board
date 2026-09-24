import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { webhookSignatures, readBoundedBody } from "../lib/tracker/webhook";
const http = httpRouter();
http.route({
  path: "/helius/pyth-trades",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.HELIUS_API_KEY;
    if (!secret || request.headers.get("authorization") !== secret)
      return new Response("Unauthorized", { status: 401 });
    const config = await ctx.runQuery(internal.trackerStore.configuration, {});
    let signatures: string[];
    try {
      signatures = webhookSignatures(
        JSON.parse(await readBoundedBody(request)),
      );
    } catch {
      return new Response("Invalid webhook payload", { status: 400 });
    }
    if (!config.enabled) {
      return new Response("Collection disabled", { status: 503 });
    }
    await ctx.runMutation(internal.trackerStore.enqueue, {
      signatures,
      source: "WEBHOOK",
    });
    return new Response("Accepted", { status: 200 });
  }),
});
export default http;
