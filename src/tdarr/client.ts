export type CrudMode =
  | "getById"
  | "getByIndex"
  | "getAll"
  | "insert"
  | "update"
  | "incdec"
  | "removeOne"
  | "removeByDB"
  | "removeAll";

export interface CrudRequest {
  collection: string;
  mode: CrudMode;
  docID?: string;
  obj?: Record<string, unknown>;
  filters?: { id: string; value: string }[];
}

export class TdarrClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;

  constructor(baseUrl: string, apiKey: string, timeoutMs = 60000) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private headers(options: RequestInit): Record<string, string> {
    return {
      Accept: "application/json",
      ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    };
  }

  private async request(path: string, options: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: this.headers(options),
        redirect: "error",
        signal: options.signal ?? AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new Error(`Tdarr request timed out after ${this.timeoutMs}ms`, { cause: e });
      }
      throw e;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }
    return res;
  }

  async fetch(path: string, options: RequestInit = {}): Promise<unknown> {
    const res = await this.request(path, options);
    if (res.status === 204) return { success: true };
    const text = await res.text();
    if (!text) return { success: true };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return text;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async fetchText(path: string, options: RequestInit = {}): Promise<string> {
    return (await this.request(path, options)).text();
  }

  get(path: string): Promise<unknown> {
    return this.fetch(path);
  }

  post(path: string, body?: unknown): Promise<unknown> {
    return this.fetch(path, {
      method: "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  cruddb(req: CrudRequest): Promise<unknown> {
    const data: Record<string, unknown> = { collection: req.collection, mode: req.mode };
    if (req.docID !== undefined) data.docID = req.docID;
    if (req.obj !== undefined) data.obj = req.obj;
    if (req.filters !== undefined) data.filters = req.filters;
    return this.post("/api/v2/cruddb", { data });
  }
}
