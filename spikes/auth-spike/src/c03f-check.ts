import "dotenv/config";
import serverless from "serverless-http";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth-uuid.js";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getRequest, setResponse } = require('/Users/mac/Documents/peggy-app/spikes/auth-spike/node_modules/better-call/dist/adapters/node/request.cjs');

const app = express();
const wrapped = async (req: any, res: any) => {
  console.log("wrapped start");
  const t0 = Date.now();
  const base = `${req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http")}://${req.headers[":authority"] || req.headers.host}`;
  let gr;
  try {
    gr = getRequest({ base, request: req });
    console.log("getRequest done in", Date.now() - t0, "ms, url=", gr.url);
  } catch (e: any) {
    console.error("getRequest err:", e?.message);
    res.status(500).end();
    return;
  }
  console.log("calling handler...");
  const t1 = Date.now();
  let response;
  try {
    response = await Promise.race([
      (auth as any).handler(gr),
      new Promise((_, rej) => setTimeout(() => rej(new Error("HANDLER TIMEOUT")), 10000)),
    ]);
    console.log("handler done in", Date.now() - t1, "ms, status=", response?.status);
  } catch (e: any) {
    console.error("handler err:", e?.message);
    res.status(500).end();
    return;
  }
  console.log("setResponse...");
  await setResponse(res, response);
  console.log("done");
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
  new Promise((_, rej) => setTimeout(() => rej(new Error("OUTER TIMEOUT")), 20000)),
])
  .then((res: any) => { console.log("OUTER RESULT:", res?.statusCode, (res?.body ?? "").slice(0, 80)); process.exit(0); })
  .catch((e) => { console.error("OUTER ERR:", e?.message); process.exit(1); });
