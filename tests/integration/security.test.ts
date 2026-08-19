import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { ToolRegistry } from "../../src/tools/tool-registry";

describe("Headers de segurança (ver ADR-025 no PROJECT_SPEC.md)", () => {
  it("GET /health: responde com os headers de segurança e sem X-Powered-By", async () => {
    const app = createApp();

    const response = await request(app).get("/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("POST /api/chat sem CORS_ALLOWED_ORIGIN configurada: nunca envia Access-Control-Allow-Origin", async () => {
    const app = createApp({
      llmProvider: { converse: async () => ({ type: "final", response: { answer: "ok", intent: "general", confidence: 1 } }) },
      toolRegistry: new ToolRegistry([]),
    });

    const response = await request(app)
      .post("/api/chat")
      .set("Origin", "http://qualquer-origem.example")
      .send({ message: "Olá" });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
