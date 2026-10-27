process.env.NODE_ENV = "test";
import "dotenv/config";
import { app } from "./server-uuid.js";

const BASE = "http://localhost:3097";
const server = app.listen(3097, async () => {
  try {
    // sign in
    const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3097" },
      body: JSON.stringify({ email: "uuid@example.com", password: "spikepassword123" }),
    });
    console.log("SIGNIN:", res.status);
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
    console.log("ALL SET-COOKIE HEADERS:");
    for (const c of cookies) console.log("  ", c);
    // read session twice with the session token cookie
    const tokenCookie = cookies.find((c) => c.startsWith("better-auth.session_token="))?.split(";")[0];
    if (tokenCookie) {
      const r1 = await fetch(`${BASE}/api/auth/get-session`, { headers: { Cookie: tokenCookie } });
      console.log("SESSION1:", r1.status);
      const r2 = await fetch(`${BASE}/api/auth/get-session`, { headers: { Cookie: tokenCookie } });
      console.log("SESSION2:", r2.status);
    }
  } catch (e) {
    console.error("ERR:", e);
  } finally {
    server.close();
    process.exit(0);
  }
});
