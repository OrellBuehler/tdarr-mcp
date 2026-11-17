# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A STDIO MCP server that exposes the [Tdarr](https://home.tdarr.io/) Server API as tools for AI
agents — libraries, files, nodes and workers, plugins and flows, job reports, statistics, backups
and automations. Published to npm as `@orellbuehler/tdarr-mcp` and run via `npx`; the compiled
`dist/index.js` is the `bin` entry. See `README.md` for the tool catalog and env-var reference.

## Commands

```bash
npm run build         # tsc -> dist/
npm test              # vitest run (all tests)
npm run test:watch    # vitest watch
npm run lint          # eslint src
npm run typecheck     # tsc --noEmit
npm run format        # prettier --write .
npm run format:check  # prettier --check . (what CI runs)
```

Run a single test file or pattern:

```bash
npx vitest run src/__tests__/files.test.ts
npx vitest run -t "scan_library resolves the library folder"
```

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `typecheck`, and `test` in that order —
all must pass. The same four gates run locally on every commit via
[prek](https://github.com/j178/prek) pre-commit hooks (`.pre-commit-config.yaml`); run `prek install`
once per clone to enable them.

## Architecture

Request flow: `index.ts` reads config, builds the server via `server.ts:createServer(client,
allowDestructive)`, and connects it over stdio. Every tool calls `client.get`, `client.post` or `client.cruddb`.

- **`src/index.ts`** — entry point. Stdio transport only (single-user).
- **`src/config.ts`** — reads env at import time and **exits the process** if `TDARR_URL`/
  `TDARR_SERVER` is missing. `TDARR_API_KEY` is optional: Tdarr only requires it when the server runs
  with `auth` enabled. Normalizes the base URL and exports `client` and `config` (including
  `allowDestructive` from `TDARR_ALLOW_DESTRUCTIVE`, truthy for `true`/`1`).
- **`src/tdarr/client.ts`** — `TdarrClient`, a thin `fetch` wrapper. Auth is the `x-api-key` header,
  omitted entirely when no key is set. `fetch()` returns parsed JSON, falling back to text; an empty
  body becomes `{ success: true }`. Every request sets `redirect: "error"` so the API key is never
  forwarded to another origin. Throws on non-2xx with the response body in the message. Default
  timeout is 60s, because scans and backups are slow. `cruddb()` wraps `/api/v2/cruddb` and drops
  absent optional fields.
- **`src/tdarr/format.ts`** — shared helpers: `buildQS`, `ok`/`err` (MCP content envelopes; `ok`
  passes strings through unquoted), `pruneUndefined`, `tail` (log tailing), and the `summarizeFile`/
  `summarizeLibrary`/`summarizeNode`/`summarizeNodes`/`summarizeList` shapers.
- **`src/tools/*.ts`** — each exports a `register*Tools(server, client)` function that `server.ts`
  calls. Groups: `system`, `nodes`, `libraries`, `files`, `stats`, `plugins`, `flows`, `reports`,
  `backups`, `automations`, `db`. The groups with gated tools (`system`, `nodes`, `libraries`,
  `files`, `plugins`, `reports`, `backups`) take a third `allowDestructive` argument.
- **`src/tools/shared.ts`** — the MCP tool annotation presets: `READ`, `WRITE`, `IDEMPOTENT`,
  `DESTRUCTIVE`. Reuse these instead of writing annotation objects inline.

### Tdarr API shape

- **Almost every POST body is wrapped in a `data` envelope** — `{ data: { dbID, mode, ... } }`. The
  few that are not (`/api/v2/updater/check`, `/api/v2/public/auth/*`) take the fields at the top
  level. Follow `tdarr-api.json` rather than guessing.
- **The API uses `dbID`/`DB` for a library ID and `_id` for a file's full path.** Tool arguments are
  snake_case (`library_id`, `file_id`) and the handler maps them onto the API's own names, so the
  mapping is visible in one place.
- **Several collections are only reachable through `/api/v2/cruddb`** — libraries, flows and
  automations have no dedicated read endpoint, so `list_libraries`, `list_flows` and
  `list_automations` all go through `client.cruddb`.
- **Tdarr's file tables are positional**: `table1` transcode queue, `table2` transcode success,
  `table3` transcode error, `table4` health check queue, `table5` health check success, `table6`
  health check error. Say so in the description whenever a tool takes a table name.
- **`tdarr-api.json` is the reference spec** — consult it when adding tools. It documents paths and
  request bodies but leaves several enum-ish values undocumented (the `client/{clientType}` segment,
  `set-all-status` modes, schedule block identifiers, plugin type filters). Those are typed as free
  strings with a description saying they follow the Tdarr UI, rather than a guessed `z.enum`.

## Conventions

- **ESM with Node16 module resolution: all relative imports must end in `.js`** (e.g.
  `import { ok } from "../tdarr/format.js"`), even though the source is `.ts`.
- **Tool handler shape:** `server.tool(name, description, zodShape, annotations, async (args) => {
try { return ok(await client.post(...)); } catch (e) { return err(e); } })`. The third argument is a
  raw Zod shape object (`{}` when there are no params), the fourth one of the presets from
  `tools/shared.ts`. Match this try/catch-`ok`/`err` style exactly.
- **Every tool has annotations.** `READ` for anything that only reads, `WRITE` for reversible
  changes, `IDEMPOTENT` for reversible changes that are safe to repeat, `DESTRUCTIVE` for everything
  behind the gate. `server.test.ts` fails on a tool without them, and on a `DESTRUCTIVE` tool
  registered above the gate.
- **Destructive tools are opt-in.** Implemented as an early `if (!allowDestructive) return;` in the
  register function, with the gated tools after it, so the gating is one obvious line rather than a
  per-tool condition. Any new tool that deletes data, interrupts work, writes or distributes plugin
  code, or executes something on the host goes below that line.
- **zod 4:** `z.record` needs a key schema — `z.record(z.string(), z.unknown())`.
- **Argument validation the Zod shape cannot express returns `err(...)` before any request** — see
  `manage_library_plugin` requiring `source`+`index` for `add`, and `query_database` requiring
  `doc_id` for `getById`.
- **List tools summarize by default and take a `detailed` flag** for the raw records. Tdarr file
  records carry full ffProbe and MediaInfo payloads, so returning them unfiltered blows up the
  context window.
- **Don't add comments, docstrings, or type annotations** unless they already exist in the file
  you're editing (per global preference).
- **Secrets:** the repo is public. Never log the API key; only read it from env. Tests use a fake
  `tapi_testkey`.

## Scope

Deliberately excluded — don't add these:

- **User and API key management.** `/api/v2/admin/register`, `/api/v2/admin/reset-password`,
  `/api/v2/public/auth/*` and the `UsersJSONDB`/`ApiKeysJSONDB` collections are off limits;
  `query_database`'s collection enum excludes them and `server.test.ts` asserts that.
- **Node↔server protocol endpoints.** `get-new-task`, `item-proc-end`, `update-node-relay`,
  `poll-worker-limits`, `log-job-report`, `read-plugin`, `download-plugins`, `nodes/version-check`,
  `file/upload`, `file/download` are how Tdarr's own nodes talk to the server. An agent calling them
  corrupts farm state.
- **Flow authoring.** `list_flows`/`get_flow` are read-only. Flow graphs are node-and-edge documents
  with no published schema; writing one blind through `cruddb` produces a broken flow. Reading and
  explaining them is in scope.
- **`query_database` is read-only** — `getAll`/`getById`/`getByIndex` only. Writes go through the
  dedicated tools so the payload shape is validated and named.

### Gated behind `TDARR_ALLOW_DESTRUCTIVE`

In scope, but only registered when `allowDestructive` is true. Their descriptions must still say
plainly what they destroy so the agent asks first.

- **Destroy data:** `delete_file`, `bulk_delete_files`, `delete_unhealthy_files`,
  `delete_cache_file`, `remove_library_files`, `delete_job_report`, `delete_job_reports`,
  `delete_backup`, `delete_plugin`, and `set_staged_verdict` (accepting a staged transcode replaces
  the original).
- **Interrupt work:** `restart_server`, `relaunch_server`, `restart_ui`, `restart_node`,
  `kill_worker`, `disconnect_node`.
- **Write or distribute plugin code** — plugins are JavaScript the server and every node execute:
  `save_plugin`, `create_plugin`, `copy_community_plugin_to_local`, `update_community_plugins`,
  `sync_plugins_to_nodes`.
- **Execute on the host:** `run_help_command`.

Two tools are registered either way and change behaviour with the flag:

- **`query_table` is read-only by default.** `/api/v2/client/{clientType}` also bulk-writes
  (`opts.setAll` + `opts.updatedObj`, `opts.applyToAllStaged` + `opts.verdict`), so without the flag
  the handler only accepts the `READ_OPTS` allowlist in `tools/files.ts` and rejects every other
  `opts` key before sending anything. It is an allowlist on purpose — the endpoint is undocumented.
- **`check_for_update` only checks by default** — `download_update`/`apply_update` return `err(...)`.

Ordinary reversible writes stay ungated: scans, requeues, schedules, plugin stacks, codec lists,
worker limits, `update_node`, `cancel_worker_item`, `bulk_update_files`, `create_backup`,
`run_automation`.

## Tests

Tests live in `src/__tests__/*.test.ts`. `helpers.ts` there is shared scaffolding, not a test file:
`collect(registerXTools, allowDestructive = true)` passes a fake `{ tool: (name, desc, schema,
annotations, handler) => ... }` server to a group and returns its handlers, schemas, descriptions and
annotations; `mockJson`/`mockText`/`mockError` build
`fetch` responses; `bodyOf`/`urlOf`/`jsonOf` read back what a handler sent and returned. Tool tests
stub global `fetch` and assert the exact request path and body — that mapping from snake_case
arguments to Tdarr's field names is the thing most likely to break. `config.ts` reads env at import
time and exits if it's missing, so `config.test.ts` `vi.stubEnv(...)` then dynamically `import()`s it.

`server.test.ts` asserts the **exact list of registered tool names** per group when
`allowDestructive` is false, and the exact list the flag adds, so a new destructive tool added above
the gate fails the test. Update both lists when adding a tool.
