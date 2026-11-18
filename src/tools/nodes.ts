import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, summarizeNodes, tail } from "../tdarr/format.js";
import { DESTRUCTIVE, IDEMPOTENT, READ, WRITE } from "./shared.js";
import type { TdarrClient } from "../tdarr/client.js";

const WORKER_TYPES = ["healthcheckcpu", "healthcheckgpu", "transcodecpu", "transcodegpu"] as const;

export function registerNodeTools(
  server: McpServer,
  client: TdarrClient,
  allowDestructive = false,
) {
  server.tool(
    "list_nodes",
    "List the connected Tdarr nodes (GET /api/v2/get-nodes), keyed by node ID. The summary gives name, paused state, version, worker limits, running worker count and resource stats; pass detailed for the full record including every running worker.",
    {
      detailed: z
        .boolean()
        .optional()
        .describe("Return the full node records instead of the summary"),
    },
    READ,
    async ({ detailed }) => {
      try {
        return ok(summarizeNodes(await client.get("/api/v2/get-nodes"), detailed));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_node_log",
    "Get a node's log as plain text (POST /api/v2/get-node-log). Returns the trailing lines only (default 100). Use it to see why a node's transcodes are failing.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
      lines: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of trailing lines to return (default 100; use 0 for the full log)"),
    },
    READ,
    async ({ node_id, lines }) => {
      try {
        const res = await client.post("/api/v2/get-node-log", { data: { nodeID: node_id } });
        return ok(typeof res === "string" ? tail(res, lines) : res);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_dispatch_readiness",
    "Check whether the server is ready to dispatch tasks and has finished server/node plugin setup (GET /api/v2/nodes/ready). Returns { ready, reasons } — call it before queueing work after a restart.",
    {
      number_of_nodes: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Require at least this many connected nodes before reporting ready"),
    },
    READ,
    async ({ number_of_nodes }) => {
      try {
        const qs = buildQS({ numberOfNodes: number_of_nodes });
        return ok(await client.get(`/api/v2/nodes/ready${qs}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_node",
    "Update a connected node's settings (POST /api/v2/update-node). node_updates is merged into the node record — e.g. { nodePaused: true } to pause a node, { nodeName: 'basement' } to rename it, or { priority: 1 } to change its task priority. Read the current record with list_nodes(detailed) first.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
      node_updates: z
        .record(z.string(), z.unknown())
        .describe("Object of node fields to change, e.g. { nodePaused: true }"),
    },
    IDEMPOTENT,
    async ({ node_id, node_updates }) => {
      try {
        return ok(
          await client.post("/api/v2/update-node", {
            data: { nodeID: node_id, nodeUpdates: node_updates },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "alter_worker_limit",
    "Increase or decrease by one the number of workers of a given type on a node (POST /api/v2/alter-worker-limit). Call it repeatedly to move the limit by more than one.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
      process: z.enum(["increase", "decrease"]).describe("Direction to move the limit"),
      worker_type: z.enum(WORKER_TYPES).describe("Which worker pool to change"),
    },
    WRITE,
    async ({ node_id, process, worker_type }) => {
      try {
        return ok(
          await client.post("/api/v2/alter-worker-limit", {
            data: { nodeID: node_id, process, workerType: worker_type },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "cancel_worker_item",
    "Cancel the item a worker is currently processing (POST /api/v2/cancel-worker-item). The worker stays alive and picks up the next item; the cancelled file goes back to the queue.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
      worker_id: z.string().describe("Worker ID, from the node's workers in list_nodes(detailed)"),
      cause: z.string().describe("Reason recorded against the cancellation"),
    },
    WRITE,
    async ({ node_id, worker_id, cause }) => {
      try {
        return ok(
          await client.post("/api/v2/cancel-worker-item", {
            data: { nodeID: node_id, workerID: worker_id, cause },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  if (!allowDestructive) return;

  server.tool(
    "kill_worker",
    "Kill a worker on a node (POST /api/v2/kill-worker). Unlike cancel_worker_item this removes the worker itself — use it for a worker that is wedged and not responding to a cancel.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
      worker_id: z.string().describe("Worker ID, from the node's workers in list_nodes(detailed)"),
    },
    DESTRUCTIVE,
    async ({ node_id, worker_id }) => {
      try {
        return ok(
          await client.post("/api/v2/kill-worker", {
            data: { nodeID: node_id, workerID: worker_id },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "restart_node",
    "Restart a node process (POST /api/v2/restart-node). Its running workers are interrupted and their files are requeued.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
    },
    DESTRUCTIVE,
    async ({ node_id }) => {
      try {
        return ok(await client.post("/api/v2/restart-node", { data: { nodeID: node_id } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "disconnect_node",
    "Forcefully disconnect a node from the server (POST /api/v2/disconnect-node). Use it to clear a node that shows as connected but is actually gone.",
    {
      node_id: z.string().describe("Node ID, from list_nodes"),
    },
    DESTRUCTIVE,
    async ({ node_id }) => {
      try {
        return ok(await client.post("/api/v2/disconnect-node", { data: { nodeID: node_id } }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
