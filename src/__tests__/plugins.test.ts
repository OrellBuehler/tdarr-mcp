import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerPluginTools } from "../tools/plugins.js";
import { registerFlowTools } from "../tools/flows.js";
import { collect, mockJson, mockText, bodyOf, urlOf, jsonOf } from "./helpers.js";

const { tools } = collect(registerPluginTools);
const { tools: flowTools } = collect(registerFlowTools);

describe("plugin tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search_plugins sends string and pluginType", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([[{ Name: "Tdarr_Plugin_x" }], ""]));
    await tools.get("search_plugins")!({ search: "hevc", plugin_type: "Video" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/search-plugins");
    expect(bodyOf(mockFetch)).toEqual({ data: { string: "hevc", pluginType: "Video" } });
  });

  it("search_flow_plugins and search_flow_templates use their own endpoints", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await tools.get("search_flow_plugins")!({ search: "", plugin_type: "any" });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/search-flow-plugins");
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await tools.get("search_flow_templates")!({ search: "", plugin_type: "any" });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/search-flow-templates");
  });

  it("read_plugin and save_plugin map source and id", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(["module.exports = {}", true]));
    await tools.get("read_plugin")!({ plugin_source: "Local", plugin_id: "p" });
    expect(bodyOf(mockFetch)).toEqual({ data: { pluginSource: "Local", pluginID: "p" } });
    mockFetch.mockResolvedValueOnce(mockJson([true]));
    await tools.get("save_plugin")!({ plugin_source: "Local", plugin_id: "p", text: "code" });
    expect(bodyOf(mockFetch, 1)).toEqual({
      data: { pluginSource: "Local", pluginID: "p", text: "code" },
    });
  });

  it("create_plugin builds the details and action envelopes", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(true));
    await tools.get("create_plugin")!({
      name: "My Plugin",
      type: "Video",
      operation: "Transcode",
      description: "does a thing",
      conditionals: "file.video_codec_name === 'h264'",
      preset: "-c:v hevc",
      container: ".mkv",
      handbrake_mode: false,
      ffmpeg_mode: true,
      process_file: true,
      info_log: "transcoding",
    });
    expect(bodyOf(mockFetch)).toEqual({
      data: {
        details: {
          Name: "My Plugin",
          Type: "Video",
          Operation: "Transcode",
          Description: "does a thing",
        },
        conditionalsString: "file.video_codec_name === 'h264'",
        conditionalNotes: "",
        action: {
          preset: "-c:v hevc",
          container: ".mkv",
          handbrakeMode: false,
          ffmpegMode: true,
          processFile: true,
          infoLog: "transcoding",
        },
      },
    });
  });

  it("copy_community_plugin_to_local and update_community_plugins default their flags to false", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([true]));
    await tools.get("copy_community_plugin_to_local")!({ plugin_id: "p" });
    expect(bodyOf(mockFetch)).toEqual({ data: { pluginID: "p", forceOverwrite: false } });
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("update_community_plugins")!({});
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { force: false } });
  });

  it("verify_plugin and delete_plugin send their own field names", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(true));
    await tools.get("verify_plugin")!({ plugin_id: "p", community: true });
    expect(bodyOf(mockFetch)).toEqual({ data: { pluginID: "p", community: true } });
    mockFetch.mockResolvedValueOnce(mockJson([true]));
    await tools.get("delete_plugin")!({ plugin_source: "Local", plugin_id: "p" });
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { pluginSource: "Local", pluginID: "p" } });
  });

  it("sync_plugins_to_nodes and list_plugin_repo_versions post without a body", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("sync_plugins_to_nodes")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/sync-plugins");
    expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("list_plugin_repo_versions")!({});
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/plugin-repo-versions");
  });
});

describe("flow tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list_flows summarizes the graph size", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([
        {
          _id: "f1",
          name: "Remux",
          description: "d",
          flowPlugins: [1, 2, 3],
          flowEdges: [1, 2],
        },
      ]),
    );
    const res = await flowTools.get("list_flows")!({});
    expect(bodyOf(mockFetch)).toEqual({ data: { collection: "FlowsJSONDB", mode: "getAll" } });
    expect(jsonOf(res)).toEqual([
      { _id: "f1", name: "Remux", description: "d", nodeCount: 3, edgeCount: 2 },
    ]);
  });

  it("get_flow returns the whole graph", async () => {
    const raw = { _id: "f1", flowPlugins: [{ pluginId: "x" }] };
    mockFetch.mockResolvedValueOnce(mockJson(raw));
    const res = await flowTools.get("get_flow")!({ flow_id: "f1" });
    expect(bodyOf(mockFetch).data).toEqual({
      collection: "FlowsJSONDB",
      mode: "getById",
      docID: "f1",
    });
    expect(jsonOf(res)).toEqual(raw);
  });
});
