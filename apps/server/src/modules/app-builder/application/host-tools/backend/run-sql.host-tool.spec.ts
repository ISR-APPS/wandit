import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { jsonResponse } from "../../../infrastructure/supabase/fake-supabase-fetch";
import {
	createBackendToolFixture,
	executeTool,
	sentQuery,
} from "./fake-backend-tool-deps";
import { createRunSqlTool, createRunSqlWriteTool } from "./run-sql.host-tool";

const UPDATE = "UPDATE public.notes SET title = 'done' WHERE id = 1";

describe("run_sql", () => {
	it("runs a select at once as read-only and stops at 200 rows", async () => {
		const rows = Array.from({ length: 250 }, (_, index) => ({ id: index }));
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, JSON.stringify(rows))],
		});
		const tool = createRunSqlTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {
			query: "select id from public.notes",
		});

		expect(output).toMatchObject({
			kind: "read",
			rowCount: 200,
			status: "ok",
			truncated: true,
		});
		expect(output.status === "ok" ? output.rows : []).toHaveLength(200);
		expect(sentQuery(fixture.requests[0])).toEqual({
			query: "select id from public.notes",
			read_only: true,
		});
		expect(fixture.audits).toEqual([]);
	});

	it("waits for approval on an UPDATE and sends no query", async () => {
		const fixture = await createBackendToolFixture();
		const tool = createRunSqlTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { query: UPDATE })).toEqual({
			status: "needs_approval",
			tool: "run_sql_write",
		});
		expect(fixture.requests).toEqual([]);
	});

	it("answers rate_limited at once when the project bucket is full", async () => {
		const fixture = await createBackendToolFixture({
			rateLimiterWaits: [3000],
		});
		const tool = createRunSqlTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, { query: "select 1" })).toEqual({
			retryAfterSeconds: 3,
			status: "rate_limited",
		});
		expect(fixture.requests).toEqual([]);
	});
});

describe("run_sql_write", () => {
	it("runs the approved UPDATE as a write and audits the hash, never the text", async () => {
		const rows = Array.from({ length: 250 }, (_, index) => ({ id: index }));
		const fixture = await createBackendToolFixture({
			answers: [jsonResponse(201, JSON.stringify(rows))],
		});
		const tool = createRunSqlWriteTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, { query: UPDATE });

		expect(output).toMatchObject({
			kind: "write",
			rowCount: 200,
			status: "ok",
			truncated: true,
		});
		expect(sentQuery(fixture.requests[0])).toEqual({
			query: UPDATE,
			read_only: false,
		});
		expect(fixture.audits).toEqual([
			{
				action: "backend.sql_written",
				actorUserId: "user-1",
				// returnedRows holds the rows the endpoint answered, not the kept rows;
				// an UPDATE without RETURNING answers none.
				metadata: {
					queryHash: createHash("sha256").update(UPDATE).digest("hex"),
					returnedRows: 250,
				},
				organizationId: "org-1",
				projectId: "project-1",
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
		expect(JSON.stringify(fixture.audits)).not.toContain("SET title");
	});
});
