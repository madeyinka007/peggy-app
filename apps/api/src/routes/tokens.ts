import { Router } from "express";
import { createToken, listTokens, revokeToken } from "@peggy/auth";
import { authenticate, requireAuth } from "@peggy/auth";

export const tokensRouter = Router();

tokensRouter.post("/tokens", async (req, res) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  const token = await createToken(ctx.user!.id, req.body.name, req.body.scopes ?? [], req.body.prefix ?? "pk_");
  res.status(201).json(token);
});

tokensRouter.get("/tokens", async (req, res) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  const tokens = await listTokens(ctx.user!.id);
  res.json({ data: tokens });
});

tokensRouter.delete("/tokens/:id", async (req, res) => {
  const ctx = await authenticate(req as unknown as { headers?: { authorization?: string; cookie?: string } });
  if (!requireAuth(ctx)) return res.status(401).json({ error: "Unauthorized" });
  const row = await revokeToken(req.params.id, ctx.user!.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});
