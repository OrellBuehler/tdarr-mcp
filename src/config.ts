import { TdarrClient } from "./tdarr/client.js";

const rawUrl = (process.env.TDARR_URL || process.env.TDARR_SERVER || "").trim();
const apiKey = (process.env.TDARR_API_KEY || "").trim();

if (!rawUrl) {
  console.error(
    "TDARR_URL (or TDARR_SERVER) environment variable is required, e.g. http://tdarr.local:8265. " +
      "Set TDARR_API_KEY as well if the server runs with auth enabled (Tools > API Keys).",
  );
  process.exit(1);
}

export function normalizeBaseUrl(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `http://${url}`;
  return withScheme.replace(/\/+$/, "");
}

const baseUrl = normalizeBaseUrl(rawUrl);

export const config = {
  baseUrl,
  apiKey,
  transport: "stdio" as const,
};

export const client = new TdarrClient(baseUrl, apiKey);
