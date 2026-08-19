import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "../../src/middleware/rate-limit";
import { RateLimitError } from "../../src/errors/rate-limit-error";

function fakeReq(ip: string) {
  return { ip };
}

describe("createRateLimiter", () => {
  it("permite requisições até o limite e bloqueia a partir da (maxRequests + 1)-ésima, na mesma janela", () => {
    const rateLimit = createRateLimiter(60_000, 2);
    const req = fakeReq("1.2.3.4");
    const next1 = vi.fn();
    const next2 = vi.fn();
    const next3 = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimit(req as any, {} as any, next1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimit(req as any, {} as any, next2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimit(req as any, {} as any, next3);

    expect(next1).toHaveBeenCalledWith();
    expect(next2).toHaveBeenCalledWith();
    expect(next3).toHaveBeenCalledWith(expect.any(RateLimitError));
  });

  it("isola a contagem por IP: um IP bloqueado não afeta outro", () => {
    const rateLimit = createRateLimiter(60_000, 1);
    const nextA1 = vi.fn();
    const nextA2 = vi.fn();
    const nextB1 = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimit(fakeReq("1.1.1.1") as any, {} as any, nextA1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimit(fakeReq("1.1.1.1") as any, {} as any, nextA2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimit(fakeReq("2.2.2.2") as any, {} as any, nextB1);

    expect(nextA1).toHaveBeenCalledWith();
    expect(nextA2).toHaveBeenCalledWith(expect.any(RateLimitError));
    expect(nextB1).toHaveBeenCalledWith();
  });

  it("reseta a contagem depois que a janela expira", () => {
    vi.useFakeTimers();
    try {
      const rateLimit = createRateLimiter(1000, 1);
      const req = fakeReq("3.3.3.3");
      const next1 = vi.fn();
      const next2 = vi.fn();
      const next3 = vi.fn();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rateLimit(req as any, {} as any, next1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rateLimit(req as any, {} as any, next2);

      vi.advanceTimersByTime(1001);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rateLimit(req as any, {} as any, next3);

      expect(next1).toHaveBeenCalledWith();
      expect(next2).toHaveBeenCalledWith(expect.any(RateLimitError));
      expect(next3).toHaveBeenCalledWith();
    } finally {
      vi.useRealTimers();
    }
  });
});
