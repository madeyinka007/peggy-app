import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";

const app = express();
// toNodeHandler MUST be before express.json() (spike §5)
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
export { app };

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`spike listening on ${port}`));
}
