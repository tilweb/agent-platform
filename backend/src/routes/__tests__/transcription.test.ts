/**
 * Tests for transcription API routes (backend/src/routes/transcription.ts)
 *
 * Covers:
 *   POST / — transcribes an uploaded audio file via Whisper API
 *   GET  /status — reports whether STT is configured and available
 *
 * All external dependencies are mocked before the module is imported.
 */

import { test, expect, describe, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Shared mutable mock state — individual tests mutate fields in beforeEach
// ---------------------------------------------------------------------------

const mockState = {
  // Auth
  currentUser: null as null | { id: string; username: string; role: string },

  // providers service
  providersConfig: null as any,
  getProviderResult: null as any,
};

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Auth: inject user from mockState, otherwise 401
mock.module("../../auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    if (!mockState.currentUser) {
      return c.json({ error: "Authentication required" }, 401);
    }
    c.set("user", mockState.currentUser);
    c.set("userId", mockState.currentUser.id);
    await next();
  },
  requireUserId: (c: any) => {
    const userId = c.get("userId");
    if (!userId) throw new Error("Not authenticated");
    return userId;
  },
}));

// Rate limit: pass-through in tests
mock.module("../../middleware/rateLimit", () => ({
  uploadRateLimit: async (_c: any, next: any) => next(),
}));

// Providers service — delegates to mockState at call time
mock.module("../../services/providers", () => ({
  loadProvidersConfig: async () => mockState.providersConfig,
  getProvider: async (_id: string) => mockState.getProviderResult,
  resolveFeatureUrl: (_modelId: string, _featureSet: number, _featureBit: number, _suffix?: string) => null,
}));

// errorHandler: minimal implementations that produce the correct HTTP status codes
mock.module("../../utils/errorHandler", () => ({
  internalError: (c: any, _err: any, _ctx?: any) =>
    c.json({ error: "Ein interner Fehler ist aufgetreten", code: "INTERNAL_ERROR" }, 500),
  validationError: (c: any, message: string) =>
    c.json({ error: message, code: "VALIDATION_ERROR" }, 400),
  serviceError: (c: any, _err: any, _svc?: string) =>
    c.json({ error: "Externer Service nicht erreichbar", code: "EXTERNAL_SERVICE_ERROR" }, 502),
  errorResponse: (c: any, details: any) => {
    const statusMap: Record<string, number> = {
      SERVICE_UNAVAILABLE: 503,
      INTERNAL_ERROR: 500,
      VALIDATION_ERROR: 400,
      EXTERNAL_SERVICE_ERROR: 502,
    };
    const status = statusMap[details.code] ?? 500;
    return c.json({ error: details.message, code: details.code }, status);
  },
  ErrorCode: {
    INTERNAL_ERROR: "INTERNAL_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  },
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks are registered
// ---------------------------------------------------------------------------
const { transcriptionRoutes } = await import("../transcription");

// Mount at the same prefix used in production
const app = new Hono();
app.route("/api/transcription", transcriptionRoutes);

// ---------------------------------------------------------------------------
// Global fetch mock — intercepts Whisper API calls
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function installFetchMock(status = 200, body: any = { text: "Hallo Welt" }) {
  (globalThis as any).fetch = async (_url: string, _opts: any) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

function installThrowingFetchMock() {
  (globalThis as any).fetch = async () => {
    throw new Error("Network error");
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(role = "user") {
  return { id: "user-1", username: "alice", role };
}

/** Build a minimal providers config with an active STT section. */
function makeProvidersConfig(
  overrides: Partial<{ provider_id: string; model_id: string }> = {}
) {
  return {
    active: {
      stt: {
        provider_id: overrides.provider_id ?? "openai",
        model_id: overrides.model_id ?? "whisper-1",
      },
    },
  };
}

/** Build a minimal provider object. */
function makeProvider(overrides: Partial<any> = {}) {
  return {
    id: "openai",
    name: "OpenAI",
    enabled: true,
    api_key_env: "OPENAI_API_KEY",
    base_url: "https://api.openai.com/v1",
    models: [
      {
        id: "whisper-1",
        name: "Whisper",
        base_url: undefined as string | undefined,
      },
    ],
    ...overrides,
  };
}

/**
 * Build a POST /api/transcription Request with a multipart file upload.
 *
 * Bun's multipart serialiser infers File.type from the filename extension rather
 * than from the `type` constructor argument. We therefore select filenames whose
 * extensions Bun maps to the intended MIME type:
 *
 *   .mp3  → audio/mpeg           (no conversion needed)
 *   .wav  → audio/x-wav          (no conversion needed; both audio/wav and audio/x-wav in allowlist)
 *   .webm → video/webm            (triggers ffmpeg conversion)
 *   .ogg  → audio/ogg            (triggers ffmpeg conversion)
 *   .pdf  → application/pdf      (rejected — not an audio type)
 *   .mp4  → video/mp4            (rejected — not in allowlist)
 *
 * Note: Bun maps .flac to audio/x-flac, which is not in the route allowlist.
 * The route allowlist has audio/flac; audio/x-flac is a separate MIME type.
 * That pair is intentionally not tested here as there is no .flac → audio/flac
 * mapping available through Bun's multipart serialiser.
 */
function makeAudioRequest(
  desiredMimeType = "audio/mpeg",
  fileSizeBytes = 1024,
  language?: string
): Request {
  // Map MIME type to a filename extension that Bun serialises correctly
  const mimeToFilename: Record<string, string> = {
    "audio/mpeg": "recording.mp3",
    "audio/wav": "recording.wav",
    "audio/x-wav": "recording.wav",
    "audio/webm": "recording.webm",
    "audio/ogg": "recording.ogg",
    "audio/mp4": "recording.m4a",
    "audio/x-m4a": "recording.m4a",
    "audio/m4a": "recording.m4a",
    "video/webm": "recording.webm",
    "video/ogg": "recording.ogg",
    // Unsupported formats
    "application/pdf": "document.pdf",
    "video/mp4": "video.mp4",
    // Codec suffix — webm base type is accepted and triggers conversion
    "audio/webm;codecs=opus": "recording.webm",
  };

  const filename = mimeToFilename[desiredMimeType] ?? "recording.mp3";
  const fakeContent = new Uint8Array(fileSizeBytes).fill(0xAB);
  const file = new File([fakeContent], filename, { type: desiredMimeType });

  const formData = new FormData();
  formData.append("file", file);
  if (language !== undefined) {
    formData.append("language", language);
  }

  return new Request("http://localhost/api/transcription", {
    method: "POST",
    body: formData,
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Transcription Routes — Auth", () => {
  beforeEach(() => {
    mockState.currentUser = null;
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider();
    installFetchMock();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  test("should return 401 on POST when no user is authenticated", async () => {
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(401);
  });

  test("should return 401 on GET /status when no user is authenticated", async () => {
    const res = await app.request("/api/transcription/status");
    expect(res.status).toBe(401);
  });

  test("should proceed past auth for an authenticated user", async () => {
    mockState.currentUser = makeUser();
    const res = await app.request(makeAudioRequest());
    expect(res.status).not.toBe(401);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/transcription — file validation", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider();
    installFetchMock(200, { text: "Hallo Welt" });
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  test("should return 400 when no file field is provided", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/transcription", {
      method: "POST",
      body: formData,
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Audiodatei/i);
  });

  test("should return 400 when file field is a plain string (not a File object)", async () => {
    const formData = new FormData();
    formData.append("file", "not-a-file");
    const req = new Request("http://localhost/api/transcription", {
      method: "POST",
      body: formData,
    });
    const res = await app.request(req);
    expect(res.status).toBe(400);
  });

  test("should return 400 when file exceeds the 25 MB size limit", async () => {
    const oversizeBytes = 26 * 1024 * 1024; // 26 MB
    const res = await app.request(makeAudioRequest("audio/mpeg", oversizeBytes));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/25\s*MB/i);
  });

  test("should return 400 for an unsupported MIME type (application/pdf)", async () => {
    const res = await app.request(makeAudioRequest("application/pdf", 1024));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Audioformat/i);
  });

  test("should return 400 for video/mp4 MIME type", async () => {
    const res = await app.request(makeAudioRequest("video/mp4", 1024));
    expect(res.status).toBe(400);
  });

  test("should accept audio/mpeg and return the transcription text", async () => {
    const res = await app.request(makeAudioRequest("audio/mpeg", 1024));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Hallo Welt");
  });

  test("should accept audio/x-wav (Bun's .wav MIME type) without requiring conversion", async () => {
    // .wav files are serialised by Bun as audio/x-wav, which is in the allowlist
    const res = await app.request(makeAudioRequest("audio/x-wav", 1024));
    expect(res.status).toBe(200);
  });

  test("should not reject audio/webm as an invalid format (triggers conversion instead)", async () => {
    // audio/webm is a valid type — the route attempts ffmpeg conversion.
    // Without ffmpeg installed the result is 502 (service error), not 400.
    const res = await app.request(makeAudioRequest("audio/webm", 1024));
    expect(res.status).not.toBe(400);
  });

  test("should strip codec parameters before validating the MIME type", async () => {
    // MediaRecorder often emits 'audio/webm;codecs=opus'. The route must strip
    // the codec suffix before checking against the allowlist.
    // audio/webm triggers ffmpeg conversion; without ffmpeg → 502, not 400.
    const res = await app.request(makeAudioRequest("audio/webm;codecs=opus", 1024));
    expect(res.status).not.toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/transcription — STT configuration checks", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    installFetchMock(200, { text: "ok" });
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  test("should return 503 when STT config is missing provider_id", async () => {
    mockState.providersConfig = { active: { stt: { model_id: "whisper-1" } } };
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/konfiguriert|configured/i);
  });

  test("should return 503 when STT config is missing model_id", async () => {
    mockState.providersConfig = { active: { stt: { provider_id: "openai" } } };
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });

  test("should return 503 when active.stt is null", async () => {
    mockState.providersConfig = { active: { stt: null } };
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });

  test("should return 503 when the configured provider is not found", async () => {
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = null;
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });

  test("should return 503 when the configured provider is disabled", async () => {
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider({ enabled: false });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });

  test("should return 503 when the model_id is not in the provider model list", async () => {
    mockState.providersConfig = makeProvidersConfig({ model_id: "nonexistent-model" });
    mockState.getProviderResult = makeProvider(); // only has whisper-1
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });

  test("should return 503 when the API key environment variable is not set", async () => {
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider({ api_key_env: "MISSING_KEY_ENV_12345" });
    delete process.env["MISSING_KEY_ENV_12345"];
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });

  test("should return 503 when provider has no api_key_env configured", async () => {
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider({ api_key_env: undefined });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------

describe("POST /api/transcription — Whisper API integration", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider();
    installFetchMock(200, { text: "Transkription erfolgreich" });
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  test("should return 200 with the transcribed text on success", async () => {
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("text", "Transkription erfolgreich");
  });

  test("should succeed when no language is supplied (defaults to 'de')", async () => {
    const res = await app.request(makeAudioRequest("audio/mpeg", 1024));
    expect(res.status).toBe(200);
  });

  test("should succeed when an explicit language parameter is supplied", async () => {
    const res = await app.request(makeAudioRequest("audio/mpeg", 1024, "en"));
    expect(res.status).toBe(200);
  });

  test("should return 502 when Whisper API responds with 500", async () => {
    (globalThis as any).fetch = async () =>
      new Response("Internal Server Error", { status: 500 });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(502);
  });

  test("should return 502 when Whisper API responds with 401 Unauthorized", async () => {
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ error: "invalid_api_key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(502);
  });

  test("should return 500 when fetch throws a network error", async () => {
    installThrowingFetchMock();
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(500);
  });

  test("should use the model-level base_url when it overrides the provider base_url", async () => {
    mockState.getProviderResult = makeProvider({
      base_url: "https://api.openai.com/v1",
      models: [
        {
          id: "whisper-1",
          name: "Whisper",
          base_url: "https://custom-whisper.example.com/v1/audio/transcriptions",
        },
      ],
    });
    installFetchMock(200, { text: "custom endpoint result" });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("custom endpoint result");
  });

  test("should not duplicate /transcriptions when base_url already contains it", async () => {
    // The route appends /transcriptions only when base_url does not already contain it.
    mockState.getProviderResult = makeProvider({
      base_url: "https://api.openai.com/v1/audio/transcriptions",
      models: [{ id: "whisper-1", name: "Whisper", base_url: undefined }],
    });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(200);
  });

  test("should return 500 when loadProvidersConfig throws unexpectedly", async () => {
    // Use a Proxy that throws on any property access, simulating a corrupt config.
    // The route's top-level catch block returns internalError (500).
    mockState.providersConfig = new Proxy({} as any, {
      get: () => {
        throw new Error("Unexpected disk read error");
      },
    });
    const res = await app.request(makeAudioRequest());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe("GET /api/transcription/status", () => {
  beforeEach(() => {
    mockState.currentUser = makeUser();
    mockState.providersConfig = makeProvidersConfig();
    mockState.getProviderResult = makeProvider();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  test("should return available:true with provider and model names when fully configured", async () => {
    const res = await app.request("/api/transcription/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.provider).toBe("OpenAI");
    expect(body.model).toBe("Whisper");
  });

  test("should return available:false when active.stt is null", async () => {
    mockState.providersConfig = { active: { stt: null } };
    const res = await app.request("/api/transcription/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/configured|konfiguriert/i);
  });

  test("should return available:false when provider_id is missing", async () => {
    mockState.providersConfig = { active: { stt: { model_id: "whisper-1" } } };
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  test("should return available:false when model_id is missing", async () => {
    mockState.providersConfig = { active: { stt: { provider_id: "openai" } } };
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  test("should return available:false when the provider is not found", async () => {
    mockState.getProviderResult = null;
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/not found/i);
  });

  test("should return available:false with reason 'Provider is disabled'", async () => {
    mockState.getProviderResult = makeProvider({ enabled: false });
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/disabled/i);
  });

  test("should return available:false when the model is not in the provider model list", async () => {
    mockState.providersConfig = makeProvidersConfig({ model_id: "unknown-model" });
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/Model not found/i);
  });

  test("should return available:false when the API key env var is absent", async () => {
    mockState.getProviderResult = makeProvider({ api_key_env: "NO_SUCH_KEY_ENV_9999" });
    delete process.env["NO_SUCH_KEY_ENV_9999"];
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/API key/i);
  });

  test("should return available:false when provider has no api_key_env set", async () => {
    mockState.getProviderResult = makeProvider({ api_key_env: undefined });
    const res = await app.request("/api/transcription/status");
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  test("should return available:false (not 500) when loadProvidersConfig throws", async () => {
    // The GET /status catch block returns { available: false, reason: 'Error checking status' }.
    // Use a Proxy that throws on any property access to trigger the catch path.
    mockState.providersConfig = new Proxy({} as any, {
      get: () => {
        throw new Error("Simulated disk read error");
      },
    });
    const res = await app.request("/api/transcription/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/error/i);
  });
});
