import "dotenv/config";
import { auth } from "./auth-uuid.js";

async function run() {
  const url = "http://localhost:3097/api/auth/get-session";
  const req = new Request(url, { method: "GET", headers: { origin: "http://localhost:3097" } });
  console.log("calling handler...");
  const res: any = await Promise.race([
    (auth as any).handler(req),
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 10000)),
  ]);
  console.log("RES:", res?.status, (await res?.text?.())?.slice(0, 80));
  process.exit(0);
}
run().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
