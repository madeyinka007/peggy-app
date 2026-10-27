process.env.NODE_ENV = "test";
import "dotenv/config";
import { app } from "./server-uuid.js";
import autocannon from "autocannon";

const server = app.listen(3097, async () => {
  // get a session cookie first
  const res = await fetch("http://localhost:3097/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3097" },
    body: JSON.stringify({ email: "uuid@example.com", password: "spikepassword123" }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  console.log("got cookie, starting load test...");

  const result = await autocannon({
    url: "http://localhost:3097/api/auth/get-session",
    headers: { Cookie: cookie },
    connections: 50,
    duration: 10,
    pipelining: 1,
  });
  console.log("\n=== LOAD TEST RESULTS ===");
  console.log("Requests/sec:", result.requests.average);
  console.log("Latency p50:", result.latency.p50, "ms");
  console.log("Latency p99:", result.latency.p99, "ms");
  console.log("Errors:", result.errors);
  console.log("Timeouts:", result.timeouts);
  console.log("2xx:", result["2xx"]);
  server.close();
  process.exit(0);
});
