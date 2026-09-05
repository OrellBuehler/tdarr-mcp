# Tdarr MCP Server

[![npm](https://img.shields.io/npm/v/@orellbuehler/tdarr-mcp.svg)](https://www.npmjs.com/package/@orellbuehler/tdarr-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@orellbuehler/tdarr-mcp.svg)](https://www.npmjs.com/package/@orellbuehler/tdarr-mcp)
[![CI](https://github.com/OrellBuehler/tdarr-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/OrellBuehler/tdarr-mcp/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@orellbuehler/tdarr-mcp.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io/) server that puts your
[Tdarr](https://home.tdarr.io/) transcoding farm in reach of an AI agent — libraries, files, nodes
and workers, plugins and flows, job reports and statistics.

Point Claude (or any MCP client) at it and the agent can:

- **See what the farm is doing** — nodes, workers, queues, resource usage, and the live status of
  every library scan.
- **Explain why a transcode failed** — read the job report with the actual ffmpeg command line and
  its error, then the plugin or flow that produced it.
- **Operate the queues** — scan libraries, requeue files, cancel or kill a stuck worker, move worker
  limits, pause a node, run an automation.
- **Work on plugins** — search Community and Local classic plugins, read their source, copy one
  local, edit it, and push the result out to every node.
- **Report on the numbers** — space saved by library, node or plugin; success and error rates over
  time; codec, container and resolution breakdowns.

85 tools, zero install (`npx`), works with Claude Code, Claude Desktop, Cursor, and any other MCP
client.

## Example prompts

> "Which of my libraries still has the most h264 left, and how much space would transcoding it to
> hevc save based on what I've already converted?"

> "Three files failed to transcode last night. Read their job reports and tell me what they have in
> common."

> "The basement node has been sitting at zero throughput for an hour — figure out whether it's
> stuck, and kill the worker if it is."

> "Explain what my 'Movies' flow actually does, node by node."

> "Copy the HEVC plugin to Local, change the CRF to 22, and sync it to the nodes."

> "Take a database backup, then requeue the whole TV library for a health check."

## Install

The package is published as
[`@orellbuehler/tdarr-mcp`](https://www.npmjs.com/package/@orellbuehler/tdarr-mcp) and runs directly
with `npx` — no clone or build needed:

```bash
claude mcp add tdarr \
  --env TDARR_URL=http://tdarr.local:8265 \
  --env TDARR_API_KEY=tapi_your_api_key \
  -- npx -y @orellbuehler/tdarr-mcp
```

See [Usage with Claude Code](#usage-with-claude-code) for the equivalent JSON config. For any other
MCP client, run the package directly — `npx -y @orellbuehler/tdarr-mcp` with `TDARR_URL` set in the
environment. Requires Node.js 20+.

## Getting an API key

`TDARR_API_KEY` is only needed if your server runs with authentication enabled (the Tdarr Server
`auth` config/env variable set to `true`). If it does:

1. Sign in to the Tdarr web UI.
2. Go to **Tools → API Keys** and create a key.
3. Copy the key — it starts with `tapi_` — and treat it like a password.

The key is sent as the `x-api-key` header on every request. If your server has authentication
turned off, leave `TDARR_API_KEY` unset and everything works.

## Configuration

| Variable        | Required | Description                                                        |
| --------------- | -------- | ------------------------------------------------------------------ |
| `TDARR_URL`     | yes\*    | Base URL of Tdarr Server, e.g. `http://tdarr.local:8265`.          |
| `TDARR_SERVER`  | no       | Alias for `TDARR_URL`. Used if `TDARR_URL` is unset.               |
| `TDARR_API_KEY` | no       | API key from Tools → API Keys. Only needed when `auth` is enabled. |

\* Either `TDARR_URL` or `TDARR_SERVER` must be set. A missing scheme is treated as `http://`, and
trailing slashes are stripped.

## Usage with Claude Code

Add the server to `~/.claude/settings.json` (or a project `.mcp.json`):

```json
{
  "mcpServers": {
    "tdarr": {
      "command": "npx",
      "args": ["-y", "@orellbuehler/tdarr-mcp"],
      "env": {
        "TDARR_URL": "http://tdarr.local:8265",
        "TDARR_API_KEY": "tapi_your_api_key"
      }
    }
  }
}
```

If you built from source instead, use `"command": "node"` with
`"args": ["/path/to/tdarr-mcp/dist/index.js"]`. Restart Claude Code and the tools are available
immediately. Verify with `claude mcp list` (should show `tdarr ✓ connected`) or `/mcp` inside a
session.

## Tools

85 tools in 11 groups, over the [Tdarr API](https://docs.tdarr.io/docs/api/).

**System** (13)

| Tool                    | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `get_status`            | Version, build date, uptime, OS. Also the connectivity/API-key check. |
| `get_server_time`       | Server clock, for interpreting the epoch timestamps on file records.  |
| `get_server_log`        | Server log, tailed to the last N lines.                               |
| `get_resource_stats`    | Live CPU, memory and heap usage of the server.                        |
| `get_db_statuses`       | Status of the Tdarr databases.                                        |
| `get_process_info`      | Process tree of server and nodes — finds stuck ffmpeg children.       |
| `get_performance_stats` | Internal timings, for diagnosing a slow server.                       |
| `check_for_update`      | Check, download and/or apply a Tdarr update. Check-only by default.   |
| `get_package_index`     | Versions the updater can install.                                     |
| `relaunch_server`       | Relaunch to finish applying a downloaded update.                      |
| `restart_server`        | Restart Tdarr Server. Interrupts running workers.                     |
| `restart_ui`            | Restart just the web UI process.                                      |
| `run_help_command`      | Run `ffmpeg`/HandBrake help to check which encoders actually exist.   |

**Nodes & workers** (9)

| Tool                     | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| `list_nodes`             | Connected nodes: name, paused state, worker limits, running workers. |
| `get_node_log`           | A node's log, tailed to the last N lines.                            |
| `get_dispatch_readiness` | Whether the server is ready to dispatch tasks.                       |
| `update_node`            | Change node settings — pause, rename, reprioritize.                  |
| `alter_worker_limit`     | Move a worker-pool limit up or down by one.                          |
| `cancel_worker_item`     | Cancel the current item; the worker keeps running.                   |
| `kill_worker`            | Kill a wedged worker outright.                                       |
| `restart_node`           | Restart a node process.                                              |
| `disconnect_node`        | Force-disconnect a node that is gone but still listed.               |

**Libraries** (13)

| Tool                     | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| `list_libraries`         | Libraries with ID, folder, priority, plugin stack or flow.         |
| `get_library`            | One library's full settings record.                                |
| `scan_library`           | Start a `scanFindNew`, `scanFresh` or `scanFolderWatcher` scan.    |
| `get_scanner_status`     | Progress of a running scan.                                        |
| `kill_scanner`           | Stop a scan mid-run.                                               |
| `remove_library_files`   | Clear a library's file records. Files on disk are untouched.       |
| `toggle_folder_watch`    | Enable/disable folder watching for one folder.                     |
| `toggle_schedule`        | Turn a range of schedule blocks on or off.                         |
| `update_schedule_block`  | Toggle a single schedule block.                                    |
| `manage_library_plugin`  | Add, remove or enable/disable a plugin in a classic stack.         |
| `manage_codec_exclusion` | Manage the basic transcode video/audio codec include/exclude list. |
| `list_subdirectories`    | Browse folders as Tdarr Server sees them.                          |
| `verify_folder_exists`   | Check a path is readable by the server.                            |

**Files** (15)

| Tool                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `search_files`           | Search the file database by name substring and size.            |
| `get_file`               | One file's full record — ffProbe, MediaInfo, history.           |
| `query_table`            | Low-level paginated UI table query with filters and sorts.      |
| `rescan_file`            | Refresh one file's scan data.                                   |
| `scan_file_details`      | Run ExifTool / MediaInfo / closed-caption scans on any path.    |
| `create_sample`          | Make a 30 second sample for testing a plugin stack or flow.     |
| `requeue_files`          | Requeue a library for transcoding or health checking.           |
| `set_staged_verdict`     | Accept or reject an item staged for approval.                   |
| `bulk_update_files`      | Merge field updates into specific file records.                 |
| `delete_file`            | Delete one file from disk and the database.                     |
| `bulk_delete_files`      | Delete several files from disk and the database.                |
| `delete_unhealthy_files` | Delete everything in the transcode-error or health-error table. |
| `delete_cache_file`      | Remove leftover output from an interrupted worker.              |
| `find_duplicates`        | Start duplicate detection by metadata or sha256.                |
| `stop_find_duplicates`   | Stop a running duplicate pass.                                  |

**Plugins** (12)

| Tool                             | Description                                            |
| -------------------------------- | ------------------------------------------------------ |
| `search_plugins`                 | Search classic plugins (Community and Local).          |
| `search_flow_plugins`            | Search the nodes available inside a flow.              |
| `search_flow_templates`          | Search ready-made flow templates.                      |
| `read_plugin`                    | Read a classic plugin's source.                        |
| `save_plugin`                    | Overwrite a local plugin's source.                     |
| `create_plugin`                  | Create a basic local plugin with the plugin creator.   |
| `copy_community_plugin_to_local` | Copy a Community plugin so it survives plugin updates. |
| `verify_plugin`                  | Check a plugin exists before wiring it into a library. |
| `delete_plugin`                  | Delete a plugin from the server.                       |
| `update_community_plugins`       | Pull the latest Community plugins.                     |
| `sync_plugins_to_nodes`          | Push the server's plugins out to every node.           |
| `list_plugin_repo_versions`      | Recent commits on the upstream plugin repo.            |

**Flows** (2)

| Tool         | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `list_flows` | Flows with ID, name, description and graph size.                   |
| `get_flow`   | One flow's complete graph — every node, its inputs, and the edges. |

**Statistics** (6)

| Tool                         | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `get_pie_stats`              | Dashboard breakdowns by status, codec, container, resolution.   |
| `get_stream_stats`           | Codecs, languages and stream types across a library.            |
| `get_space_saved`            | Space saved over time, by library, node, worker type or plugin. |
| `get_worker_verdict_history` | Success, error and not-required counts over time.               |
| `get_resource_history`       | Server CPU, memory and heap over time.                          |
| `get_worker_history`         | Running worker counts by type over time.                        |

**Job reports** (6)

| Tool                    | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `search_job_reports`    | Find job reports by filename.                                       |
| `get_job_report`        | Full worker log for a job — the ffmpeg command line and its errors. |
| `list_file_job_reports` | Every report recorded for one file, by `footprintId`.               |
| `read_job_report_file`  | Read an individual report file belonging to a job.                  |
| `delete_job_report`     | Delete one report.                                                  |
| `delete_job_reports`    | Delete reports in bulk, optionally filtered.                        |

**Backups** (5)

| Tool                  | Description                       |
| --------------------- | --------------------------------- |
| `list_backups`        | Backups with name, size and date. |
| `create_backup`       | Back up the Tdarr database.       |
| `get_backup_status`   | Progress of a backup in flight.   |
| `reset_backup_status` | Clear a stuck backup status.      |
| `delete_backup`       | Delete a backup.                  |

**Automations** (3)

| Tool               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `list_automations` | Automation configurations on the server.               |
| `get_automation`   | One automation's trigger, payload shape and targets.   |
| `run_automation`   | Trigger an automation, optionally scoped and bypassed. |

**Database** (1)

| Tool             | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `query_database` | Read-only access to collections the dedicated tools don't cover. |

## Scope and safety

- **User accounts and API keys are out of scope.** There are no tools for registering users,
  resetting passwords or reading the users and API-key collections — `query_database` cannot reach
  them either.
- **Node↔server protocol endpoints are out of scope.** Task dispatch, worker relay and plugin
  download are how Tdarr's own nodes talk to the server; exposing them to an agent only corrupts
  farm state.
- **Flows are read-only.** An agent can read and explain any flow, but flow graphs are edited in
  the Tdarr flow editor.
- **Tools that delete media are marked as such** in their descriptions — `delete_file`,
  `bulk_delete_files` and `delete_unhealthy_files` remove real files from disk. So do
  `remove_library_files` (database records only), `restart_server` and `restart_node` (interrupt
  running work). Confirm before letting an agent run them unattended.
- **Secrets stay in the environment.** The API key is read from env and sent only as the
  `x-api-key` header.

## Development

```bash
npm install
npm run build         # tsc -> dist/
npm test              # vitest run
npm run lint          # eslint src
npm run typecheck     # tsc --noEmit
npm run format        # prettier --write .
```

`tdarr-api.json` in the repo root is the Tdarr Swagger spec this server is built against; a live
copy is available from your own instance under **Tools → API Docs**.

## License

MIT — see [LICENSE](./LICENSE).
