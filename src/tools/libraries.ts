import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err, summarizeLibrary, summarizeList } from "../tdarr/format.js";
import { DESTRUCTIVE, IDEMPOTENT, READ, WRITE } from "./shared.js";
import type { TdarrClient } from "../tdarr/client.js";

const LIBRARIES = "LibrarySettingsJSONDB";

export function registerLibraryTools(
  server: McpServer,
  client: TdarrClient,
  allowDestructive = false,
) {
  server.tool(
    "list_libraries",
    "List the configured Tdarr libraries with their ID, name, source folder, priority, plugin stack or flow, and scanning settings. The library _id is the dbID every other library and file tool needs.",
    {
      detailed: z
        .boolean()
        .optional()
        .describe("Return the full library records instead of the summary"),
    },
    READ,
    async ({ detailed }) => {
      try {
        const res = await client.cruddb({ collection: LIBRARIES, mode: "getAll" });
        return ok(summarizeList(res, summarizeLibrary, detailed));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_library",
    "Get one library's full settings record — folders, filters, schedule, plugin stack or flow ID, transcode and health check options.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
    },
    READ,
    async ({ library_id }) => {
      try {
        return ok(
          await client.cruddb({ collection: LIBRARIES, mode: "getById", docID: library_id }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "scan_library",
    "Start a file scan on a library (POST /api/v2/scan-files). 'scanFindNew' adds files not yet in the database, 'scanFresh' rescans everything from scratch, and 'scanFolderWatcher' scans a specific list of file paths. Scanning is asynchronous — poll get_scanner_status for progress.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      mode: z
        .enum(["scanFresh", "scanFindNew", "scanFolderWatcher"])
        .describe("Scan mode. scanFresh discards existing scan results for the library."),
      path: z
        .string()
        .optional()
        .describe(
          "Folder to scan, for scanFresh and scanFindNew. Defaults to the library's own folder.",
        ),
      paths: z
        .array(z.string())
        .optional()
        .describe("Explicit list of file paths, required for scanFolderWatcher"),
    },
    WRITE,
    async ({ library_id, mode, path, paths }) => {
      try {
        if (mode === "scanFolderWatcher" && (!paths || paths.length === 0)) {
          return err("scanFolderWatcher requires a non-empty 'paths' array of file paths");
        }
        let arrayOrPath: string | string[];
        if (mode === "scanFolderWatcher") {
          arrayOrPath = paths as string[];
        } else if (path) {
          arrayOrPath = path;
        } else {
          const lib = (await client.cruddb({
            collection: LIBRARIES,
            mode: "getById",
            docID: library_id,
          })) as { folder?: string } | null;
          if (!lib?.folder) {
            return err(`Could not resolve the folder for library ${library_id}; pass 'path'`);
          }
          arrayOrPath = lib.folder;
        }
        return ok(
          await client.post("/api/v2/scan-files", {
            data: { scanConfig: { dbID: library_id, mode, arrayOrPath } },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_scanner_status",
    "Get the progress of a library's file scanner (POST /api/v2/get-filescanner-status). Poll this after scan_library.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
    },
    READ,
    async ({ library_id }) => {
      try {
        return ok(
          await client.post("/api/v2/get-filescanner-status", { data: { dbID: library_id } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "kill_scanner",
    "Stop a library's file scanner mid-run (POST /api/v2/kill-file-scanner).",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
    },
    IDEMPOTENT,
    async ({ library_id }) => {
      try {
        return ok(await client.post("/api/v2/kill-file-scanner", { data: { dbID: library_id } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "toggle_folder_watch",
    "Enable or disable folder watching for one of a library's folders (POST /api/v2/toggle-folder-watch).",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      folder: z.string().describe("Path of the folder to watch, as configured on the library"),
      status: z.boolean().describe("true to enable watching, false to disable"),
    },
    IDEMPOTENT,
    async ({ library_id, folder, status }) => {
      try {
        return ok(
          await client.post("/api/v2/toggle-folder-watch", {
            data: { auto: false, folder, dbID: library_id, status },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "toggle_schedule",
    "Turn a contiguous range of hour blocks in a library's weekly schedule on or off (POST /api/v2/toggle-schedule). The schedule controls when Tdarr is allowed to process the library.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      start: z.number().int().describe("Index of the first schedule block in the range"),
      end: z.number().int().describe("Index of the last schedule block in the range"),
      type: z.string().describe("Schedule type the range belongs to, as used by the Tdarr UI"),
    },
    WRITE,
    async ({ library_id, start, end, type }) => {
      try {
        return ok(
          await client.post("/api/v2/toggle-schedule", {
            data: { dbID: library_id, start, end, type },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_schedule_block",
    "Enable or disable a single block in a library's weekly schedule (POST /api/v2/update-schedule-block).",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      block: z.string().describe("Schedule block identifier, as stored on the library record"),
      status: z.boolean().describe("true to allow processing in this block, false to block it"),
    },
    IDEMPOTENT,
    async ({ library_id, block, status }) => {
      try {
        return ok(
          await client.post("/api/v2/update-schedule-block", {
            data: { dbID: library_id, ele: block, status },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "manage_library_plugin",
    "Add, remove or enable/disable a classic plugin in a library's plugin stack. Adding requires the plugin source and the position in the stack; get the plugin IDs from search_plugins. Libraries that use a flow instead of a classic stack are not affected.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      plugin_id: z.string().describe("Plugin ID, from search_plugins"),
      action: z
        .enum(["add", "remove", "update"])
        .describe("add appends to the stack, remove deletes it, update toggles its enabled state"),
      source: z
        .string()
        .optional()
        .describe("Plugin source ('Community' or 'Local'), required for action 'add'"),
      index: z
        .number()
        .int()
        .optional()
        .describe("Position in the plugin stack, required for action 'add'"),
      status: z.boolean().optional().describe("Enabled state, required for action 'update'"),
    },
    WRITE,
    async ({ library_id, plugin_id, action, source, index, status }) => {
      try {
        if (action === "add") {
          if (source === undefined || index === undefined) {
            return err("action 'add' requires both 'source' and 'index'");
          }
          return ok(
            await client.post("/api/v2/add-plugin-include", {
              data: { dbID: library_id, ele: plugin_id, source, index },
            }),
          );
        }
        if (action === "update") {
          if (status === undefined) return err("action 'update' requires 'status'");
          return ok(
            await client.post("/api/v2/update-plugin-include", {
              data: { dbID: library_id, ele: plugin_id, status },
            }),
          );
        }
        return ok(
          await client.post("/api/v2/remove-plugin-include", {
            data: { dbID: library_id, ele: plugin_id },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "manage_codec_exclusion",
    "Add, remove or toggle a codec in a library's basic transcoding include/exclude list. Applies to the basic (non-plugin) video or audio transcode settings of the library.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
      stream: z.enum(["video", "audio"]).describe("Which codec list to change"),
      codec: z.string().describe("Codec name, e.g. 'hevc', 'h264', 'aac'"),
      action: z
        .enum(["add", "remove", "update"])
        .describe("add puts the codec in the list, remove takes it out, update toggles it"),
      status: z.boolean().optional().describe("Enabled state, required for action 'update'"),
    },
    WRITE,
    async ({ library_id, stream, codec, action, status }) => {
      try {
        if (action === "update" && status === undefined) {
          return err("action 'update' requires 'status'");
        }
        const verb = action === "add" ? "add" : action === "remove" ? "remove" : "update";
        const path = `/api/v2/${verb}-${stream}-codec-exclude`;
        const data: Record<string, unknown> = { dbID: library_id, ele: codec };
        if (action === "update") data.status = status;
        return ok(await client.post(path, { data }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_subdirectories",
    "List the subfolders of a path as seen by Tdarr Server (POST /api/v2/get-subdirectories). Use it to discover the paths a library can point at — the server sees container paths, not host paths.",
    {
      folder_path: z.string().describe("Folder path to list, as visible to Tdarr Server"),
    },
    READ,
    async ({ folder_path }) => {
      try {
        return ok(
          await client.post("/api/v2/get-subdirectories", { data: { folderPath: folder_path } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "verify_folder_exists",
    "Check whether a folder exists and is readable by Tdarr Server (POST /api/v2/verify-folder-exists). Returns a boolean.",
    {
      folder_path: z.string().describe("Folder path to check, as visible to Tdarr Server"),
    },
    READ,
    async ({ folder_path }) => {
      try {
        return ok(
          await client.post("/api/v2/verify-folder-exists", { data: { folderPath: folder_path } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  if (!allowDestructive) return;

  server.tool(
    "remove_library_files",
    "Remove every file record of a library from the Tdarr database (POST /api/v2/remove-library-files). Files on disk are NOT touched — this only clears the scan results, which then have to be rebuilt with scan_library. Ask the user before calling this.",
    {
      library_id: z.string().describe("Library ID (dbID), from list_libraries"),
    },
    DESTRUCTIVE,
    async ({ library_id }) => {
      try {
        return ok(await client.post("/api/v2/remove-library-files", { data: { DB: library_id } }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
