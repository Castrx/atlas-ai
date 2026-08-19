import { describe, expect, it, vi } from "vitest";
import { createCors } from "../../src/middleware/cors";

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    status: vi.fn().mockReturnThis(),
    end: vi.fn(),
    headers,
  };
}

describe("createCors", () => {
  it("sem allowedOrigin configurada: nunca envia header de CORS", () => {
    const cors = createCors(undefined);
    const res = fakeRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cors({ method: "GET", headers: { origin: "http://evil.example" } } as any, res as any, next);

    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("com allowedOrigin configurada e origem correspondente: libera exatamente essa origem", () => {
    const cors = createCors("http://localhost:5173");
    const res = fakeRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cors({ method: "GET", headers: { origin: "http://localhost:5173" } } as any, res as any, next);

    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(res.headers["Vary"]).toBe("Origin");
    expect(next).toHaveBeenCalledWith();
  });

  it("com allowedOrigin configurada e origem diferente: não libera nada", () => {
    const cors = createCors("http://localhost:5173");
    const res = fakeRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cors({ method: "GET", headers: { origin: "http://evil.example" } } as any, res as any, next);

    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("requisição OPTIONS (preflight): responde 204 direto, sem chamar next()", () => {
    const cors = createCors("http://localhost:5173");
    const res = fakeRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cors({ method: "OPTIONS", headers: { origin: "http://localhost:5173" } } as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
