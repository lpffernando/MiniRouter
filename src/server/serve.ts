import { serve } from "@hono/node-server";
import { loadDotEnv } from "../config/dotenv.js";

loadDotEnv();
const [{ PROXY_PORT }, { createApp }] = await Promise.all([
  import("../config.js"),
  import("./app.js"),
]);
const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: PROXY_PORT,
  },
  (info) => {
    console.log(`[MiniRouter] listening on http://localhost:${info.port}`);
    console.log(`[MiniRouter] dashboard: http://localhost:${info.port}/models/dashboard`);
  },
);
