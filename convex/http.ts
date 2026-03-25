import { httpRouter } from "convex/server";
import { handleHeliusSellWebhook } from "./sells";

const http = httpRouter();

http.route({
  path: "/webhooks/sells",
  method: "POST",
  handler: handleHeliusSellWebhook,
});

export default http;
