import { describe, it, expect } from "vitest";
import { createServer } from "../server.js";
import { TdarrClient } from "../tdarr/client.js";
import { collect } from "./helpers.js";
import { registerSystemTools } from "../tools/system.js";
import { registerNodeTools } from "../tools/nodes.js";
import { registerLibraryTools } from "../tools/libraries.js";
import { registerFileTools } from "../tools/files.js";
import { registerStatsTools } from "../tools/stats.js";
import { registerPluginTools } from "../tools/plugins.js";
import { registerFlowTools } from "../tools/flows.js";
import { registerReportTools } from "../tools/reports.js";
import { registerBackupTools } from "../tools/backups.js";
import { registerAutomationTools } from "../tools/automations.js";
import { registerDbTools } from "../tools/db.js";

const groups = [
  registerSystemTools,
  registerNodeTools,
  registerLibraryTools,
  registerFileTools,
  registerStatsTools,
  registerPluginTools,
  registerFlowTools,
  registerReportTools,
  registerBackupTools,
  registerAutomationTools,
  registerDbTools,
];

describe("createServer", () => {
  it("registers every tool group without throwing", () => {
    expect(createServer(new TdarrClient("http://tdarr.local:8265", ""))).toBeDefined();
  });

  it("has no duplicate tool names across groups", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const group of groups) {
      for (const name of collect(group).tools.keys()) {
        if (seen.has(name)) duplicates.push(name);
        seen.add(name);
      }
    }
    expect(duplicates).toEqual([]);
    expect(seen.size).toBeGreaterThan(50);
  });

  it("gives every tool a description that names what it does", () => {
    for (const group of groups) {
      for (const [name, desc] of collect(group).descriptions) {
        expect(desc.length, `${name} has a too-short description`).toBeGreaterThan(40);
      }
    }
  });

  it("never exposes the user or api key collections through query_database", () => {
    const schema = collect(registerDbTools).schemas.get("query_database")!;
    const collections = (schema.collection as any).options as string[];
    expect(collections).not.toContain("UsersJSONDB");
    expect(collections).not.toContain("ApiKeysJSONDB");
  });

  it("gives every tool annotations with an explicit readOnlyHint", () => {
    for (const group of groups) {
      for (const [name, annotations] of collect(group).annotations) {
        expect(typeof annotations?.readOnlyHint, `${name} has no readOnlyHint`).toBe("boolean");
        if (annotations.readOnlyHint) {
          expect(annotations.destructiveHint, `${name} is read-only and destructive`).toBeFalsy();
        } else {
          expect(typeof annotations.destructiveHint, `${name} has no destructiveHint`).toBe(
            "boolean",
          );
        }
      }
    }
  });
});

describe("destructive gating", () => {
  const safe: Record<string, string[]> = {
    registerSystemTools: [
      "get_status",
      "get_server_time",
      "get_server_log",
      "get_resource_stats",
      "get_db_statuses",
      "get_process_info",
      "get_performance_stats",
      "check_for_update",
      "get_package_index",
    ],
    registerNodeTools: [
      "list_nodes",
      "get_node_log",
      "get_dispatch_readiness",
      "update_node",
      "alter_worker_limit",
      "cancel_worker_item",
    ],
    registerLibraryTools: [
      "list_libraries",
      "get_library",
      "scan_library",
      "get_scanner_status",
      "kill_scanner",
      "toggle_folder_watch",
      "toggle_schedule",
      "update_schedule_block",
      "manage_library_plugin",
      "manage_codec_exclusion",
      "list_subdirectories",
      "verify_folder_exists",
    ],
    registerFileTools: [
      "search_files",
      "get_file",
      "query_table",
      "rescan_file",
      "scan_file_details",
      "create_sample",
      "requeue_files",
      "bulk_update_files",
      "find_duplicates",
      "stop_find_duplicates",
    ],
    registerStatsTools: [
      "get_pie_stats",
      "get_stream_stats",
      "get_space_saved",
      "get_worker_verdict_history",
      "get_resource_history",
      "get_worker_history",
    ],
    registerPluginTools: [
      "search_plugins",
      "search_flow_plugins",
      "search_flow_templates",
      "read_plugin",
      "verify_plugin",
      "list_plugin_repo_versions",
    ],
    registerFlowTools: ["list_flows", "get_flow"],
    registerReportTools: [
      "search_job_reports",
      "get_job_report",
      "list_file_job_reports",
      "read_job_report_file",
    ],
    registerBackupTools: [
      "list_backups",
      "create_backup",
      "get_backup_status",
      "reset_backup_status",
    ],
    registerAutomationTools: ["list_automations", "get_automation", "run_automation"],
    registerDbTools: ["query_database"],
  };

  const gated = [
    "relaunch_server",
    "restart_server",
    "restart_ui",
    "run_help_command",
    "kill_worker",
    "restart_node",
    "disconnect_node",
    "remove_library_files",
    "set_staged_verdict",
    "delete_file",
    "bulk_delete_files",
    "delete_unhealthy_files",
    "delete_cache_file",
    "save_plugin",
    "create_plugin",
    "copy_community_plugin_to_local",
    "delete_plugin",
    "update_community_plugins",
    "sync_plugins_to_nodes",
    "delete_job_report",
    "delete_job_reports",
    "delete_backup",
  ];

  it("registers exactly the non-destructive tools when the flag is off", () => {
    for (const group of groups) {
      expect([...collect(group, false).tools.keys()], group.name).toEqual(safe[group.name]);
    }
  });

  it("adds exactly the gated tools when the flag is on", () => {
    const added: string[] = [];
    for (const group of groups) {
      const off = collect(group, false).tools;
      for (const name of collect(group, true).tools.keys()) {
        if (!off.has(name)) added.push(name);
      }
    }
    expect(added).toEqual(gated);
  });

  it("leaves no destructive annotation outside the gate", () => {
    for (const group of groups) {
      for (const [name, annotations] of collect(group, false).annotations) {
        expect(annotations.destructiveHint, `${name} is destructive but ungated`).toBeFalsy();
      }
    }
  });

  it("marks every gated tool as destructive", () => {
    for (const group of groups) {
      const { annotations } = collect(group, true);
      for (const name of gated) {
        if (annotations.has(name)) expect(annotations.get(name)!.destructiveHint).toBe(true);
      }
    }
  });

  it("createServer hides the gated tools unless allowDestructive is passed", () => {
    const client = new TdarrClient("http://tdarr.local:8265", "");
    const names = (server: unknown) =>
      Object.keys((server as { _registeredTools: Record<string, unknown> })._registeredTools);
    const off = names(createServer(client));
    const on = names(createServer(client, true));
    expect(off).toEqual(Object.values(safe).flat());
    expect(on.filter((name) => !off.includes(name))).toEqual(gated);
  });

  it("passes annotations through to the real server for every tool", () => {
    const server = createServer(new TdarrClient("http://tdarr.local:8265", ""), true);
    const registered = (
      server as unknown as {
        _registeredTools: Record<string, { annotations?: { readOnlyHint?: boolean } }>;
      }
    )._registeredTools;
    for (const [name, tool] of Object.entries(registered)) {
      expect(typeof tool.annotations?.readOnlyHint, name).toBe("boolean");
    }
    expect(registered.get_status.annotations).toEqual({ readOnlyHint: true });
  });
});
