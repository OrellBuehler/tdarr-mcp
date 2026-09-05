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

export function createServer(client: TdarrClient): McpServer {
  const server = new McpServer({ name: "tdarr-mcp", version: "0.1.0" });
  registerSystemTools(server, client);
  registerNodeTools(server, client);
  registerLibraryTools(server, client);
  registerFileTools(server, client);
  registerStatsTools(server, client);
  registerPluginTools(server, client);
  registerFlowTools(server, client);
  registerReportTools(server, client);
  registerBackupTools(server, client);
  registerAutomationTools(server, client);
  registerDbTools(server, client);
  return server;
}
