import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err, tail } from "../tdarr/format.js";
import { DESTRUCTIVE, READ, WRITE } from "./shared.js";
import type { TdarrClient } from "../tdarr/client.js";

export function registerSystemTools(
  server: McpServer,
  client: TdarrClient,
  allowDestructive = false,
) {
  server.tool(
    "get_status",
    "Get Tdarr Server status: version, build date, uptime, OS and server engine (GET /api/v2/status). Also serves as a connectivity/API-key check — call this first when something looks wrong.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.get("/api/v2/status"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_server_time",
    "Get the current time on the Tdarr Server as a Unix epoch in milliseconds. Useful for interpreting the epoch timestamps returned by file and job records.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/get-time-now"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_server_log",
    "Get the Tdarr Server log as plain text (GET /api/v2/get-server-log). Returns the trailing lines only (default 100) — the full log can be very large.",
    {
      lines: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of trailing lines to return (default 100; use 0 for the full log)"),
    },
    READ,
    async ({ lines }) => {
      try {
        return ok(tail(await client.fetchText("/api/v2/get-server-log"), lines));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_resource_stats",
    "Get current Tdarr Server resource usage: process uptime and heap, plus host CPU percentage and memory used/total (POST /api/v2/get-res-stats).",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/get-res-stats"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_db_statuses",
    "Get the status of the Tdarr databases (POST /api/v2/get-db-statuses). Use when the UI reports the database as loading, busy or corrupted.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/get-db-statuses"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_process_info",
    "Get the process tree of the server and every connected node — pid, ppid, executable, script and memory usage per process (POST /api/v2/get-process-info). Useful for spotting stuck ffmpeg/HandBrake child processes.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/get-process-info"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_performance_stats",
    "Get Tdarr internal performance statistics (POST /api/v2/performance-stats) — timings for server operations, used to diagnose a slow server or database.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/performance-stats"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "check_for_update",
    allowDestructive
      ? "Check whether a Tdarr update is available (POST /api/v2/updater/check). Defaults to a check only. Set download_update to fetch the update, and apply_update to install it — applying an update requires calling relaunch_server afterwards."
      : "Check whether a Tdarr update is available (POST /api/v2/updater/check). Check only: download_update and apply_update are rejected unless the server is started with TDARR_ALLOW_DESTRUCTIVE=true.",
    {
      download_update: z
        .boolean()
        .optional()
        .describe("Download the new version if one is available (default false)"),
      apply_update: z
        .boolean()
        .optional()
        .describe("Apply a downloaded update (default false). Requires a relaunch afterwards."),
      reset_updater: z
        .boolean()
        .optional()
        .describe("Reset a stuck updater state before checking (default false)"),
    },
    allowDestructive ? DESTRUCTIVE : WRITE,
    async ({ download_update, apply_update, reset_updater }) => {
      try {
        if (!allowDestructive && (download_update || apply_update)) {
          return err(
            "download_update and apply_update require TDARR_ALLOW_DESTRUCTIVE=true; without it check_for_update only checks.",
          );
        }
        return ok(
          await client.post("/api/v2/updater/check", {
            downloadUpdate: download_update ?? false,
            applyUpdate: apply_update ?? false,
            resetUpdater: reset_updater ?? false,
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_package_index",
    "Get the Tdarr package index (POST /api/v2/updater/package-index) — the versions and artifacts the updater can install.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/updater/package-index"));
      } catch (e) {
        return err(e);
      }
    },
  );

  if (!allowDestructive) return;

  server.tool(
    "relaunch_server",
    "Relaunch Tdarr Server to finish applying a downloaded update (POST /api/v2/updater/relaunch). Only call this after check_for_update reported the update as applied — it interrupts running jobs.",
    {},
    DESTRUCTIVE,
    async () => {
      try {
        return ok(await client.post("/api/v2/updater/relaunch"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "restart_server",
    "Restart Tdarr Server (POST /api/v2/restart-server). Disruptive: running workers are interrupted and every node reconnects. Ask the user before calling this.",
    {},
    DESTRUCTIVE,
    async () => {
      try {
        return ok(await client.post("/api/v2/restart-server"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "restart_ui",
    "Restart the Tdarr web UI process (GET /api/v2/restart-ui). Does not interrupt transcoding — use it when the UI is unresponsive but jobs are fine.",
    {},
    DESTRUCTIVE,
    async () => {
      try {
        return ok(await client.get("/api/v2/restart-ui"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "run_help_command",
    "Run an ffmpeg or HandBrake help command on the server and return its output (POST /api/v2/run-help-command). Use it to check which encoders, filters or presets the server's binaries actually support before writing transcode arguments.",
    {
      mode: z.string().describe("Which binary to query, e.g. 'ffmpeg' or 'handbrake'"),
      text: z
        .string()
        .describe("Arguments to pass, e.g. '-encoders', '-hwaccels' or '-h encoder=hevc_nvenc'"),
    },
    DESTRUCTIVE,
    async ({ mode, text }) => {
      try {
        return ok(await client.post("/api/v2/run-help-command", { data: { mode, text } }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
