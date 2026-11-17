import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../tdarr/format.js";
import { DESTRUCTIVE, IDEMPOTENT, READ, WRITE } from "./shared.js";
import type { TdarrClient } from "../tdarr/client.js";

export function registerBackupTools(
  server: McpServer,
  client: TdarrClient,
  allowDestructive = false,
) {
  server.tool(
    "list_backups",
    "List the Tdarr database backups on the server with their name, size and date (POST /api/v2/get-backups).",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/get-backups"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_backup",
    "Create a backup of the Tdarr database (POST /api/v2/create-backup). Runs asynchronously — poll get_backup_status for progress. Take one before any bulk change to libraries or files.",
    {},
    WRITE,
    async () => {
      try {
        return ok(await client.post("/api/v2/create-backup"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_backup_status",
    "Get the status of a backup in progress (POST /api/v2/get-backup-status).",
    {},
    READ,
    async () => {
      try {
        return ok(await client.post("/api/v2/get-backup-status"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "reset_backup_status",
    "Reset a stuck backup status (POST /api/v2/reset-backup-status). Use it when get_backup_status keeps reporting a backup that is no longer running.",
    {},
    IDEMPOTENT,
    async () => {
      try {
        return ok(await client.post("/api/v2/reset-backup-status"));
      } catch (e) {
        return err(e);
      }
    },
  );

  if (!allowDestructive) return;

  server.tool(
    "delete_backup",
    "Delete a Tdarr database backup (POST /api/v2/delete-backup).",
    {
      name: z.string().describe("Backup name, from list_backups"),
    },
    DESTRUCTIVE,
    async ({ name }) => {
      try {
        return ok(await client.post("/api/v2/delete-backup", { data: { name } }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
