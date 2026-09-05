import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerReportTools } from "../tools/reports.js";
import { registerBackupTools } from "../tools/backups.js";
import { registerAutomationTools } from "../tools/automations.js";
import { registerStatsTools } from "../tools/stats.js";
import { registerDbTools } from "../tools/db.js";
import { collect, mockJson, mockText, bodyOf, urlOf } from "./helpers.js";

const { tools: reports } = collect(registerReportTools);
const { tools: backups } = collect(registerBackupTools);
const { tools: automations } = collect(registerAutomationTools);
const { tools: stats } = collect(registerStatsTools);
const { tools: db } = collect(registerDbTools);

describe("report, backup, automation, stats and db tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get_job_report encodes the job id into the path", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ jobId: "a b", text: "log" }));
    await reports.get("get_job_report")!({ job_id: "a b" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/job-reports/a%20b");
  });

  it("search_job_reports sends searchTerms", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ jobReports: [] }));
    await reports.get("search_job_reports")!({ search: "failed" });
    expect(bodyOf(mockFetch)).toEqual({ data: { searchTerms: "failed" } });
  });

  it("list_file_job_reports and read_job_report_file use the footprint id", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await reports.get("list_file_job_reports")!({ footprint_id: "fp1" });
    expect(bodyOf(mockFetch)).toEqual({ data: { footprintId: "fp1" } });
    mockFetch.mockResolvedValueOnce(mockJson({ text: "" }));
    await reports.get("read_job_report_file")!({
      footprint_id: "fp1",
      job_id: "j1",
      job_file_id: "jf1",
    });
    expect(bodyOf(mockFetch, 1)).toEqual({
      data: { footprintId: "fp1", jobId: "j1", jobFileId: "jf1" },
    });
  });

  it("delete_job_reports defaults to an empty filter list", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ success: true }));
    await reports.get("delete_job_reports")!({});
    expect(bodyOf(mockFetch)).toEqual({ data: { filters: [] } });
  });

  it("backup tools post to their endpoints", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await backups.get("list_backups")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/get-backups");
    mockFetch.mockResolvedValueOnce(mockJson(true));
    await backups.get("create_backup")!({});
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/create-backup");
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await backups.get("delete_backup")!({ name: "backup-1.zip" });
    expect(bodyOf(mockFetch, 2)).toEqual({ data: { name: "backup-1.zip" } });
  });

  it("run_automation sends only the fields that were provided", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ success: true }));
    await automations.get("run_automation")!({ config_id: "a1" });
    expect(bodyOf(mockFetch)).toEqual({ data: { configId: "a1" } });
  });

  it("run_automation maps its optional arguments to the api names", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ success: true }));
    await automations.get("run_automation")!({
      config_id: "a1",
      payload: { x: 1 },
      library_ids: ["lib1"],
      target_node_ids: ["n1"],
      execute_immediately: true,
      bypass_worker_limits: false,
    });
    expect(bodyOf(mockFetch).data).toEqual({
      configId: "a1",
      payload: { x: 1 },
      libraryIds: ["lib1"],
      targetNodeIds: ["n1"],
      executeImmediately: true,
      bypassWorkerLimits: false,
    });
  });

  it("list_automations reads AutomationsJSONDB", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await automations.get("list_automations")!({});
    expect(bodyOf(mockFetch)).toEqual({
      data: { collection: "AutomationsJSONDB", mode: "getAll" },
    });
  });

  it("stats tools scope by library and timeframe", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ pieStats: {} }));
    await stats.get("get_pie_stats")!({ library_id: "lib1" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/stats/get-pies");
    expect(bodyOf(mockFetch)).toEqual({ data: { libraryId: "lib1" } });
    mockFetch.mockResolvedValueOnce(mockJson({ buckets: [] }));
    await stats.get("get_space_saved")!({ timeframe: "Last30Days", node_id: "n1" });
    expect(bodyOf(mockFetch, 1).data).toEqual({ timeframe: "Last30Days", nodeId: "n1" });
  });

  it("query_database refuses getById without a doc id", async () => {
    const res = await db.get("query_database")!({
      collection: "FileJSONDB",
      mode: "getById",
    });
    expect(res.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("query_database passes read modes through to cruddb", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await db.get("query_database")!({ collection: "SettingsGlobalJSONDB", mode: "getAll" });
    expect(bodyOf(mockFetch)).toEqual({
      data: { collection: "SettingsGlobalJSONDB", mode: "getAll" },
    });
  });
});
