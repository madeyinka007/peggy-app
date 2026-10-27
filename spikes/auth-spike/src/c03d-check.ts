import "dotenv/config";
import express from "express";
import serverless from "serverless-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth-uuid.js";

const app = express();
const wrapped = async (req: any, res: any) => {
  console.log("wrapped: method=", req.method, "url=", req.url, "readable=", req.readable, "readableEnded=", req.readableEnded, "body=", req.body);
  return toNodeHandler(auth)(req, res);
};
app.all("/api/auth/*", wrapped as any);

const handler = serverless(app, { binary: false });

const e1 = {
  version: "2.0", routeKey: "GET /api/auth/get-session", rawPath: "/api/auth/get-session",
  rawQueryString: "", headers: { "content-type": "application/json", host: "localhost:3097", origin: "http://localhost:3097" },
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
