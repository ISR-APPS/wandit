import { describe, expect, it } from "vitest";

import { jsonResponse } from "../../../infrastructure/supabase/fake-supabase-fetch";
import {
	ACTIVE_BACKEND_ROW,
	createBackendToolFixture,
	executeTool,
} from "./fake-backend-tool-deps";
import { createGetAdvisorsTool } from "./get-advisors.host-tool";

describe("get_advisors", () => {
	it("reports a public table without RLS as an error finding", async () => {
		const fixture = await createBackendToolFixture({
			answers: [
				jsonResponse(200, JSON.stringify({ lints: [] })),
				jsonResponse(200, JSON.stringify({ lints: [] })),
				jsonResponse(
					201,
					JSON.stringify([{ rls_enabled: false, table_name: "notes" }]),
				),
			],
		});
		const tool = createGetAdvisorsTool(fixture.deps, fixture.context);

		const output = await executeTool(tool, {});

		expect(output).toMatchObject({
			findings: [
				{ level: "error", lintId: "wandit_rls_missing", table: "public.notes" },
			],
			status: "ok",
		});
	});

	it("answers a paused backend at once and calls no upstream", async () => {
		const fixture = await createBackendToolFixture({
			backend: { ...ACTIVE_BACKEND_ROW, status: "paused" },
		});
		const tool = createGetAdvisorsTool(fixture.deps, fixture.context);

		expect(await executeTool(tool, {})).toEqual({ status: "backend_paused" });
		expect(fixture.requests).toEqual([]);
	});
});
