# Feature Specification: Authentication & RBAC (Slice 1)

**Feature Branch**: `002-auth-rbac`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Slice 1 — Authentication & RBAC. Human authentication via Better Auth, API tokens for programmatic access, and role-based access control with granular resource.action permissions + owner-only condition."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin user signs up and logs in (Priority: P1)

A developer or admin user creates an account, signs in, and accesses the admin SPA with a secure session cookie.

**Why this priority**: All admin functionality depends on authenticated sessions. This is the foundation for every other slice.

**Independent Test**: Sign up via `/api/auth/sign-up/email`, sign in via `/api/auth/sign-in/email`, then call `/api/auth/get-session` with the session cookie — session and user returned.

**Acceptance Scenarios**:

1. **Given** no account exists, **When** user POSTs to `/api/auth/sign-up/email` with email, password, name, **Then** a user is created and a session cookie is set.
2. **Given** a valid account, **When** user POSTs to `/api/auth/sign-in/email`, **Then** a new session is created and `better-auth.session_token` cookie is set with `HttpOnly; SameSite=Lax; Secure` (in prod).
3. **Given** an active session, **When** user calls `/api/auth/get-session` with the cookie, **Then** session and user data are returned (including `displayName`, `isActive`, `isSuperAdmin`).
4. **Given** an active session, **When** user POSTs to `/api/auth/sign-out`, **Then** the session is revoked (`revokedAt` set) and cookie is cleared.

---

### User Story 2 - RBAC permission evaluation (Priority: P2)

An admin creates roles, assigns granular `resource.action` permissions, assigns roles to users, and the system evaluates whether a user can perform an action on a resource (including owner-only condition).

**Why this priority**: Content management (Slice 2+) requires permission checks on every read/write. Without RBAC, no content operations can be authorized.

**Independent Test**: Create a role with `content-type.read` permission, assign to a user, verify the permission evaluator returns allow for that user on `content-type.read` and deny for `content-type.delete`.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they create a role with name and description, **Then** the role is persisted.
2. **Given** a role exists, **When** admin assigns a permission (`resource.action`) to it, **Then** the role-permission link is created.
3. **Given** a user has a role with `content-type.read`, **When** the permission evaluator checks `content-type.read` for that user, **Then** it returns allow.
4. **Given** a user does NOT have `content-type.delete`, **When** the evaluator checks it, **Then** it returns deny.
5. **Given** an owner-only permission, **When** a non-owner user attempts the action, **Then** deny; when the owner attempts it, **Then** allow.

---

### User Story 3 - API token for programmatic access (Priority: P3)

A developer creates an API token (prefixed, shown once), uses it as a Bearer token to access public/programmatic API endpoints, and can revoke it.

**Why this priority**: Public consumers (websites, mobile apps) need programmatic access independent of browser sessions.

**Independent Test**: Create an API token, use it as `Authorization: Bearer <token>` on a protected endpoint, verify access; revoke the token, verify subsequent requests are denied.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they create an API token with a name and scope, **Then** the token is returned once (plaintext) and stored hashed.
2. **Given** a valid API token, **When** a request includes `Authorization: Bearer <token>`, **Then** the request is authenticated as the token's owner with the token's permissions.
3. **Given** a revoked token, **When** a request uses it, **Then** 401 Unauthorized.
4. **Given** a public-scope token, **When** it accesses published content, **Then** only published content is returned (draft-leak fixture: 0 rows for draft-only content).

---

### Edge Cases

- What happens when a user's session expires? `/api/auth/get-session` returns null; subsequent requests are unauthenticated.
- What happens when an API token is used after the owning user is deactivated? Token is rejected (user `isActive = false`).
- What happens when a role is deleted that has users assigned? Users lose the role's permissions; role_permissions and user_roles rows are cascaded.
- How does the system handle brute-force login attempts? Rate limiter blocks after 5 attempts per IP per minute (lambda preset).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide sign-up, sign-in, sign-out via Better Auth mounted at `/api/auth/*` before `express.json()`.
- **FR-002**: System MUST set session cookie with `Domain=.parent; Secure; SameSite=Lax; HttpOnly` in production.
- **FR-003**: System MUST store passwords using Better Auth scrypt default (never plaintext/MD5/SHA1).
- **FR-004**: System MUST create Better Auth tables (`user`, `session`, `account`, `verification`) via CLI, committed verbatim, extended with `additionalFields`.
- **FR-005**: System MUST use UUID interop: `user.id` = uuid (generateId: false), session/account/verification.id = text, userId FKs = uuid.
- **FR-006**: System MUST provide RBAC tables: `roles`, `permissions` (resource.action), `role_permissions`, `user_roles`.
- **FR-007**: System MUST provide a permission evaluator that checks `resource.action` + owner-only condition.
- **FR-008**: System MUST provide API token creation (prefixed `pk_`/`sk_`, shown once, hashed at rest).
- **FR-009**: System MUST provide API token authentication middleware (Bearer token → user + permissions).
- **FR-010**: System MUST provide API token revocation.
- **FR-011**: System MUST provide session cookie auth middleware for admin routes.
- **FR-012**: System MUST apply rate limiting to auth routes (5/min/IP per lambda preset).
- **FR-013**: System MUST NOT install the Better Auth organization plugin in MVP.
- **FR-014**: System MUST enforce the draft-leak fixture: public token × draft-only content → 0 rows.

### Key Entities

- **User** (Better Auth `user` + Peggy fields): id (uuid), email, name, image, emailVerified, displayName, avatarAssetId, isActive, isSuperAdmin, timestamps.
- **Session** (Better Auth `session` + Peggy): id (text), userId (uuid FK), token, expiresAt, ipAddress, userAgent, revokedAt, timestamps.
- **Account** (Better Auth `account`): id (text), userId (uuid FK), providerId, accountId, password (hashed), tokens, timestamps.
- **Verification** (Better Auth `verification`): id (text), identifier, value, expiresAt, timestamps.
- **Role**: id (uuid), name, description, timestamps.
- **Permission**: id (uuid), resource, action, description (unique on resource.action).
- **RolePermission**: roleId (uuid FK), permissionId (uuid FK), composite PK.
- **UserRole**: userId (uuid FK), roleId (uuid FK), composite PK.
- **ApiToken**: id (uuid), userId (uuid FK), name, prefix, hashedToken, scopes (array), revokedAt, lastUsedAt, timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can sign up, sign in, and read session in under 3 seconds.
- **SC-002**: Permission evaluation returns result in under 10ms for cached permissions.
- **SC-003**: API token authentication adds under 50ms overhead per request.
- **SC-004**: Draft-leak fixture passes: 0 rows returned for public token on draft-only content.
- **SC-005**: All auth endpoints return correct HTTP status codes (200/401/403/429).
- **SC-006**: Rate limiter blocks after 5 failed login attempts per IP per minute.

## Assumptions

- Better Auth scrypt default is acceptable for MVP (ADR-008).
- Better Auth tables are generated by CLI and committed verbatim.
- API tokens are shown once at creation; only the hash is stored.
- RBAC is enforced at the service layer, not the database layer.
- Owner-only condition is evaluated by comparing `resource.createdBy` to the requesting user.
- The organization plugin is NOT installed (D2 single-project).
- Email verification and password reset use Better Auth's `verification` table with single-use expiring tokens.
