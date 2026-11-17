import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err, summarizeFile, summarizeList } from "../tdarr/format.js";
import { DESTRUCTIVE, IDEMPOTENT, READ, WRITE } from "./shared.js";
import type { TdarrClient } from "../tdarr/client.js";

const FILES = "FileJSONDB";
const READ_OPTS = ["table", "property", "fileMedium", "detail", "dbID", "csv"] as const;

export function registerFileTools(
  server: McpServer,
  client: TdarrClient,
  allowDestructive = false,
) {
  server.tool(
    "search_files",
    "Search the Tdarr file database by filename substring and file size (POST /api/v2/search-db). Returns one summarized record per match: path, library, container, size, codecs, and transcode/health status.",
    {
      search: z.string().describe("Substring to match against the file path (empty for no filter)"),
      greater_than_gb: z.number().optional().describe("Only files larger than this (default 0)"),
      less_than_gb: z.number().optional().describe("Only files smaller than this (default 10000)"),
      detailed: z
        .boolean()
        .optional()
        .describe("Return the full records, including ffProbe and MediaInfo data"),
    },
    READ,
    async ({ search, greater_than_gb, less_than_gb, detailed }) => {
      try {
        const res = await client.post("/api/v2/search-db", {
          data: {
            string: search,
            greaterThanGB: greater_than_gb ?? 0,
            lessThanGB: less_than_gb ?? 10000,
          },
        });
        return ok(summarizeList(res, summarizeFile, detailed));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_file",
    "Get one file's full database record — ffProbe output, MediaInfo, transcode and health check history, and the current queue status.",
    {
      file_id: z
        .string()
        .describe("File ID, which is the file's full path as Tdarr Server sees it"),
    },
    READ,
    async ({ file_id }) => {
      try {
        return ok(await client.cruddb({ collection: FILES, mode: "getById", docID: file_id }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "query_table",
    allowDestructive
      ? "Query or bulk-update one of the paginated tables behind the Tdarr UI (POST /api/v2/client/{client_type}) with server-side filtering, sorting and paging. The valid client_type and opts.table values are the ones the Tdarr UI uses for that page. This endpoint also WRITES: opts.setAll with opts.updatedObj rewrites every matching file record, and opts.applyToAllStaged with opts.verdict resolves every staged item — confirm with the user before sending any of those. Prefer search_files for plain file lookups."
      : `Read one of the paginated tables behind the Tdarr UI (POST /api/v2/client/{client_type}) with server-side filtering, sorting and paging. Read-only: opts only accepts ${READ_OPTS.join(", ")}; the bulk-write options of this endpoint (setAll, updatedObj, applyToAllStaged, verdict) are rejected unless the server is started with TDARR_ALLOW_DESTRUCTIVE=true. The valid client_type and opts.table values are the ones the Tdarr UI uses for that page. Prefer search_files for plain file lookups.`,
    {
      client_type: z
        .string()
        .describe("The client endpoint segment, i.e. the UI table being queried"),
      start: z.number().int().min(0).optional().describe("Row offset (default 0)"),
      page_size: z.number().int().min(1).optional().describe("Rows per page (default 25)"),
      filters: z
        .array(z.object({ id: z.string(), value: z.string() }))
        .optional()
        .describe("Column filters, e.g. [{ id: 'file', value: 'Movie' }]"),
      sorts: z
        .array(z.object({ id: z.string(), desc: z.boolean() }))
        .optional()
        .describe("Sort order, e.g. [{ id: 'file_size', desc: true }]"),
      opts: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "Endpoint-specific options, e.g. { table: 'table1', dbID: '<libraryId>' }. Tdarr's file tables are table1 transcode queue, table2 transcode success, table3 transcode error, table4 health check queue, table5 health check success, table6 health check error.",
        ),
    },
    allowDestructive ? DESTRUCTIVE : READ,
    async ({ client_type, start, page_size, filters, sorts, opts }) => {
      try {
        if (!allowDestructive) {
          const rejected = Object.keys(opts ?? {}).filter(
            (key) => !(READ_OPTS as readonly string[]).includes(key),
          );
          if (rejected.length > 0) {
            return err(
              `query_table is read-only: opts.${rejected.join(", opts.")} not allowed. Set TDARR_ALLOW_DESTRUCTIVE=true to enable the write-capable options.`,
            );
          }
        }
        return ok(
          await client.post(`/api/v2/client/${encodeURIComponent(client_type)}`, {
            data: {
              start: start ?? 0,
              pageSize: page_size ?? 25,
              filters: filters ?? [],
              sorts: sorts ?? [],
              opts: opts ?? {},
            },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "rescan_file",
    "Rescan a single file so Tdarr refreshes its ffProbe data and queue status (POST /api/v2/rescan-file). Use it after changing a file on disk outside Tdarr.",
    {
      file_id: z.string().describe("File ID (full path), from search_files"),
      library_id: z.string().describe("Library ID (dbID) the file belongs to"),
    },
    IDEMPOTENT,
    async ({ file_id, library_id }) => {
      try {
        return ok(
          await client.post("/api/v2/rescan-file", { data: { _id: file_id, DB: library_id } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "scan_file_details",
    "Run ExifTool, MediaInfo and/or a closed-caption scan against one file and return the results (POST /api/v2/scan-individual-file). Works on any path the server can read, whether or not it is in a library.",
    {
      file_path: z.string().describe("Full file path, as Tdarr Server sees it"),
      exiftool: z.boolean().optional().describe("Run an ExifTool scan (default true)"),
      mediainfo: z.boolean().optional().describe("Run a MediaInfo scan (default true)"),
      closed_captions: z
        .boolean()
        .optional()
        .describe("Scan for closed captions (default false; this one is slow)"),
    },
    READ,
    async ({ file_path, exiftool, mediainfo, closed_captions }) => {
      try {
        return ok(
          await client.post("/api/v2/scan-individual-file", {
            data: {
              scanTypes: {
                exifToolScan: exiftool ?? true,
                mediaInfoScan: mediainfo ?? true,
                closedCaptionScan: closed_captions ?? false,
              },
              file: { file: file_path },
            },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_sample",
    "Create a 30 second sample of a file (POST /api/v2/create-sample) and return the path of the sample. Useful for testing a plugin stack or flow on a short clip before running it on a whole library.",
    {
      file_path: z.string().describe("Full file path, as Tdarr Server sees it"),
    },
    WRITE,
    async ({ file_path }) => {
      try {
        return ok(await client.post("/api/v2/create-sample", { data: { filePath: file_path } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "requeue_files",
    "Requeue every file of a library for transcoding or health checking (POST /api/v2/set-all-status). Tdarr's file tables are table1 transcode queue, table2 transcode success, table3 transcode error, table4 health check queue, table5 health check success, table6 health check error — requeueing from table2 back to the transcode queue re-runs the whole library.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      table: z.string().describe("Source table, e.g. 'table2' for previously transcoded files"),
      mode: z
        .string()
        .describe("Requeue mode as used by the Tdarr UI, e.g. 'transcode' or 'health'"),
      process_status: z
        .string()
        .describe("Status to set on the files, e.g. 'Queued' to put them back in the queue"),
    },
    IDEMPOTENT,
    async ({ library_id, table, mode, process_status }) => {
      try {
        return ok(
          await client.post("/api/v2/set-all-status", {
            data: { dbID: library_id, mode, table, processStatus: process_status },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "bulk_update_files",
    "Update fields on specific file records by ID (POST /api/v2/bulk-update-files). The update object is merged into every listed file — e.g. { holdUntil: 0 } to release a hold, or { TranscodeDecisionMaker: 'Queued' } to requeue just those files.",
    {
      file_ids: z.array(z.string()).min(1).describe("File IDs (full paths) to update"),
      updates: z
        .record(z.string(), z.unknown())
        .describe("Object of fields to merge into each file record"),
    },
    IDEMPOTENT,
    async ({ file_ids, updates }) => {
      try {
        return ok(
          await client.post("/api/v2/bulk-update-files", {
            data: { fileIds: file_ids, updatedObj: updates },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "find_duplicates",
    "Start Tdarr's duplicate detection (POST /api/v2/find-duplicates). 'metadata' compares stream metadata and is fast; 'sha256' hashes file content and is accurate but slow — with sha256, hash_amount controls how much of each file is read. Runs asynchronously; stop it with stop_find_duplicates.",
    {
      threshold: z
        .number()
        .min(0)
        .describe("Similarity threshold above which two files count as duplicates"),
      count: z.number().int().min(1).describe("Minimum number of matching files to report a group"),
      detection_method: z
        .enum(["metadata", "sha256"])
        .optional()
        .describe("Detection method (default is the server's own default)"),
      hash_amount: z
        .enum(["10MB", "100MB", "1GB", "10GB", "10%", "50%", "100%"])
        .optional()
        .describe("How much of each file to hash, for detection_method 'sha256'"),
    },
    WRITE,
    async ({ threshold, count, detection_method, hash_amount }) => {
      try {
        const data: Record<string, unknown> = { threshold, count };
        if (detection_method !== undefined) data.detectionMethod = detection_method;
        if (hash_amount !== undefined) data.sha256HashAmount = hash_amount;
        return ok(await client.post("/api/v2/find-duplicates", { data }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "stop_find_duplicates",
    "Stop a running duplicate detection pass (GET /api/v2/stop-dedupe).",
    {},
    IDEMPOTENT,
    async () => {
      try {
        return ok(await client.get("/api/v2/stop-dedupe"));
      } catch (e) {
        return err(e);
      }
    },
  );

  if (!allowDestructive) return;

  server.tool(
    "set_staged_verdict",
    "Take action on an item staged for user approval (POST /api/v2/transcode-user-verdict) — accept, reject or otherwise resolve a transcode that is waiting on a decision.",
    {
      item: z
        .record(z.string(), z.unknown())
        .describe("The staged item record, as returned by query_table for the staged view"),
      verdict: z.string().describe("The verdict to apply, as used by the Tdarr staged-items UI"),
    },
    DESTRUCTIVE,
    async ({ item, verdict }) => {
      try {
        return ok(
          await client.post("/api/v2/transcode-user-verdict", { data: { obj: item, verdict } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_file",
    "Delete one file from disk and remove it from the Tdarr database (POST /api/v2/delete-file). This deletes real media — confirm with the user first.",
    {
      file_id: z.string().describe("File ID (full path), from search_files"),
    },
    DESTRUCTIVE,
    async ({ file_id }) => {
      try {
        return ok(await client.post("/api/v2/delete-file", { data: { file: { _id: file_id } } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "bulk_delete_files",
    "Delete several files from disk and remove them from the Tdarr database (POST /api/v2/bulk-delete-files). This deletes real media — list the files for the user and confirm before calling.",
    {
      file_ids: z.array(z.string()).min(1).describe("File IDs (full paths) to delete"),
    },
    DESTRUCTIVE,
    async ({ file_ids }) => {
      try {
        return ok(await client.post("/api/v2/bulk-delete-files", { data: { fileIds: file_ids } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_unhealthy_files",
    "Delete every file in the transcode-error table (table3) or the health-check-error table (table6) from disk (POST /api/v2/delete-unhealthy-files). This deletes real media in bulk — always list the affected files with query_table and confirm with the user first.",
    {
      table: z
        .enum(["table3", "table6"])
        .describe(
          "table3 = files that failed to transcode, table6 = files that failed a health check",
        ),
    },
    DESTRUCTIVE,
    async ({ table }) => {
      try {
        return ok(await client.post("/api/v2/delete-unhealthy-files", { data: { table } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_cache_file",
    "Delete a leftover file from the Tdarr transcode cache (POST /api/v2/delete-cache-file). Use it to clear partial output from an interrupted worker.",
    {
      file: z.string().describe("Full path of the cache file to delete"),
    },
    DESTRUCTIVE,
    async ({ file }) => {
      try {
        return ok(await client.post("/api/v2/delete-cache-file", { data: { file } }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
