import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../tdarr/format.js";
import type { TdarrClient } from "../tdarr/client.js";

export function registerStatsTools(server: McpServer, client: TdarrClient) {
  server.tool(
    "get_pie_stats",
    "Get the pie-chart statistics shown on the Tdarr dashboard (POST /api/v2/stats/get-pies) — file counts by transcode status, health status, container, video and audio codec, resolution and channel layout. Omit library_id for totals across every library.",
    {
      library_id: z
        .string()
        .optional()
        .describe("Library ID to scope the stats to (default: all libraries)"),
    },
    async ({ library_id }) => {
      try {
        return ok(await client.post("/api/v2/stats/get-pies", { data: { libraryId: library_id } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_stream_stats",
    "Get stream-level statistics (POST /api/v2/stats/get-streams) — the codecs, languages and stream types present across the library's files.",
    {
      library_id: z
        .string()
        .optional()
        .describe("Library ID to scope the stats to (default: all libraries)"),
    },
    async ({ library_id }) => {
      try {
        return ok(
          await client.post("/api/v2/stats/get-streams", { data: { libraryId: library_id } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_space_saved",
    "Get space saved by transcoding over time, bucketed (POST /api/v2/stats/get-space-saved). Filter by library, node, worker type or plugin to see which of them actually saves storage.",
    {
      timeframe: z
        .string()
        .optional()
        .describe("Timeframe to report over, as used by the Tdarr UI"),
      library_id: z.string().optional().describe("Restrict to one library"),
      node_id: z.string().optional().describe("Restrict to one node"),
      worker_type: z
        .string()
        .optional()
        .describe("Restrict to one worker type, e.g. 'transcodecpu'"),
      plugin_id: z.string().optional().describe("Restrict to one plugin"),
    },
    async ({ timeframe, library_id, node_id, worker_type, plugin_id }) => {
      try {
        return ok(
          await client.post("/api/v2/stats/get-space-saved", {
            data: {
              timeframe,
              libraryId: library_id,
              nodeId: node_id,
              workerType: worker_type,
              pluginId: plugin_id,
            },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_worker_verdict_history",
    "Get transcode and health check outcomes over time, bucketed (POST /api/v2/stats/get-worker-verdict-hist) — successes, errors and not-required counts. The quickest way to see whether a change made failures go up.",
    {
      timeframe: z
        .string()
        .optional()
        .describe("Timeframe to report over, as used by the Tdarr UI"),
      library_id: z.string().optional().describe("Restrict to one library"),
      node_id: z.string().optional().describe("Restrict to one node"),
      worker_type: z
        .string()
        .optional()
        .describe("Restrict to one worker type, e.g. 'transcodegpu'"),
    },
    async ({ timeframe, library_id, node_id, worker_type }) => {
      try {
        return ok(
          await client.post("/api/v2/stats/get-worker-verdict-hist", {
            data: {
              timeframe,
              libraryId: library_id,
              nodeId: node_id,
              workerType: worker_type,
            },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_resource_history",
    "Get the Tdarr Server resource history (POST /api/v2/stats/get-res-hist) — CPU percentage, memory and heap usage over time.",
    {
      timeframe: z
        .string()
        .optional()
        .describe("Timeframe to report over, as used by the Tdarr UI"),
    },
    async ({ timeframe }) => {
      try {
        return ok(await client.post("/api/v2/stats/get-res-hist", { data: { timeframe } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_worker_history",
    "Get the history of running worker counts by type (POST /api/v2/stats/get-running-worker-hist). Use it to check whether workers were actually busy over a period, or idle waiting for work.",
    {
      timeframe: z
        .string()
        .optional()
        .describe("Timeframe to report over, as used by the Tdarr UI"),
    },
    async ({ timeframe }) => {
      try {
        return ok(
          await client.post("/api/v2/stats/get-running-worker-hist", { data: { timeframe } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );
}
