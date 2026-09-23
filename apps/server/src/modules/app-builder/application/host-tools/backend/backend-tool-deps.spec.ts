import { runSqlToolInputSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	SupabaseManagementError,
	SupabaseRateLimitedError,
} from "../../../infrastructure/supabase/supabase-management.client";
import {
	mapClientError,
	resolveActiveBackend,
	runBackendTool,
} from "./backend-tool-deps";
import {
	ACTIVE_BACKEND_ROW,
	createBackendToolFixture,
	FAKE_REF,
} from "./fake-backend-tool-deps";

describe("resolveActiveBackend", () => {
	it("answers failed without a client and reads no row", async () => {
		let reads = 0;
		const answer = await resolveActiveBackend(
			{
				backends: {
					findByProjectId: async () => {
						reads += 1;
						return ACTIVE_BACKEND_ROW;
					},
				},
				client: null,
			},
			"project-1",
		);

		expect(answer).toEqual({
			reason: "SUPABASE_PLATFORM_TOKEN is not set",
			status: "failed",
		});
		expect(reads).toBe(0);
	});

	it("answers backend_paused for a paused row", async () => {
		const { deps } = await createBackendToolFixture({
			backend: { ...ACTIVE_BACKEND_ROW, status: "paused" },
		});

		expect(await resolveActiveBackend(deps, "project-1")).toEqual({
			status: "backend_paused",
		});
	});

	it("answers backend_not_ready without a row, while creating, and without a ref", async () => {
		for (const backend of [
			null,
			{ ...ACTIVE_BACKEND_ROW, status: "creating" as const },
			{ ...ACTIVE_BACKEND_ROW, ref: null },
		]) {
			const { deps } = await createBackendToolFixture({ backend });

			expect(await resolveActiveBackend(deps, "project-1")).toEqual({
				status: "backend_not_ready",
			});
		}
	});

	it("answers the ref and the row id of an active row", async () => {
		const { deps } = await createBackendToolFixture();

		const answer = await resolveActiveBackend(deps, "project-1");

		expect(answer).toMatchObject({
			backend: { projectId: "project-1", ref: FAKE_REF },
			backendId: "backend-1",
		});
	});
});

describe("mapClientError", () => {
	it("rounds a rate-limit wait up to whole seconds", () => {
		expect(
			mapClientError(new SupabaseRateLimitedError("bucket full", 1500)),
		).toEqual({ retryAfterSeconds: 2, status: "rate_limited" });
	});

	it("answers the upstream detail, or a plain reason without one", () => {
		expect(
			mapClientError(
				new SupabaseManagementError("answered 400", 400, null, "syntax error"),
			),
		).toEqual({ reason: "syntax error", status: "failed" });
		expect(
			mapClientError(new SupabaseManagementError("failed", null, null, null)),
		).toEqual({ reason: "Supabase did not answer", status: "failed" });
	});

	it("answers a plain reason for any other error", () => {
		expect(mapClientError(new Error("db down"))).toEqual({
			reason: "The tool failed on the server",
			status: "failed",
		});
	});
});

// One valid `run_sql` call; the schema is the real contract of the tool.
function sqlCall(tool: "run_sql" | "deploy_function" | "get_advisors") {
	return {
		input: { query: "select 1" },
		inputSchema: runSqlToolInputSchema,
		tool,
	};
}

describe("runBackendTool", () => {
	it("answers failed for an input outside the schema and never runs the body", async () => {
		const { context, deps, infos, requests } = await createBackendToolFixture();
		let bodyRuns = 0;

		const output = await runBackendTool(
			deps,
			context,
			{
				input: { query: 42 },
				inputSchema: runSqlToolInputSchema,
				tool: "run_sql",
			},
			async () => {
				bodyRuns += 1;
				return { status: "ok" };
			},
		);

		expect(output).toEqual({
			reason: expect.stringContaining("The input is not valid."),
			status: "failed",
		});
		expect(bodyRuns).toBe(0);
		expect(requests).toEqual([]);
		expect(infos[0]?.fields).toMatchObject({ ref: null, status: "failed" });
	});

	it("answers a paused backend at once and never runs the body", async () => {
		const { context, deps, infos, requests } = await createBackendToolFixture({
			backend: { ...ACTIVE_BACKEND_ROW, status: "paused" },
		});
		let bodyRuns = 0;

		const output = await runBackendTool(
			deps,
			context,
			sqlCall("run_sql"),
			async () => {
				bodyRuns += 1;
				return { status: "ok" };
			},
		);

		expect(output).toEqual({ status: "backend_paused" });
		expect(bodyRuns).toBe(0);
		expect(requests).toEqual([]);
		expect(infos).toEqual([
			{
				fields: expect.objectContaining({
					ref: null,
					status: "backend_paused",
					tool: "run_sql",
				}),
				message: "host-tool.backend",
			},
		]);
	});

	it("turns a thrown body into failed and writes the warn line", async () => {
		const { context, deps, infos, warnings } = await createBackendToolFixture();

		const output = await runBackendTool(
			deps,
			context,
			sqlCall("deploy_function"),
			async () => {
				throw new Error("sandbox gone");
			},
		);

		expect(output).toEqual({
			reason: "The tool failed on the server",
			status: "failed",
		});
		expect(warnings).toEqual([
			{
				fields: {
					message: "sandbox gone",
					projectId: "project-1",
					tool: "deploy_function",
				},
				message: "host-tool.backend.failed",
			},
		]);
		expect(infos[0]?.fields).toMatchObject({
			ref: FAKE_REF,
			status: "failed",
			tool: "deploy_function",
		});
	});

	it("answers the body output and logs the tool, the ref, and the duration", async () => {
		const { context, deps, infos } = await createBackendToolFixture();

		const output = await runBackendTool(
			deps,
			context,
			sqlCall("get_advisors"),
			async (_active, input) => ({ query: input.query, status: "ok" }),
		);

		expect(output).toEqual({ query: "select 1", status: "ok" });
		expect(infos).toHaveLength(1);
		expect(infos[0]?.fields).toMatchObject({
			durationMs: expect.any(Number),
			projectId: "project-1",
			ref: FAKE_REF,
			status: "ok",
			tool: "get_advisors",
		});
	});
});
