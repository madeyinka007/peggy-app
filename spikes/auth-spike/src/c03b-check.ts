import "dotenv/config";
import serverless from "serverless-http";
import { app } from "./server-uuid.js";

const handler = serverless(app, { binary: false });

const e1 = {
  version: "2.0", routeKey: "GET /api/auth/get-session", rawPath: "/api/auth/get-session",
  rawQueryString: "", headers: { "content-type": "application/json", host: "localhost:3097", origin: "http://localhost:3097" },
  requestContext: { http: { method: "GET", path: "/api/auth/get-session" }, requestId: "r1", domainName: "localhost" },
  isBase64Encoded: false,
};

console.log("invoking get-session via handler...");
Promise.race([
  handler(e1 as any, {} as any),
  new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 15000)),
])
  .then((res: any) => { console.log("GET-SESSION:", res.statusCode, (res.body ?? "").slice(0, 120)); process.exit(0); })
  .catch((e) => { console.error("ERR:", e?.message); process.exit(1); });
