import "dotenv/config";
import serverless from "serverless-http";
import { app } from "./server-uuid.js";

const handler = serverless(app, { binary: false });

const event = {
  version: "2.0",
  routeKey: "GET /health",
  rawPath: "/health",
  rawQueryString: "",
  headers: { "content-type": "application/json" },
  requestContext: { http: { method: "GET", path: "/health" }, requestId: "test-req" },
  isBase64Encoded: false,
};

handler(event as any, {} as any)
  .then((res: any) => {
    console.log("RESULT:", res.statusCode, (res.body ?? "").slice(0, 100));
    process.exit(0);
  })
  .catch((err: any) => {
    console.error("ERR:", err);
    process.exit(1);
  });
