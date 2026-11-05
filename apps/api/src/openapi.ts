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
    "/api/v1/documents": { get: { summary: "List documents" }, post: { summary: "Create document" } },
    "/api/v1/documents/{id}": { get: { summary: "Get document" }, put: { summary: "Update document" }, delete: { summary: "Delete document" } },
    "/api/v1/documents/{id}/versions": { get: { summary: "List versions" } },
    "/api/v1/documents/{id}/restore": { post: { summary: "Restore version" } },
    "/api/v1/documents/{id}/publish": { post: { summary: "Publish document" } },
    "/api/v1/documents/{id}/unpublish": { post: { summary: "Unpublish document" } },
    "/api/v1/public/{collectionSlug}": { get: { summary: "Public query" } },
    "/api/v1/public/{collectionSlug}/{slug}": { get: { summary: "Public get by slug" } },
    "/api/v1/locales": { get: { summary: "List locales" }, post: { summary: "Create locale" } },
    "/api/v1/media": {
      get: {
        summary: "List media (open read)",
        parameters: [
          { name: "folderId", in: "query", required: false, schema: { type: "string" } },
          { name: "mime", in: "query", required: false, schema: { type: "string" } },
          { name: "q", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", required: false, schema: { type: "integer", default: 25 } },
        ],
        responses: { "200": { description: "Paginated asset list; soft-deleted excluded" } },
      },
      post: {
        summary: "Confirm upload (media.upload)",
        responses: {
          "201": { description: "Created media_assets row (provider HEAD-verified)" },
          "413": { description: "PAYLOAD_TOO_LARGE — use the signed flow" },
          "422": { description: "MIME_NOT_ALLOWED / FILE_TOO_LARGE / PROVIDER_KEY_NOT_FOUND" },
        },
      },
    },
    "/api/v1/media/sign": {
      post: {
        summary: "Sign upload (media.upload)",
        responses: {
          "200": { description: "Signed Cloudinary params; browser PUTs bytes direct" },
          "422": { description: "MIME_NOT_ALLOWED / FILE_TOO_LARGE { limit, received }" },
        },
      },
    },
    "/api/v1/media/{id}": {
      get: {
        summary: "Get media (open read)",
        responses: {
          "200": { description: "Asset row + transformUrls { thumb, card, hero, original }" },
          "404": { description: "Missing or soft-deleted" },
        },
      },
      patch: {
        summary: "Update media (media.manage)",
        responses: {
          "200": { description: "Updated row" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        summary: "Delete media (media.manage)",
        parameters: [{ name: "force", in: "query", required: false, schema: { type: "boolean" } }],
        responses: {
          "204": { description: "Soft-deleted; provider destroy queued" },
          "404": { description: "Not found" },
          "409": { description: "MEDIA_REFERENCED { references[] } without ?force=true" },
        },
      },
    },
    "/api/v1/media/{id}/replace": {
      post: {
        summary: "Replace media (media.manage)",
        responses: {
          "201": { description: "New asset row; update-references moves ledger rows and retires the old row" },
          "404": { description: "Old asset not found" },
          "409": { description: "Duplicate providerKey" },
          "422": { description: "UNKNOWN_POLICY / MIME_NOT_ALLOWED / FILE_TOO_LARGE / PROVIDER_KEY_NOT_FOUND" },
        },
      },
    },
    "/api/v1/media-folders": {
      get: {
        summary: "List folders (open read)",
        parameters: [{ name: "parentId", in: "query", required: false, schema: { type: "string" } }],
        responses: { "200": { description: "Folder list" } },
      },
      post: {
        summary: "Create folder (media.manage)",
        responses: {
          "201": { description: "Folder with materialized path" },
          "422": { description: "FOLDER_CYCLE / FOLDER_DEPTH_EXCEEDED" },
        },
      },
    },
    "/api/v1/media-folders/{id}": {
      patch: {
        summary: "Update folder (media.manage)",
        responses: {
          "200": { description: "Renamed/moved folder" },
          "404": { description: "Not found" },
          "422": { description: "FOLDER_CYCLE / FOLDER_DEPTH_EXCEEDED" },
        },
      },
      delete: {
        summary: "Delete folder (media.manage)",
        parameters: [{ name: "recursive", in: "query", required: false, schema: { type: "boolean" } }],
        responses: {
          "204": { description: "Deleted" },
          "404": { description: "Not found" },
          "409": { description: "FOLDER_NOT_EMPTY without ?recursive=true" },
        },
      },
    },
  },
};

export const openapiRouter = Router();
openapiRouter.get("/openapi.json", (_req, res) => {
  res.json(spec);
});
