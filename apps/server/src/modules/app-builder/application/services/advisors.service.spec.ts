import type { SupabaseAdvisorLint } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import { jsonResponse } from "../../infrastructure/supabase/fake-supabase-fetch";
import {
	createBackendToolFixture,
	FAKE_REF,
	sentQuery,
} from "../host-tools/backend/fake-backend-tool-deps";
import { AdvisorsService } from "./advisors.service";

const BACKEND = { projectId: "project-1", ref: FAKE_REF };

// One lint of the documented `V1ProjectAdvisorsResponse` shape.
function lint(overrides: Partial<SupabaseAdvisorLint>): SupabaseAdvisorLint {
	return {
		cache_key: "key",
		categories: ["SECURITY"],
		description: "Lint description.",
		detail: "Lint detail.",
		facing: "EXTERNAL",
		level: "WARN",
		name: "function_search_path_mutable",
		remediation:
			"https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
		title: "Function Search Path Mutable",
		...overrides,
	};
}

async function runAdvisors(answers: Response[]) {
	const fixture = await createBackendToolFixture({ answers });
	if (fixture.deps.client === null) {
		throw new Error("the fixture composes a client by default");
	}
	const findings = await new AdvisorsService(fixture.deps.client).run(BACKEND);
	return { findings, requests: fixture.requests };
}

describe("AdvisorsService.run", () => {
	it("reports a public table without RLS as one error finding", async () => {
		const { findings, requests } = await runAdvisors([
			jsonResponse(200, JSON.stringify({ lints: [] })),
			jsonResponse(200, JSON.stringify({ lints: [] })),
			jsonResponse(
				201,
				JSON.stringify([{ rls_enabled: false, table_name: "notes" }]),
			),
		]);

		expect(findings).toEqual([
			{
				detail:
					"public.notes has row level security off, so every client can read and write it.",
				level: "error",
				lintId: "wandit_rls_missing",
				remediationUrl:
					"https://supabase.com/docs/guides/database/postgres/row-level-security",
				table: "public.notes",
				title: "Table without row level security policies",
			},
		]);
		expect(requests.map((request) => request.url)).toEqual([
			`https://api.supabase.com/v1/projects/${FAKE_REF}/advisors/security`,
			`https://api.supabase.com/v1/projects/${FAKE_REF}/advisors/performance`,
			`https://api.supabase.com/v1/projects/${FAKE_REF}/database/query`,
		]);
		const rlsCheck = sentQuery(requests[2]);
		expect(rlsCheck.read_only).toBe(true);
		expect(rlsCheck.query).toContain("n.nspname = 'public'");
	});

	it("reports RLS on without a policy as an error too", async () => {
		const { findings } = await runAdvisors([
			jsonResponse(200, JSON.stringify({ lints: [] })),
			jsonResponse(200, JSON.stringify({ lints: [] })),
			jsonResponse(
				201,
				JSON.stringify([{ rls_enabled: true, table_name: "orders" }]),
			),
		]);

		expect(findings[0]).toMatchObject({
			detail:
				"public.orders has row level security on but no policy, so every client request fails.",
			level: "error",
			table: "public.orders",
		});
	});

	it("maps ERROR and WARN lints with their table and drops INFO lints", async () => {
		const { findings } = await runAdvisors([
			jsonResponse(
				200,
				JSON.stringify({
					lints: [
						lint({
							detail: "Table public.notes is public, but RLS is off.",
							level: "ERROR",
							metadata: { name: "notes", schema: "public", type: "table" },
							name: "rls_disabled_in_public",
							remediation:
								"https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public",
							title: "RLS Disabled in Public",
						}),
						lint({ level: "INFO", name: "auth_leaked_password_protection" }),
					],
				}),
			),
			jsonResponse(
				200,
				JSON.stringify({
					lints: [
						lint({
							categories: ["PERFORMANCE"],
							metadata: {
								name: "notes_owner_fkey",
								schema: "public",
								type: "function",
							},
							name: "unindexed_foreign_keys",
							remediation: "see the docs",
							title: "Unindexed foreign keys",
						}),
					],
				}),
			),
			jsonResponse(201, "[]"),
		]);

		expect(findings).toEqual([
			{
				detail: "Table public.notes is public, but RLS is off.",
				level: "error",
				lintId: "rls_disabled_in_public",
				remediationUrl:
					"https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public",
				table: "public.notes",
				title: "RLS Disabled in Public",
			},
			{
				detail: "Lint detail.",
				level: "warn",
				lintId: "unindexed_foreign_keys",
				remediationUrl: null,
				table: null,
				title: "Unindexed foreign keys",
			},
		]);
	});
});
