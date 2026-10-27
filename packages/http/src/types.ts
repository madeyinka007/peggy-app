// Minimal structural type for a Better Auth instance (avoids hard dep on better-auth in http package)
export interface AuthInstance {
  handler: (req: Request) => Promise<Response>;
  [key: string]: unknown;
}
