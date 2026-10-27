export class PeggyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "PeggyError";
  }
}

export class NotFoundError extends PeggyError {
  constructor(message = "Not found") { super("NOT_FOUND", message, 404); }
}
export class ForbiddenError extends PeggyError {
  constructor(message = "Forbidden") { super("FORBIDDEN", message, 403); }
}
export class UnauthorizedError extends PeggyError {
  constructor(message = "Unauthorized") { super("UNAUTHORIZED", message, 401); }
}
export class ValidationError extends PeggyError {
  constructor(message = "Validation failed", public readonly details?: unknown) {
    super("VALIDATION_ERROR", message, 400);
  }
}
export class ConflictError extends PeggyError {
  constructor(message = "Conflict") { super("CONFLICT", message, 409); }
}
