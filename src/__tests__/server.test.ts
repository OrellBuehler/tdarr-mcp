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
});
