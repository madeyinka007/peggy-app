process.env.NODE_ENV = "test";
import "dotenv/config";
import { app } from "./server-uuid.js";

const BASE = "http://localhost:3098";

async function main() {
  const signupRes = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3098" },
    body: JSON.stringify({ email: "uuid@example.com", password: "spikepassword123", name: "UUID User" }),
  });
  console.log("SIGNUP status:", signupRes.status);
  const signupBody = await signupRes.text();
  console.log("SIGNUP body:", signupBody.slice(0, 300));
  const cookie = signupRes.headers.get("set-cookie");

  if (signupRes.status !== 200) {
    console.log("SIGNUP FAILED — aborting");
    process.exit(1);
  }

  const signinRes = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3098" },
    body: JSON.stringify({ email: "uuid@example.com", password: "spikepassword123" }),
  });
  console.log("SIGNIN status:", signinRes.status);
  const signinCookie = signinRes.headers.get("set-cookie");

  if (signinCookie) {
    const sessionRes = await fetch(`${BASE}/api/auth/get-session`, {
      headers: { Cookie: signinCookie.split(";")[0] },
    });
    console.log("SESSION status:", sessionRes.status);
    console.log("SESSION body:", (await sessionRes.text()).slice(0, 300));
  }

  const { pool } = await import("./db/index-uuid.js");
  const u = await pool.query('SELECT id, email FROM "user"');
  console.log("DB users:", u.rows);
  const s = await pool.query('SELECT id, "userId", token FROM session');
  console.log("DB sessions:", s.rows.map((x: any) => ({ id: x.id, userId: x.userId, token: x.token?.slice(0, 8) + "..." })));
  await pool.end();
  process.exit(0);
}

const server = app.listen(3098, async () => {
  console.log("server started");
  try { await main(); } catch (e) { console.error("ERROR:", e); process.exit(1); }
  server.close();
});
