import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../tdarr/format.js";
import type { TdarrClient } from "../tdarr/client.js";

export function registerReportTools(server: McpServer, client: TdarrClient) {
  server.tool(
    "search_job_reports",
    "Search the job reports on the server by filename (POST /api/v2/search-job-reports). Returns the matching report filenames and their last-modified time; read one with get_job_report.",
    {
      search: z.string().describe("Search terms matched against report filenames"),
    },
    async ({ search }) => {
      try {
        return ok(
          await client.post("/api/v2/search-job-reports", { data: { searchTerms: search } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_job_report",
    "Get a job report by job ID (GET /api/v2/job-reports/{jobId}) — the full worker log for that job plus its metadata, including whether the job is still running. This is where the ffmpeg command line and its errors live, so read it first when a transcode fails.",
    {
      job_id: z.string().describe("Job ID"),
    },
    async ({ job_id }) => {
      try {
        return ok(await client.get(`/api/v2/job-reports/${encodeURIComponent(job_id)}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_file_job_reports",
    "List every job report recorded for one file (POST /api/v2/list-footprintId-reports). The footprintId is on the file record from get_file, and identifies the file across renames and transcodes.",
    {
      footprint_id: z.string().describe("File footprintId, from get_file"),
    },
    async ({ footprint_id }) => {
      try {
        return ok(
          await client.post("/api/v2/list-footprintId-reports", {
            data: { footprintId: footprint_id },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "read_job_report_file",
    "Read one report file belonging to a job (POST /api/v2/read-job-file). Use it for the individual files listed by list_file_job_reports when a job produced more than one report.",
    {
      footprint_id: z.string().describe("File footprintId, from get_file"),
      job_id: z.string().describe("Job ID"),
      job_file_id: z.string().describe("Report file ID, from list_file_job_reports"),
    },
    async ({ footprint_id, job_id, job_file_id }) => {
      try {
        return ok(
          await client.post("/api/v2/read-job-file", {
            data: { footprintId: footprint_id, jobId: job_id, jobFileId: job_file_id },
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_job_report",
    "Delete one job report from the database and from disk (POST /api/v2/delete-job-report).",
    {
      job_id: z.string().describe("Job ID of the report to delete"),
    },
    async ({ job_id }) => {
      try {
        return ok(await client.post("/api/v2/delete-job-report", { data: { jobId: job_id } }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_job_reports",
    "Delete job reports in bulk (POST /api/v2/delete-job-reports). With no filters this deletes every report — pass filters to narrow it, and confirm with the user first.",
    {
      filters: z
        .array(z.object({ id: z.string(), value: z.string() }))
        .optional()
        .describe("Filters selecting which reports to delete; omit to delete all of them"),
    },
    async ({ filters }) => {
      try {
        return ok(
          await client.post("/api/v2/delete-job-reports", { data: { filters: filters ?? [] } }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );
}
