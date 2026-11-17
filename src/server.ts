import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TdarrClient } from "./tdarr/client.js";
import { registerSystemTools } from "./tools/system.js";
import { registerNodeTools } from "./tools/nodes.js";
import { registerLibraryTools } from "./tools/libraries.js";
import { registerFileTools } from "./tools/files.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerPluginTools } from "./tools/plugins.js";
import { registerFlowTools } from "./tools/flows.js";
import { registerReportTools } from "./tools/reports.js";
import { registerBackupTools } from "./tools/backups.js";
import { registerAutomationTools } from "./tools/automations.js";
import { registerDbTools } from "./tools/db.js";

export function createServer(client: TdarrClient, allowDestructive = false): McpServer {
  const server = new McpServer({ name: "tdarr-mcp", version: "0.2.0" });
  registerSystemTools(server, client, allowDestructive);
  registerNodeTools(server, client, allowDestructive);
  registerLibraryTools(server, client, allowDestructive);
  registerFileTools(server, client, allowDestructive);
  registerStatsTools(server, client);
  registerPluginTools(server, client, allowDestructive);
  registerFlowTools(server, client);
  registerReportTools(server, client, allowDestructive);
  registerBackupTools(server, client, allowDestructive);
  registerAutomationTools(server, client);
  registerDbTools(server, client);
  return server;
}
