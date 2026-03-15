import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a scoped logger with all methods", () => {
    const log = logger("test/scope");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("info logs with scope prefix", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = logger("learn/search");
    log.info("cache hit");
    expect(spy).toHaveBeenCalledWith("[learn/search]", "cache hit");
  });

  it("info logs with context as JSON", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = logger("learn/search");
    log.info("found results", { count: 5, query: "cursor" });
    expect(spy).toHaveBeenCalledWith(
      "[learn/search]",
      "found results",
      expect.stringContaining('"count":5')
    );
  });

  it("warn logs to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = logger("api/health");
    log.warn("slow query", { durationMs: 1200 });
    expect(spy).toHaveBeenCalledWith(
      "[api/health]",
      "slow query",
      expect.stringContaining('"durationMs":1200')
    );
  });

  it("error extracts Error properties", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = logger("breaks/discovery");
    const err = new Error("connection timeout");
    log.error("fetch failed", err);
    expect(spy).toHaveBeenCalledWith(
      "[breaks/discovery]",
      "fetch failed",
      expect.stringContaining('"error_message":"connection timeout"')
    );
  });

  it("error handles string errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = logger("test");
    log.error("oops", "something broke");
    expect(spy).toHaveBeenCalledWith(
      "[test]",
      "oops",
      expect.stringContaining('"error_message":"something broke"')
    );
  });

  it("error merges error info with context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = logger("test");
    log.error("failed", new Error("timeout"), { query: "cursor" });
    const output = spy.mock.calls[0][2] as string;
    expect(output).toContain('"error_message":"timeout"');
    expect(output).toContain('"query":"cursor"');
  });

  it("error handles no error argument", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = logger("test");
    log.error("something happened");
    expect(spy).toHaveBeenCalledWith("[test]", "something happened");
  });

  it("error handles Supabase-style errors with code property", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = logger("test");
    const err = Object.assign(new Error("not found"), { code: "PGRST116" });
    log.error("query failed", err);
    const output = spy.mock.calls[0][2] as string;
    expect(output).toContain('"error_code":"PGRST116"');
  });
});
