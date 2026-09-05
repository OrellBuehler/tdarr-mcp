import { describe, it, expect } from "vitest";
import {
  buildQS,
  ok,
  err,
  pruneUndefined,
  summarizeFile,
  summarizeLibrary,
  summarizeNode,
  summarizeNodes,
  summarizeList,
  tail,
} from "../tdarr/format.js";

describe("format helpers", () => {
  it("buildQS skips nullish values and repeats array entries", () => {
    expect(buildQS({ a: 1, b: undefined, c: null, d: ["x", "y"] })).toBe("?a=1&d=x&d=y");
    expect(buildQS({})).toBe("");
  });

  it("ok passes strings through unquoted and stringifies objects", () => {
    expect(ok("plain").content[0].text).toBe("plain");
    expect(ok({ a: 1 }).content[0].text).toBe('{"a":1}');
  });

  it("err marks the envelope as an error", () => {
    const res = err(new Error("boom"));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("boom");
  });

  it("pruneUndefined drops undefined but keeps null and false", () => {
    expect(pruneUndefined({ a: 1, b: undefined, c: null, d: false })).toEqual({
      a: 1,
      c: null,
      d: false,
    });
  });

  it("summarizeFile keeps the useful fields and drops ffProbe noise", () => {
    expect(
      summarizeFile({
        _id: "/media/a.mkv",
        file: "/media/a.mkv",
        DB: "lib1",
        container: "mkv",
        file_size: 4096,
        video_codec_name: "h264",
        TranscodeDecisionMaker: "Queued",
        HealthCheck: "Success",
        ffProbeData: { streams: [] },
      }),
    ).toEqual({
      _id: "/media/a.mkv",
      file: "/media/a.mkv",
      library: "lib1",
      container: "mkv",
      sizeMB: 4096,
      video: "h264",
      transcodeStatus: "Queued",
      healthStatus: "Success",
    });
  });

  it("summarizeFile falls back to the file path when _id is absent", () => {
    expect(summarizeFile({ file: "/media/b.mkv" })._id).toBe("/media/b.mkv");
  });

  it("summarizeLibrary counts the plugin stack and prefers pluginStackType", () => {
    expect(
      summarizeLibrary({
        _id: "lib1",
        name: "Movies",
        folder: "/media/movies",
        pluginStackType: "flow",
        type: "classic",
        pluginIDs: [{ id: "a" }, { id: "b" }],
      }),
    ).toEqual({
      _id: "lib1",
      name: "Movies",
      folder: "/media/movies",
      type: "flow",
      pluginCount: 2,
    });
  });

  it("summarizeNode reports the running worker count", () => {
    expect(
      summarizeNode({
        _id: "node1",
        nodeName: "basement",
        nodePaused: false,
        workers: { w1: {}, w2: {} },
        workerLimits: { transcodecpu: 2 },
      }),
    ).toEqual({
      _id: "node1",
      nodeName: "basement",
      nodePaused: false,
      workerLimits: { transcodecpu: 2 },
      runningWorkers: 2,
    });
  });

  it("summarizeNodes maps over the node id keys and honours detailed", () => {
    const nodes = { node1: { _id: "node1", nodeName: "a", workers: {}, extra: "keep" } };
    expect(summarizeNodes(nodes)).toEqual({
      node1: { _id: "node1", nodeName: "a", runningWorkers: 0 },
    });
    expect(summarizeNodes(nodes, true)).toBe(nodes);
  });

  it("summarizeList maps arrays and returns raw data when detailed", () => {
    const files = [{ _id: "/a.mkv", ffProbeData: {} }];
    expect(summarizeList(files, summarizeFile)).toEqual([{ _id: "/a.mkv", file: undefined }]);
    expect(summarizeList(files, summarizeFile, true)).toBe(files);
  });

  it("summarizeList leaves non-array payloads alone", () => {
    expect(summarizeList({ message: "none" }, summarizeFile)).toEqual({ message: "none" });
  });

  it("tail returns the last n lines, or everything for 0", () => {
    const log = ["a", "b", "c", "d"].join("\n");
    expect(tail(log, 2)).toBe("c\nd");
    expect(tail(log, 0)).toBe(log);
    expect(tail(log)).toBe(log);
  });
});
