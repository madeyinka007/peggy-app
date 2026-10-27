import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth-uuid.js";

const app = express();
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
export { app };
