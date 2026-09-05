import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err, pruneUndefined, summarizeList } from "../tdarr/format.js";
import type { TdarrClient } from "../tdarr/client.js";

const FLOWS = "FlowsJSONDB";

interface TdarrFlow {
  _id?: string;
  name?: string;
  description?: string;
  flowPlugins?: unknown[];
  flowEdges?: unknown[];
  [key: string]: unknown;
}

function summarizeFlow(f: TdarrFlow): Record<string, unknown> {
  return pruneUndefined({
    _id: f._id,
    name: f.name,
    description: f.description,
    nodeCount: Array.isArray(f.flowPlugins) ? f.flowPlugins.length : undefined,
    edgeCount: Array.isArray(f.flowEdges) ? f.flowEdges.length : undefined,
  });
}

export function registerFlowTools(server: McpServer, client: TdarrClient) {
  server.tool(
    "list_flows",
    "List the Tdarr flows defined on the server with their ID, name, description and size. A library's flowId (from list_libraries) points at one of these.",
    {
      detailed: z
        .boolean()
        .optional()
        .describe("Return the full flow graphs instead of the summary"),
    },
    async ({ detailed }) => {
      try {
        const res = await client.cruddb({ collection: FLOWS, mode: "getAll" });
        return ok(summarizeList(res, summarizeFlow, detailed));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_flow",
    "Get one flow's complete graph — every node with its plugin ID and inputs, plus the edges between them. Read this to explain or debug what a library's flow actually does.",
    {
      flow_id: z.string().describe("Flow ID, from list_flows"),
    },
    async ({ flow_id }) => {
      try {
        return ok(await client.cruddb({ collection: FLOWS, mode: "getById", docID: flow_id }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
