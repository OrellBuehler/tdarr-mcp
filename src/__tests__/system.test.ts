import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerSystemTools } from "../tools/system.js";
import { collect, mockJson, mockText, bodyOf, urlOf, jsonOf } from "./helpers.js";

const { tools } = collect(registerSystemTools);

describe("system tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get_status GETs /api/v2/status", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ version: "2.45.01", uptime: 42 }));
    const res = await tools.get("get_status")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/status");
    expect(jsonOf(res)).toEqual({ version: "2.45.01", uptime: 42 });
  });

  it("get_server_log tails the log to the requested number of lines", async () => {
    const log = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");
    mockFetch.mockResolvedValueOnce(mockText(log));
    const res = await tools.get("get_server_log")!({ lines: 3 });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/get-server-log");
    expect(res.content[0].text).toBe("line 8\nline 9\nline 10");
  });

  it("get_server_log returns everything for lines 0", async () => {
    mockFetch.mockResolvedValueOnce(mockText("a\nb"));
    const res = await tools.get("get_server_log")!({ lines: 0 });
    expect(res.content[0].text).toBe("a\nb");
  });

  it("get_resource_stats POSTs to get-res-stats", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ os: { cpuPerc: "12" } }));
    await tools.get("get_resource_stats")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/get-res-stats");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
  });

  it("check_for_update defaults every updater flag to false", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ newVersionAvailable: false }));
    await tools.get("check_for_update")!({});
    expect(bodyOf(mockFetch)).toEqual({
      downloadUpdate: false,
      applyUpdate: false,
      resetUpdater: false,
    });
  });

  it("check_for_update forwards the flags it is given", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("check_for_update")!({ download_update: true, apply_update: true });
    expect(bodyOf(mockFetch)).toEqual({
      downloadUpdate: true,
      applyUpdate: true,
      resetUpdater: false,
    });
  });

  it("run_help_command wraps mode and text in a data envelope", async () => {
    mockFetch.mockResolvedValueOnce(mockText("V..... libx265"));
    await tools.get("run_help_command")!({ mode: "ffmpeg", text: "-encoders" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/run-help-command");
    expect(bodyOf(mockFetch)).toEqual({ data: { mode: "ffmpeg", text: "-encoders" } });
  });

  it("restart_ui uses GET, restart_server uses POST", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("restart_ui")!({});
    expect(mockFetch.mock.calls[0][1].method).toBeUndefined();
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("restart_server")!({});
    expect(mockFetch.mock.calls[1][1].method).toBe("POST");
  });

  it("returns an error envelope when the server rejects the request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: new Headers(),
      text: () => Promise.resolve("invalid api key"),
    });
    const res = await tools.get("get_status")!({});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("invalid api key");
  });
});
