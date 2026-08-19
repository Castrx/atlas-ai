import { describe, expect, it, vi } from "vitest";
import { securityHeaders } from "../../src/middleware/security-headers";

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    headers,
  };
}

describe("securityHeaders", () => {
  it("define os headers de segurança e chama next()", () => {
    const res = fakeRes();
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    securityHeaders({} as any, res as any, next);

    expect(res.headers).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'",
    });
    expect(next).toHaveBeenCalledWith();
  });
});
