import { z } from "zod";
import { TdarrClient } from "../tdarr/client.js";

export type ToolHandler = (
  args: any,
) => Promise<{ content: { text: string }[]; isError?: boolean }>;

export interface Collected {
  tools: Map<string, ToolHandler>;
  schemas: Map<string, Record<string, z.ZodTypeAny>>;
  descriptions: Map<string, string>;
  client: TdarrClient;
}

export function collect(
  register: (server: any, client: TdarrClient) => void,
  client = new TdarrClient("http://tdarr.local:8265", "tapi_testkey"),
): Collected {
  const tools = new Map<string, ToolHandler>();
  const schemas = new Map<string, Record<string, z.ZodTypeAny>>();
  const descriptions = new Map<string, string>();
  const server = {
    tool: (
      name: string,
      desc: string,
      schema: Record<string, z.ZodTypeAny>,
      handler: ToolHandler,
    ) => {
      tools.set(name, handler);
      schemas.set(name, schema);
      descriptions.set(name, desc);
    },
  };
  register(server, client);
  return { tools, schemas, descriptions, client };
}

export function mockJson(body: unknown, status = 200) {
  return {
    ok: true,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

export function mockText(body: string, status = 200) {
  return {
    ok: true,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "text/plain" }),
    text: () => Promise.resolve(body),
  };
}

export function mockError(status: number, body: string) {
  return {
    ok: false,
    status,
    statusText: "Bad Request",
    headers: new Headers({ "content-type": "text/plain" }),
    text: () => Promise.resolve(body),
  };
}

export function bodyOf(mockFetch: { mock: { calls: any[][] } }, call = 0): any {
  return JSON.parse(mockFetch.mock.calls[call][1].body);
}

export function urlOf(mockFetch: { mock: { calls: any[][] } }, call = 0): string {
  return mockFetch.mock.calls[call][0];
}

export function jsonOf(res: { content: { text: string }[] }): any {
  return JSON.parse(res.content[0].text);
}
