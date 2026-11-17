import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerFileTools } from "../tools/files.js";
import { collect, mockJson, mockText, bodyOf, urlOf, jsonOf } from "./helpers.js";

const { tools } = collect(registerFileTools);
const readOnly = collect(registerFileTools, false);

describe("file tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search_files defaults the size bounds and summarizes the matches", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([
        {
          _id: "/media/a.mkv",
          file: "/media/a.mkv",
          DB: "lib1",
          file_size: 8000,
          video_codec_name: "h264",
          ffProbeData: { streams: [{}] },
        },
      ]),
    );
    const res = await tools.get("search_files")!({ search: "a.mkv" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/search-db");
    expect(bodyOf(mockFetch)).toEqual({
      data: { string: "a.mkv", greaterThanGB: 0, lessThanGB: 10000 },
    });
    expect(jsonOf(res)).toEqual([
      {
        _id: "/media/a.mkv",
        file: "/media/a.mkv",
        library: "lib1",
        sizeMB: 8000,
        video: "h264",
      },
    ]);
  });

  it("search_files honours explicit size bounds and detailed", async () => {
    const raw = [{ _id: "/media/a.mkv", ffProbeData: { streams: [] } }];
    mockFetch.mockResolvedValueOnce(mockJson(raw));
    const res = await tools.get("search_files")!({
      search: "",
      greater_than_gb: 5,
      less_than_gb: 50,
      detailed: true,
    });
    expect(bodyOf(mockFetch).data).toEqual({ string: "", greaterThanGB: 5, lessThanGB: 50 });
    expect(jsonOf(res)).toEqual(raw);
  });

  it("get_file reads FileJSONDB by path", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ _id: "/media/a.mkv" }));
    await tools.get("get_file")!({ file_id: "/media/a.mkv" });
    expect(bodyOf(mockFetch).data).toEqual({
      collection: "FileJSONDB",
      mode: "getById",
      docID: "/media/a.mkv",
    });
  });

  it("query_table encodes the client type and fills in table defaults", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ array: [] }));
    await tools.get("query_table")!({ client_type: "status/table" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/client/status%2Ftable");
    expect(bodyOf(mockFetch)).toEqual({
      data: { start: 0, pageSize: 25, filters: [], sorts: [], opts: {} },
    });
  });

  it("query_table forwards paging, filters, sorts and opts", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ array: [] }));
    await tools.get("query_table")!({
      client_type: "status",
      start: 50,
      page_size: 10,
      filters: [{ id: "file", value: "Movie" }],
      sorts: [{ id: "file_size", desc: true }],
      opts: { table: "table1", dbID: "lib1" },
    });
    expect(bodyOf(mockFetch).data).toEqual({
      start: 50,
      pageSize: 10,
      filters: [{ id: "file", value: "Movie" }],
      sorts: [{ id: "file_size", desc: true }],
      opts: { table: "table1", dbID: "lib1" },
    });
  });

  it("rescan_file sends _id and DB", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("rescan_file")!({ file_id: "/media/a.mkv", library_id: "lib1" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/rescan-file");
    expect(bodyOf(mockFetch)).toEqual({ data: { _id: "/media/a.mkv", DB: "lib1" } });
  });

  it("scan_file_details defaults to exiftool and mediainfo only", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ _id: "/media/a.mkv" }));
    await tools.get("scan_file_details")!({ file_path: "/media/a.mkv" });
    expect(bodyOf(mockFetch)).toEqual({
      data: {
        scanTypes: { exifToolScan: true, mediaInfoScan: true, closedCaptionScan: false },
        file: { file: "/media/a.mkv" },
      },
    });
  });

  it("requeue_files maps its arguments onto set-all-status", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("requeue_files")!({
      library_id: "lib1",
      table: "table2",
      mode: "transcode",
      process_status: "Queued",
    });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/set-all-status");
    expect(bodyOf(mockFetch)).toEqual({
      data: { dbID: "lib1", mode: "transcode", table: "table2", processStatus: "Queued" },
    });
  });

  it("bulk_update_files sends fileIds and updatedObj", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("bulk_update_files")!({
      file_ids: ["/a.mkv", "/b.mkv"],
      updates: { holdUntil: 0 },
    });
    expect(bodyOf(mockFetch)).toEqual({
      data: { fileIds: ["/a.mkv", "/b.mkv"], updatedObj: { holdUntil: 0 } },
    });
  });

  it("delete_file wraps the id in a file object", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("delete_file")!({ file_id: "/media/a.mkv" });
    expect(bodyOf(mockFetch)).toEqual({ data: { file: { _id: "/media/a.mkv" } } });
  });

  it("bulk_delete_files and delete_unhealthy_files hit their endpoints", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("bulk_delete_files")!({ file_ids: ["/a.mkv"] });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/bulk-delete-files");
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("delete_unhealthy_files")!({ table: "table6" });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/delete-unhealthy-files");
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { table: "table6" } });
  });

  it("set_staged_verdict passes the staged item through as obj", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("set_staged_verdict")!({
      item: { _id: "/media/a.mkv" },
      verdict: "Accept",
    });
    expect(bodyOf(mockFetch)).toEqual({
      data: { obj: { _id: "/media/a.mkv" }, verdict: "Accept" },
    });
  });

  it("find_duplicates omits the optional detection fields when unset", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("find_duplicates")!({ threshold: 0.9, count: 2 });
    expect(bodyOf(mockFetch)).toEqual({ data: { threshold: 0.9, count: 2 } });
  });

  it("find_duplicates forwards the sha256 options", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("find_duplicates")!({
      threshold: 0.9,
      count: 2,
      detection_method: "sha256",
      hash_amount: "100MB",
    });
    expect(bodyOf(mockFetch).data).toEqual({
      threshold: 0.9,
      count: 2,
      detectionMethod: "sha256",
      sha256HashAmount: "100MB",
    });
  });

  it("stop_find_duplicates uses GET", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("stop_find_duplicates")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/stop-dedupe");
    expect(mockFetch.mock.calls[0][1].method).toBeUndefined();
  });

  it("query_table rejects the write-capable opts by default without sending a request", async () => {
    for (const opts of [
      { table: "table1", setAll: true, updatedObj: { TranscodeDecisionMaker: "Queued" } },
      { updatedObj: {} },
      { applyToAllStaged: true, verdict: "accept" },
      { verdict: "reject" },
      { somethingNew: 1 },
    ]) {
      const res = await readOnly.tools.get("query_table")!({ client_type: "files", opts });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("TDARR_ALLOW_DESTRUCTIVE");
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("query_table still reads with the read-only opts by default", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ array: [] }));
    const opts = { table: "table1", dbID: "lib1", property: "x", fileMedium: "video", csv: false };
    const res = await readOnly.tools.get("query_table")!({ client_type: "files", opts });
    expect(res.isError).toBeUndefined();
    expect(bodyOf(mockFetch).data.opts).toEqual(opts);
  });

  it("query_table describes itself as read-only by default and as writing when enabled", () => {
    expect(readOnly.descriptions.get("query_table")).toContain("Read-only");
    expect(readOnly.annotations.get("query_table")).toEqual({ readOnlyHint: true });
    const enabled = collect(registerFileTools, true);
    expect(enabled.descriptions.get("query_table")).toContain("WRITES");
    expect(enabled.annotations.get("query_table")!.destructiveHint).toBe(true);
  });

  it("query_table passes the write-capable opts through when destructive tools are enabled", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    const opts = { table: "table1", setAll: true, updatedObj: { holdUntil: 0 } };
    await tools.get("query_table")!({ client_type: "files", opts });
    expect(bodyOf(mockFetch).data.opts).toEqual(opts);
  });
});
