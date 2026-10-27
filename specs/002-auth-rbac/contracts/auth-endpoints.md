# Contract: Auth Endpoints (Better Auth)

All endpoints mounted at `/api/auth/*` via `toNodeHandler(auth)`, before `express.json()`.

## POST /api/auth/sign-up/email
**Body**: `{ email, password, name }`
**Response 200**: `{ token, user: { id, name, email, emailVerified, image, createdAt, updatedAt, displayName, isActive, isSuperAdmin } }`
**Sets cookie**: `better-auth.session_token` (HttpOnly, SameSite=Lax, Secure in prod)

## POST /api/auth/sign-in/email
**Body**: `{ email, password }`
**Response 200**: `{ token, user: {...} }`
**Sets cookie**: `better-auth.session_token`

## POST /api/auth/sign-out
**Headers**: Cookie: better-auth.session_token=...
**Response 200**: `{ success: true }`
**Clears cookie**

## GET /api/auth/get-session
**Headers**: Cookie: better-auth.session_token=...
**Response 200**: `{ session: {...}, user: {...} }` or `null` if no session

## POST /api/auth/forget-password
**Body**: `{ email, redirectTo }`
**Response 200**: `{ status: true }`

## POST /api/auth/reset-password
**Body**: `{ newPassword, token }`
**Response 200**: `{ status: true }`
