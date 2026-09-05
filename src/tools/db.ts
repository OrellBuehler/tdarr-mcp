import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../tdarr/format.js";
import type { TdarrClient } from "../tdarr/client.js";

const COLLECTIONS = [
  "SettingsGlobalJSONDB",
  "LibrarySettingsJSONDB",
  "NodeJSONDB",
  "StatisticsJSONDB",
  "VariablesJSONDB",
  "FlowsJSONDB",
  "StagedJSONDB",
  "FileJSONDB",
  "F2FOutputJSONDB",
  "WorkerVerdictHistoryJSONDB",
  "JobsJSONDB",
  "AutomationsJSONDB",
] as const;

export function registerDbTools(server: McpServer, client: TdarrClient) {
  server.tool(
    "query_database",
    "Read a Tdarr database collection directly (POST /api/v2/cruddb) for anything the dedicated tools do not cover — global settings, variables, staged items, jobs, statistics. Read-only: this tool cannot insert, update or remove documents. 'getAll' on FileJSONDB returns the entire file database, so prefer search_files there.",
    {
      collection: z.enum(COLLECTIONS).describe("Collection to read"),
      mode: z
        .enum(["getAll", "getById", "getByIndex"])
        .describe("getAll returns every document; getById and getByIndex look one up by doc_id"),
      doc_id: z.string().optional().describe("Document ID, required for getById and getByIndex"),
    },
    async ({ collection, mode, doc_id }) => {
      try {
        if (mode !== "getAll" && doc_id === undefined) {
          return err(`mode '${mode}' requires 'doc_id'`);
        }
        return ok(await client.cruddb({ collection, mode, docID: doc_id }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
