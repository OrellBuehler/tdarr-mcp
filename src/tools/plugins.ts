import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../tdarr/format.js";
import type { TdarrClient } from "../tdarr/client.js";

export function registerPluginTools(server: McpServer, client: TdarrClient) {
  server.tool(
    "search_plugins",
    "Search the classic plugins available to the server (POST /api/v2/search-plugins). Returns name, type, operation, description, version and source for each match — the source and ID are what manage_library_plugin needs.",
    {
      search: z.string().describe("Search string (empty to list everything)"),
      plugin_type: z
        .string()
        .describe(
          "Plugin type filter as used by the Tdarr plugin browser, e.g. 'Video' or 'Audio'",
        ),
    },
    async ({ search, plugin_type }) => {
      try {
        return ok(
          await client.post("/api/v2/search-plugins", {
            data: { string: search, pluginType: plugin_type },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "search_flow_plugins",
    "Search the flow plugins — the individual nodes available inside a Tdarr flow (POST /api/v2/search-flow-plugins).",
    {
      search: z.string().describe("Search string (empty to list everything)"),
      plugin_type: z.string().describe("Plugin type filter as used by the flow editor"),
    },
    async ({ search, plugin_type }) => {
      try {
        return ok(
          await client.post("/api/v2/search-flow-plugins", {
            data: { string: search, pluginType: plugin_type },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "search_flow_templates",
    "Search the ready-made flow templates (POST /api/v2/search-flow-templates). Read one before designing a flow from scratch — the templates show how the official flows wire their nodes together.",
    {
      search: z.string().describe("Search string (empty to list everything)"),
      plugin_type: z.string().describe("Template type filter as used by the flow editor"),
    },
    async ({ search, plugin_type }) => {
      try {
        return ok(
          await client.post("/api/v2/search-flow-templates", {
            data: { string: search, pluginType: plugin_type },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "read_plugin",
    "Read the source of a classic plugin (POST /api/v2/read-plugin-text). Read a Community plugin to understand what it does before adding it to a library, or a Local plugin before editing it.",
    {
      plugin_source: z.string().describe("Plugin source, 'Community' or 'Local'"),
      plugin_id: z.string().describe("Plugin ID, from search_plugins"),
    },
    async ({ plugin_source, plugin_id }) => {
      try {
        return ok(
          await client.post("/api/v2/read-plugin-text", {
            data: { pluginSource: plugin_source, pluginID: plugin_id },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "save_plugin",
    "Write the source of a local classic plugin (POST /api/v2/save-plugin-text). Overwrites the whole file, so read_plugin first and send back the full modified source. Only edit Local plugins — Community plugins are overwritten on the next plugin update.",
    {
      plugin_source: z.string().describe("Plugin source, normally 'Local'"),
      plugin_id: z.string().describe("Plugin ID"),
      text: z.string().describe("Complete new plugin source"),
    },
    async ({ plugin_source, plugin_id, text }) => {
      try {
        return ok(
          await client.post("/api/v2/save-plugin-text", {
            data: { pluginSource: plugin_source, pluginID: plugin_id, text },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_plugin",
    "Create a basic local classic plugin with Tdarr's plugin creator (POST /api/v2/create-plugin). The conditionals string is the plugin's matching logic; the action describes what to run when it matches. For anything beyond a simple condition/action pair, create it here and then refine the source with read_plugin and save_plugin.",
    {
      name: z.string().describe("Plugin name"),
      type: z.string().describe("Plugin type, e.g. 'Video' or 'Audio'"),
      operation: z.string().describe("Plugin operation, e.g. 'Transcode'"),
      description: z.string().describe("What the plugin does"),
      conditionals: z.string().describe("The plugin's matching conditions, as a string"),
      conditional_notes: z
        .string()
        .optional()
        .describe("Notes about the conditions (default empty)"),
      preset: z.string().describe("ffmpeg or HandBrake arguments to run"),
      container: z.string().describe("Output container, e.g. '.mkv'"),
      handbrake_mode: z.boolean().describe("Run the preset through HandBrake"),
      ffmpeg_mode: z.boolean().describe("Run the preset through ffmpeg"),
      process_file: z
        .union([z.boolean(), z.string()])
        .describe("Whether a matching file should be processed"),
      info_log: z.string().describe("Message logged when the plugin runs"),
    },
    async (args) => {
      try {
        return ok(
          await client.post("/api/v2/create-plugin", {
            data: {
              details: {
                Name: args.name,
                Type: args.type,
                Operation: args.operation,
                Description: args.description,
              },
              conditionalsString: args.conditionals,
              conditionalNotes: args.conditional_notes ?? "",
              action: {
                preset: args.preset,
                container: args.container,
                handbrakeMode: args.handbrake_mode,
                ffmpegMode: args.ffmpeg_mode,
                processFile: args.process_file,
                infoLog: args.info_log,
              },
            },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "copy_community_plugin_to_local",
    "Copy a Community plugin into Local plugins so it can be edited without being overwritten by plugin updates (POST /api/v2/copy-community-to-local).",
    {
      plugin_id: z.string().describe("Plugin ID, from search_plugins"),
      force_overwrite: z
        .boolean()
        .optional()
        .describe("Overwrite an existing local copy (default false)"),
    },
    async ({ plugin_id, force_overwrite }) => {
      try {
        return ok(
          await client.post("/api/v2/copy-community-to-local", {
            data: { pluginID: plugin_id, forceOverwrite: force_overwrite ?? false },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "verify_plugin",
    "Check whether a classic plugin exists on the server (POST /api/v2/verify-plugin). Returns a boolean — use it before adding a plugin to a library's stack.",
    {
      plugin_id: z.string().describe("Plugin ID"),
      community: z.boolean().describe("true to look in Community plugins, false for Local"),
    },
    async ({ plugin_id, community }) => {
      try {
        return ok(
          await client.post("/api/v2/verify-plugin", { data: { pluginID: plugin_id, community } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_plugin",
    "Delete a plugin from the server (POST /api/v2/delete-plugin). Deleting a plugin that a library's stack still references leaves that stack broken — check with list_libraries first.",
    {
      plugin_source: z.string().describe("Plugin source, 'Community' or 'Local'"),
      plugin_id: z.string().describe("Plugin ID"),
    },
    async ({ plugin_source, plugin_id }) => {
      try {
        return ok(
          await client.post("/api/v2/delete-plugin", {
            data: { pluginSource: plugin_source, pluginID: plugin_id },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_community_plugins",
    "Pull the latest Community plugins from the Tdarr plugin repo (POST /api/v2/update-plugins). This overwrites Community plugins; Local plugins are untouched.",
    {
      force: z
        .boolean()
        .optional()
        .describe("Re-download even if the server thinks plugins are current (default false)"),
    },
    async ({ force }) => {
      try {
        return ok(await client.post("/api/v2/update-plugins", { data: { force: force ?? false } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "sync_plugins_to_nodes",
    "Push the server's current plugins out to every connected node (POST /api/v2/sync-plugins). Run it after update_community_plugins or save_plugin so nodes execute the new code.",
    {},
    async () => {
      try {
        return ok(await client.post("/api/v2/sync-plugins"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_plugin_repo_versions",
    "List recent commits on the Tdarr plugin repo — SHA, date, message and author (POST /api/v2/plugin-repo-versions). Use it to see what changed upstream before pulling plugin updates.",
    {},
    async () => {
      try {
        return ok(await client.post("/api/v2/plugin-repo-versions"));
      } catch (e) {
        return err(e);
      }
    },
  );
}
