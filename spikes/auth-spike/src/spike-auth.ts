process.env.NODE_ENV = "test";
import "dotenv/config";
import { app } from "./server.js";

const BASE = "http://localhost:3099";

async function main() {
  // 1. Sign up
  const signupRes = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "spike@example.com", password: "spikepassword123", name: "Spike User" }),
  });
  console.log("SIGNUP status:", signupRes.status);
  const signupBody = await signupRes.text();
  console.log("SIGNUP body:", signupBody.slice(0, 300));
  const setCookie = signupRes.headers.get("set-cookie");
  console.log("SIGNUP set-cookie:", setCookie?.slice(0, 120));

  // 2. Sign in (fresh session)
  const signinRes = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "spike@example.com", password: "spikepassword123" }),
  });
  console.log("SIGNIN status:", signinRes.status);
  const signinBody = await signinRes.text();
  console.log("SIGNIN body:", signinBody.slice(0, 300));
  const cookie = signinRes.headers.get("set-cookie");
  console.log("SIGNIN set-cookie:", cookie?.slice(0, 120));

  // 3. Read session using cookie
  if (cookie) {
    const sessionRes = await fetch(`${BASE}/api/auth/get-session`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    console.log("SESSION status:", sessionRes.status);
    const sessionBody = await sessionRes.text();
    console.log("SESSION body:", sessionBody.slice(0, 400));
  }

  // 4. Inspect DB rows
  const { pool } = await import("./db/index.js");
  const r = await pool.query("SELECT id, email, name FROM \"user\"");
  console.log("DB users:", r.rows);
  const s = await pool.query("SELECT id, \"userId\", token, \"expiresAt\" FROM session");
  console.log("DB sessions:", s.rows.map((x: any) => ({ id: x.id, userId: x.userId, token: x.token?.slice(0, 8) + "..." })));
  await pool.end();
  process.exit(0);
}

// start server first
const { app } = await import("./server.js");
const server = app.listen(3099, async () => {
  console.log("server started");
  try { await main(); } catch (e) { console.error("ERROR:", e); process.exit(1); }
  server.close();
});
