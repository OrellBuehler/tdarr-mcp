import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../tdarr/format.js";
import type { TdarrClient } from "../tdarr/client.js";

const AUTOMATIONS = "AutomationsJSONDB";

export function registerAutomationTools(server: McpServer, client: TdarrClient) {
  server.tool(
    "list_automations",
    "List the automation configurations defined on the server. The _id of one of these is the config_id run_automation takes.",
    {},
    async () => {
      try {
        return ok(await client.cruddb({ collection: AUTOMATIONS, mode: "getAll" }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_automation",
    "Get one automation configuration in full — its trigger, payload shape and targets.",
    {
      config_id: z.string().describe("Automation config ID, from list_automations"),
    },
    async ({ config_id }) => {
      try {
        return ok(
          await client.cruddb({ collection: AUTOMATIONS, mode: "getById", docID: config_id }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "run_automation",
    "Manually trigger an automation (POST /api/v2/run-automation). Scope it to specific libraries or nodes, and use the bypass flags only when you deliberately want to jump the worker or staged-file limits.",
    {
      config_id: z.string().describe("Automation config ID, from list_automations"),
      payload: z
        .record(z.unknown())
        .optional()
        .describe("Payload passed to the automation, shaped by that automation's config"),
      library_ids: z.array(z.string()).optional().describe("Restrict the run to these libraries"),
      target_node_ids: z
        .array(z.string())
        .optional()
        .describe("Restrict the run to these node IDs"),
      target_node_names: z
        .array(z.string())
        .optional()
        .describe("Restrict the run to these node names"),
      execute_immediately: z
        .boolean()
        .optional()
        .describe("Run now instead of queueing behind existing work"),
      bypass_worker_limits: z
        .boolean()
        .optional()
        .describe("Ignore the nodes' configured worker limits"),
      bypass_staged_file_limit: z.boolean().optional().describe("Ignore the staged file limit"),
    },
    async (args) => {
      try {
        const data: Record<string, unknown> = { configId: args.config_id };
        if (args.payload !== undefined) data.payload = args.payload;
        if (args.library_ids !== undefined) data.libraryIds = args.library_ids;
        if (args.target_node_ids !== undefined) data.targetNodeIds = args.target_node_ids;
        if (args.target_node_names !== undefined) data.targetNodeNames = args.target_node_names;
        if (args.execute_immediately !== undefined)
          data.executeImmediately = args.execute_immediately;
        if (args.bypass_worker_limits !== undefined)
          data.bypassWorkerLimits = args.bypass_worker_limits;
        if (args.bypass_staged_file_limit !== undefined)
          data.bypassStagedFileLimit = args.bypass_staged_file_limit;
        return ok(await client.post("/api/v2/run-automation", { data }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
