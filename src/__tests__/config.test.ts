import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("normalizes TDARR_URL and carries the api key", async () => {
    vi.stubEnv("TDARR_URL", "https://tdarr.example.com:8265/");
    vi.stubEnv("TDARR_API_KEY", "tapi_abc");
    const { config, client } = await import("../config.js");
    expect(config.baseUrl).toBe("https://tdarr.example.com:8265");
    expect(config.apiKey).toBe("tapi_abc");
    expect(config.transport).toBe("stdio");
    expect(client.baseUrl).toBe("https://tdarr.example.com:8265");
  });

  it("accepts TDARR_SERVER and prepends http:// when the scheme is missing", async () => {
    vi.stubEnv("TDARR_URL", "");
    vi.stubEnv("TDARR_SERVER", "tdarr.local:8265");
    vi.stubEnv("TDARR_API_KEY", "");
    const { config } = await import("../config.js");
    expect(config.baseUrl).toBe("http://tdarr.local:8265");
  });

  it("allows an empty api key, since Tdarr auth is optional", async () => {
    vi.stubEnv("TDARR_URL", "http://tdarr.local:8265");
    vi.stubEnv("TDARR_API_KEY", "");
    const { config } = await import("../config.js");
    expect(config.apiKey).toBe("");
  });

  it("exits the process when the url is missing", async () => {
    vi.stubEnv("TDARR_URL", "");
    vi.stubEnv("TDARR_SERVER", "");
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(import("../config.js")).rejects.toThrow("exit:1");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
