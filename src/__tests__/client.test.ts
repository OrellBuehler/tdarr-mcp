import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TdarrClient } from "../tdarr/client.js";
import { mockJson, mockText, mockError } from "./helpers.js";

describe("TdarrClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the api key as x-api-key and strips trailing slashes from the base url", async () => {
    const client = new TdarrClient("http://tdarr.local:8265//", "tapi_abc");
    mockFetch.mockResolvedValueOnce(mockJson({ status: "ok" }));
    await client.get("/api/v2/status");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://tdarr.local:8265/api/v2/status");
    expect(init.headers["x-api-key"]).toBe("tapi_abc");
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("omits the api key header when no key is configured", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await client.get("/api/v2/status");
    expect(mockFetch.mock.calls[0][1].headers["x-api-key"]).toBeUndefined();
  });

  it("refuses to follow redirects, so the api key never reaches another origin", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "tapi_abc");
    mockFetch.mockResolvedValue(mockJson({}));
    await client.get("/api/v2/status");
    await client.post("/api/v2/get-res-stats", { data: {} });
    await client.fetchText("/api/v2/get-server-log");
    expect(mockFetch.mock.calls.map((c) => c[1].redirect)).toEqual(["error", "error", "error"]);
  });

  it("keeps redirect: error even when a caller passes its own", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "tapi_abc");
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await client.fetch("/api/v2/status", { redirect: "follow" });
    expect(mockFetch.mock.calls[0][1].redirect).toBe("error");
  });

  it("sets a json content type for posts with a body", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "tapi_abc");
    mockFetch.mockResolvedValueOnce(mockJson({ ok: true }));
    await client.post("/api/v2/get-res-stats", { data: { a: 1 } });
    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ data: { a: 1 } });
  });

  it("returns text for non-json responses", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    mockFetch.mockResolvedValueOnce(mockText("line one\nline two"));
    expect(await client.get("/api/v2/get-server-log")).toBe("line one\nline two");
  });

  it("treats an empty body as success", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    mockFetch.mockResolvedValueOnce(mockText(""));
    expect(await client.post("/api/v2/sync-plugins")).toEqual({ success: true });
  });

  it("throws with the status and response body on a non-2xx", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    mockFetch.mockResolvedValueOnce(mockError(400, "bad library id"));
    await expect(client.get("/api/v2/status")).rejects.toThrow("400 Bad Request: bad library id");
  });

  it("wraps a timeout in a readable error", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "", 5);
    mockFetch.mockRejectedValueOnce(new DOMException("aborted", "TimeoutError"));
    await expect(client.get("/api/v2/status")).rejects.toThrow("Tdarr request timed out after 5ms");
  });

  it("cruddb posts a data envelope and omits absent optional fields", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await client.cruddb({ collection: "FlowsJSONDB", mode: "getAll" });
    expect(mockFetch.mock.calls[0][0]).toBe("http://tdarr.local:8265/api/v2/cruddb");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      data: { collection: "FlowsJSONDB", mode: "getAll" },
    });
  });

  it("cruddb passes docID through for getById", async () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    mockFetch.mockResolvedValueOnce(mockJson({ _id: "x" }));
    await client.cruddb({ collection: "FileJSONDB", mode: "getById", docID: "/media/a.mkv" });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).data).toEqual({
      collection: "FileJSONDB",
      mode: "getById",
      docID: "/media/a.mkv",
    });
  });
});
