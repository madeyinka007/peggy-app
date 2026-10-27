import { Router } from "express";

// Minimal OpenAPI 3.0 snapshot (FR-016). Lists all routes registered in apps/api.
const spec = {
  openapi: "3.0.3",
  info: { title: "Peggy CMS API", version: "0.2.0" },
  paths: {
    "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
    "/ready": { get: { summary: "Readiness check", responses: { "200": { description: "Ready" }, "503": { description: "Not ready" } } } },
    "/api/auth/*": { post: { summary: "Better Auth endpoints (sign-up, sign-in, sign-out, get-session)", responses: { "200": { description: "OK" } } } },
    "/api/v1/roles": { get: { summary: "List roles" }, post: { summary: "Create role" } },
    "/api/v1/roles/{id}": { get: { summary: "Get role" }, put: { summary: "Update role" }, delete: { summary: "Delete role" } },
    "/api/v1/permissions": { get: { summary: "List permissions" }, post: { summary: "Create permission" } },
    "/api/v1/roles/{roleId}/permissions": { post: { summary: "Assign permission to role" } },
    "/api/v1/roles/{roleId}/permissions/{permissionId}": { delete: { summary: "Remove permission from role" } },
    "/api/v1/users/{userId}/roles": { post: { summary: "Assign role to user" } },
    "/api/v1/users/{userId}/roles/{roleId}": { delete: { summary: "Remove role from user" } },
    "/api/v1/tokens": { get: { summary: "List tokens" }, post: { summary: "Create token" } },
    "/api/v1/tokens/{id}": { delete: { summary: "Revoke token" } },
    "/api/v1/content-types": { get: { summary: "List content types" }, post: { summary: "Create content type" } },
    "/api/v1/content-types/{id}": { get: { summary: "Get content type" }, put: { summary: "Update content type" }, delete: { summary: "Delete content type" } },
    "/api/v1/content-types/{id}/fields": { get: { summary: "List fields" }, post: { summary: "Create field" } },
    "/api/v1/content-types/{id}/fields/{fieldId}": { put: { summary: "Update field" }, delete: { summary: "Delete field" } },
    "/api/v1/content-types/{id}/versions": { get: { summary: "List schema versions" } },
    "/api/v1/components": { get: { summary: "List components" }, post: { summary: "Create component" } },
    "/api/v1/components/{id}": { get: { summary: "Get component" }, put: { summary: "Update component" }, delete: { summary: "Delete component" } },
    "/api/v1/components/{id}/fields": { get: { summary: "List component fields" }, post: { summary: "Create component field" } },
  },
};

export const openapiRouter = Router();
openapiRouter.get("/openapi.json", (_req, res) => {
  res.json(spec);
});
