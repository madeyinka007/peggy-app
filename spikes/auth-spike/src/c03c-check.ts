import "dotenv/config";
import express from "express";
import serverless from "serverless-http";

const app = express();
app.get("/api/auth/get-session", (req, res) => {
  console.log("handler reached, method:", req.method);
  res.json({ hello: "world" });
});

const handler = serverless(app, { binary: false });

const e1 = {
  version: "2.0", routeKey: "GET /api/auth/get-session", rawPath: "/api/auth/get-session",
  rawQueryString: "", headers: { "content-type": "application/json", host: "localhost:3097" },
  requestContext: { http: { method: "GET", path: "/api/auth/get-session" }, requestId: "r1" },
  isBase64Encoded: false,
};

console.log("invoking...");
Promise.race([
  handler(e1 as any, {} as any),
  new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 10000)),
])
  .then((res: any) => { console.log("RESULT:", res.statusCode, (res.body ?? "").slice(0, 80)); process.exit(0); })
  .catch((e) => { console.error("ERR:", e?.message); process.exit(1); });
