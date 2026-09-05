export function buildQS(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        sp.append(k, String(item));
      }
    } else {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function ok(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text" as const, text }] };
}

export function err(e: unknown) {
  return { content: [{ type: "text" as const, text: String(e) }], isError: true as const };
}

export function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export interface TdarrFile {
  _id?: string;
  file?: string;
  DB?: string;
  footprintId?: string;
  container?: string;
  file_size?: number;
  video_codec_name?: string;
  video_resolution?: string;
  audio_codec_name?: string;
  bit_rate?: number;
  duration?: number;
  HealthCheck?: string;
  TranscodeDecisionMaker?: string;
  lastHealthCheckDate?: number;
  lastTranscodeDate?: number;
  createdAt?: number;
  holdUntil?: number;
  bumped?: boolean;
  [key: string]: unknown;
}

export interface TdarrLibrary {
  _id?: string;
  name?: string;
  folder?: string;
  priority?: number;
  type?: string;
  pluginStackType?: string;
  processLibrary?: boolean;
  scanOnStart?: boolean;
  folderWatching?: boolean;
  useFsEvents?: boolean;
  flowId?: string;
  pluginIDs?: unknown[];
  containerFilter?: unknown;
  cache?: string;
  output?: string;
  [key: string]: unknown;
}

export interface TdarrNode {
  _id?: string;
  nodeName?: string;
  nodePaused?: boolean;
  nodeVersion?: string;
  os?: unknown;
  remoteAddress?: string;
  priority?: number;
  workerLimits?: Record<string, unknown>;
  workers?: Record<string, unknown>;
  resStats?: Record<string, unknown>;
  [key: string]: unknown;
}

export function summarizeFile(f: TdarrFile): Record<string, unknown> {
  return pruneUndefined({
    _id: f._id ?? f.file,
    file: f.file,
    library: f.DB,
    container: f.container,
    sizeMB: f.file_size,
    durationSec: f.duration,
    bitRate: f.bit_rate,
    video: f.video_codec_name,
    resolution: f.video_resolution,
    audio: f.audio_codec_name,
    transcodeStatus: f.TranscodeDecisionMaker,
    healthStatus: f.HealthCheck,
    lastTranscodeDate: f.lastTranscodeDate,
    lastHealthCheckDate: f.lastHealthCheckDate,
    holdUntil: f.holdUntil,
    bumped: f.bumped || undefined,
  });
}

export function summarizeLibrary(l: TdarrLibrary): Record<string, unknown> {
  return pruneUndefined({
    _id: l._id,
    name: l.name,
    folder: l.folder,
    priority: l.priority,
    type: l.pluginStackType ?? l.type,
    flowId: l.flowId,
    pluginCount: Array.isArray(l.pluginIDs) ? l.pluginIDs.length : undefined,
    processLibrary: l.processLibrary,
    scanOnStart: l.scanOnStart,
    folderWatching: l.folderWatching,
    cache: l.cache,
    output: l.output,
  });
}

export function summarizeNode(n: TdarrNode): Record<string, unknown> {
  const workers = n.workers ?? {};
  return pruneUndefined({
    _id: n._id,
    nodeName: n.nodeName,
    nodePaused: n.nodePaused,
    nodeVersion: n.nodeVersion,
    remoteAddress: n.remoteAddress,
    priority: n.priority,
    workerLimits: n.workerLimits,
    runningWorkers: Object.keys(workers).length,
    resStats: n.resStats,
  });
}

export function summarizeNodes(data: unknown, detailed?: boolean): unknown {
  if (detailed || !data || typeof data !== "object") return data;
  const out: Record<string, unknown> = {};
  for (const [id, node] of Object.entries(data as Record<string, TdarrNode>)) {
    out[id] = summarizeNode(node);
  }
  return out;
}

export function summarizeList<T>(
  data: unknown,
  fn: (item: T) => Record<string, unknown>,
  detailed?: boolean,
): unknown {
  if (detailed) return data;
  if (Array.isArray(data)) return data.map((item) => fn(item as T));
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.array)) {
      return { ...obj, array: obj.array.map((item) => fn(item as T)) };
    }
  }
  return data;
}

export function tail(text: string, lines?: number): string {
  const n = lines ?? 100;
  if (n <= 0) return text;
  return text.split("\n").slice(-n).join("\n");
}
