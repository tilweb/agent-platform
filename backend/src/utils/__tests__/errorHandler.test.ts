/**
 * Tests for the error handler utility (backend/src/utils/errorHandler.ts)
 *
 * Verifies that each convenience function returns the correct HTTP status,
 * that the response body never leaks stack traces, and that
 * withErrorHandling wraps async handlers safely.
 */

import { test, expect, describe } from "bun:test";
import { Hono } from "hono";
import {
  internalError,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  serviceError,
  errorResponse,
  ErrorCode,
  withErrorHandling,
} from "../errorHandler";

// ---------------------------------------------------------------------------
// Test app — one route per error function
// ---------------------------------------------------------------------------

const app = new Hono();

app.get("/internal", (c) => internalError(c, new Error("db crash"), { query: "SELECT *" }));
app.get("/validation", (c) => validationError(c, "Name ist erforderlich"));
app.get("/not-found", (c) => notFoundError(c));
app.get("/not-found-resource", (c) => notFoundError(c, "Benutzer"));
app.get("/unauthorized", (c) => unauthorizedError(c));
app.get("/forbidden", (c) => forbiddenError(c, "Nur Administratoren erlaubt"));
app.get("/forbidden-default", (c) => forbiddenError(c));
app.get("/service", (c) => serviceError(c, new Error("timeout"), "OpenAI"));
app.get("/request-id", (c) =>
  errorResponse(c, { code: ErrorCode.NOT_FOUND, requestId: "fixed-id-123" })
);
app.get("/wrapped-ok", withErrorHandling(async (c) => c.json({ ok: true })));
app.get("/wrapped-throw", withErrorHandling(async (_c) => { throw new Error("handler exploded"); }));

// ---------------------------------------------------------------------------
// internalError
// ---------------------------------------------------------------------------

describe("internalError", () => {
  test("gibt HTTP 500 zurück", async () => {
    const res = await app.request("/internal");
    expect(res.status).toBe(500);
  });

  test("enthält keine Stack-Trace-Details in der Antwort", async () => {
    const res = await app.request("/internal");
    const body = await res.json() as Record<string, unknown>;
    const text = JSON.stringify(body);
    expect(text).not.toContain("db crash");
    expect(text).not.toContain("stack");
    expect(body.error).toBe("Ein interner Fehler ist aufgetreten");
  });

  test("setzt ErrorCode.INTERNAL_ERROR in der Antwort", async () => {
    const res = await app.request("/internal");
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

// ---------------------------------------------------------------------------
// validationError
// ---------------------------------------------------------------------------

describe("validationError", () => {
  test("gibt HTTP 400 zurück", async () => {
    const res = await app.request("/validation");
    expect(res.status).toBe(400);
  });

  test("enthält die benutzerdefinierte Fehlermeldung", async () => {
    const res = await app.request("/validation");
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Name ist erforderlich");
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});

// ---------------------------------------------------------------------------
// notFoundError
// ---------------------------------------------------------------------------

describe("notFoundError", () => {
  test("gibt HTTP 404 ohne Ressourcenname zurück", async () => {
    const res = await app.request("/not-found");
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Ressource nicht gefunden");
  });

  test("gibt HTTP 404 mit Ressourcenname zurück", async () => {
    const res = await app.request("/not-found-resource");
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Benutzer nicht gefunden");
  });
});

// ---------------------------------------------------------------------------
// unauthorizedError
// ---------------------------------------------------------------------------

describe("unauthorizedError", () => {
  test("gibt HTTP 401 mit Standard-Fehlermeldung zurück", async () => {
    const res = await app.request("/unauthorized");
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(body.error).toBe("Authentifizierung erforderlich");
  });
});

// ---------------------------------------------------------------------------
// forbiddenError
// ---------------------------------------------------------------------------

describe("forbiddenError", () => {
  test("gibt HTTP 403 mit benutzerdefinierter Meldung zurück", async () => {
    const res = await app.request("/forbidden");
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Nur Administratoren erlaubt");
  });

  test("gibt HTTP 403 mit Standard-Fehlermeldung zurück wenn keine Meldung übergeben", async () => {
    const res = await app.request("/forbidden-default");
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Zugriff verweigert");
  });
});

// ---------------------------------------------------------------------------
// serviceError
// ---------------------------------------------------------------------------

describe("serviceError", () => {
  test("gibt HTTP 502 mit Service-Namen zurück", async () => {
    const res = await app.request("/service");
    expect(res.status).toBe(502);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("OpenAI ist nicht erreichbar");
    expect(body.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
  });
});

// ---------------------------------------------------------------------------
// errorResponse — requestId und code
// ---------------------------------------------------------------------------

describe("errorResponse", () => {
  test("übernimmt eine vorgegebene requestId unverändert", async () => {
    const res = await app.request("/request-id");
    const body = await res.json() as Record<string, unknown>;
    expect(body.requestId).toBe("fixed-id-123");
  });

  test("enthält immer eine requestId in der Antwort", async () => {
    const res = await app.request("/internal");
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.requestId).toBe("string");
    expect((body.requestId as string).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// withErrorHandling
// ---------------------------------------------------------------------------

describe("withErrorHandling", () => {
  test("gibt die erfolgreiche Handler-Antwort unverändert zurück", async () => {
    const res = await app.request("/wrapped-ok");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  test("fängt geworfene Fehler ab und gibt HTTP 500 zurück", async () => {
    const res = await app.request("/wrapped-throw");
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.error).toBe("Ein interner Fehler ist aufgetreten");
  });
});
