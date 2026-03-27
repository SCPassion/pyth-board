import { httpRouter } from "convex/server";
import { handleHeliusWebhook } from "./activity";

const http = httpRouter();

http.route({
  path: "/webhooks/pyth-swaps",
  method: "POST",
  handler: handleHeliusWebhook,
});

export default http;
