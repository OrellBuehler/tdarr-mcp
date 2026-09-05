import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerNodeTools } from "../tools/nodes.js";
import { collect, mockJson, mockText, bodyOf, urlOf, jsonOf } from "./helpers.js";

const { tools } = collect(registerNodeTools);

describe("node tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list_nodes summarizes each node by id", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson({
        n1: {
          _id: "n1",
          nodeName: "basement",
          nodePaused: false,
          workers: { w1: {} },
          workerLimits: { transcodecpu: 2 },
          config: { secret: "hidden" },
        },
      }),
    );
    const res = await tools.get("list_nodes")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/get-nodes");
    expect(jsonOf(res)).toEqual({
      n1: {
        _id: "n1",
        nodeName: "basement",
        nodePaused: false,
        workerLimits: { transcodecpu: 2 },
        runningWorkers: 1,
      },
    });
  });

  it("list_nodes returns the raw records when detailed", async () => {
    const raw = { n1: { _id: "n1", workers: {}, config: { a: 1 } } };
    mockFetch.mockResolvedValueOnce(mockJson(raw));
    const res = await tools.get("list_nodes")!({ detailed: true });
    expect(jsonOf(res)).toEqual(raw);
  });

  it("get_node_log tails a text log", async () => {
    mockFetch.mockResolvedValueOnce(mockText("a\nb\nc"));
    const res = await tools.get("get_node_log")!({ node_id: "n1", lines: 2 });
    expect(bodyOf(mockFetch)).toEqual({ data: { nodeID: "n1" } });
    expect(res.content[0].text).toBe("b\nc");
  });

  it("get_dispatch_readiness passes numberOfNodes as a query param", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ ready: true, reasons: [] }));
    await tools.get("get_dispatch_readiness")!({ number_of_nodes: 2 });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/nodes/ready?numberOfNodes=2");
  });

  it("get_dispatch_readiness omits the query string when unset", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ ready: true }));
    await tools.get("get_dispatch_readiness")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/nodes/ready");
  });

  it("update_node forwards the update object untouched", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("update_node")!({ node_id: "n1", node_updates: { nodePaused: true } });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/update-node");
    expect(bodyOf(mockFetch)).toEqual({
      data: { nodeID: "n1", nodeUpdates: { nodePaused: true } },
    });
  });

  it("alter_worker_limit maps its arguments to the api field names", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("alter_worker_limit")!({
      node_id: "n1",
      process: "increase",
      worker_type: "transcodegpu",
    });
    expect(bodyOf(mockFetch)).toEqual({
      data: { nodeID: "n1", process: "increase", workerType: "transcodegpu" },
    });
  });

  it("cancel_worker_item and kill_worker hit their own endpoints", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("cancel_worker_item")!({ node_id: "n1", worker_id: "w1", cause: "stuck" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/cancel-worker-item");
    expect(bodyOf(mockFetch)).toEqual({
      data: { nodeID: "n1", workerID: "w1", cause: "stuck" },
    });
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("kill_worker")!({ node_id: "n1", worker_id: "w1" });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/kill-worker");
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { nodeID: "n1", workerID: "w1" } });
  });

  it("restart_node and disconnect_node send only the node id", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("restart_node")!({ node_id: "n1" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/restart-node");
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("disconnect_node")!({ node_id: "n1" });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/disconnect-node");
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { nodeID: "n1" } });
  });
});
