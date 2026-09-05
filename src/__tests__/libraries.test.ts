import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerLibraryTools } from "../tools/libraries.js";
import { collect, mockJson, mockText, bodyOf, urlOf, jsonOf } from "./helpers.js";

const { tools } = collect(registerLibraryTools);

describe("library tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list_libraries reads LibrarySettingsJSONDB and summarizes", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([
        { _id: "lib1", name: "Movies", folder: "/media/movies", pluginIDs: [1, 2], junk: true },
      ]),
    );
    const res = await tools.get("list_libraries")!({});
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/cruddb");
    expect(bodyOf(mockFetch)).toEqual({
      data: { collection: "LibrarySettingsJSONDB", mode: "getAll" },
    });
    expect(jsonOf(res)).toEqual([
      { _id: "lib1", name: "Movies", folder: "/media/movies", pluginCount: 2 },
    ]);
  });

  it("get_library looks the record up by id", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ _id: "lib1" }));
    await tools.get("get_library")!({ library_id: "lib1" });
    expect(bodyOf(mockFetch).data).toEqual({
      collection: "LibrarySettingsJSONDB",
      mode: "getById",
      docID: "lib1",
    });
  });

  it("scan_library resolves the library folder when no path is given", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ _id: "lib1", folder: "/media/movies" }));
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("scan_library")!({ library_id: "lib1", mode: "scanFindNew" });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/scan-files");
    expect(bodyOf(mockFetch, 1)).toEqual({
      data: { scanConfig: { dbID: "lib1", mode: "scanFindNew", arrayOrPath: "/media/movies" } },
    });
  });

  it("scan_library uses an explicit path without a lookup", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("scan_library")!({
      library_id: "lib1",
      mode: "scanFresh",
      path: "/media/movies/2024",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(bodyOf(mockFetch).data.scanConfig.arrayOrPath).toBe("/media/movies/2024");
  });

  it("scan_library sends an array for scanFolderWatcher", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("scan_library")!({
      library_id: "lib1",
      mode: "scanFolderWatcher",
      paths: ["/media/a.mkv", "/media/b.mkv"],
    });
    expect(bodyOf(mockFetch).data.scanConfig.arrayOrPath).toEqual(["/media/a.mkv", "/media/b.mkv"]);
  });

  it("scan_library rejects scanFolderWatcher without paths", async () => {
    const res = await tools.get("scan_library")!({
      library_id: "lib1",
      mode: "scanFolderWatcher",
    });
    expect(res.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("scan_library errors when the library has no resolvable folder", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(null));
    const res = await tools.get("scan_library")!({ library_id: "lib1", mode: "scanFindNew" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("lib1");
  });

  it("remove_library_files sends the library id as DB", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("remove_library_files")!({ library_id: "lib1" });
    expect(bodyOf(mockFetch)).toEqual({ data: { DB: "lib1" } });
  });

  it("toggle_folder_watch marks the request as user-triggered", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("toggle_folder_watch")!({
      library_id: "lib1",
      folder: "/media/movies",
      status: true,
    });
    expect(bodyOf(mockFetch)).toEqual({
      data: { auto: false, folder: "/media/movies", dbID: "lib1", status: true },
    });
  });

  it("manage_library_plugin adds with source and index", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("manage_library_plugin")!({
      library_id: "lib1",
      plugin_id: "Tdarr_Plugin_x",
      action: "add",
      source: "Community",
      index: 0,
    });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/add-plugin-include");
    expect(bodyOf(mockFetch)).toEqual({
      data: { dbID: "lib1", ele: "Tdarr_Plugin_x", source: "Community", index: 0 },
    });
  });

  it("manage_library_plugin requires source and index to add", async () => {
    const res = await tools.get("manage_library_plugin")!({
      library_id: "lib1",
      plugin_id: "p",
      action: "add",
    });
    expect(res.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("manage_library_plugin removes and toggles through the right endpoints", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("manage_library_plugin")!({
      library_id: "lib1",
      plugin_id: "p",
      action: "remove",
    });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/remove-plugin-include");
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("manage_library_plugin")!({
      library_id: "lib1",
      plugin_id: "p",
      action: "update",
      status: false,
    });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/update-plugin-include");
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { dbID: "lib1", ele: "p", status: false } });
  });

  it("manage_codec_exclusion builds the endpoint from action and stream", async () => {
    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("manage_codec_exclusion")!({
      library_id: "lib1",
      stream: "audio",
      codec: "aac",
      action: "add",
    });
    expect(urlOf(mockFetch)).toBe("http://tdarr.local:8265/api/v2/add-audio-codec-exclude");
    expect(bodyOf(mockFetch)).toEqual({ data: { dbID: "lib1", ele: "aac" } });

    mockFetch.mockResolvedValueOnce(mockText("ok"));
    await tools.get("manage_codec_exclusion")!({
      library_id: "lib1",
      stream: "video",
      codec: "hevc",
      action: "update",
      status: true,
    });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/update-video-codec-exclude");
    expect(bodyOf(mockFetch, 1)).toEqual({ data: { dbID: "lib1", ele: "hevc", status: true } });
  });

  it("manage_codec_exclusion requires a status to update", async () => {
    const res = await tools.get("manage_codec_exclusion")!({
      library_id: "lib1",
      stream: "video",
      codec: "hevc",
      action: "update",
    });
    expect(res.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("list_subdirectories and verify_folder_exists send folderPath", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ valid: true, folders: [] }));
    await tools.get("list_subdirectories")!({ folder_path: "/media" });
    expect(bodyOf(mockFetch)).toEqual({ data: { folderPath: "/media" } });
    mockFetch.mockResolvedValueOnce(mockJson(true));
    const res = await tools.get("verify_folder_exists")!({ folder_path: "/media" });
    expect(urlOf(mockFetch, 1)).toBe("http://tdarr.local:8265/api/v2/verify-folder-exists");
    expect(jsonOf(res)).toBe(true);
  });
});
