import type {
	PublishGateFinding,
	SupabaseAdvisorLint,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { AppBackendRow } from "../../infrastructure/persistence/app-backends.repository";
import {
	jsonResponse,
	type RecordedRequest,
	scriptedFetch,
} from "../../infrastructure/supabase/fake-supabase-fetch";
import {
	ACTIVE_BACKEND_ROW,
	createBackendToolFixture,
	FAKE_REF,
} from "../host-tools/backend/fake-backend-tool-deps";
import { BackendPublishGate } from "./backend-publish-gate";

type RelationRow = {
	name: string;
	kind: "r" | "p" | "v" | "m" | "f";
	rls_enabled: boolean;
	comment: string | null;
	anon_can_select: boolean;
	has_open_anon_policy: boolean;
};

const DOCS = "https://supabase.com/docs/guides/database/database-linter?lint=";

function lint(overrides: Partial<SupabaseAdvisorLint>): SupabaseAdvisorLint {
	return {
		description: "description",
		detail: "detail",
		level: "WARN",
		name: "some_lint",
		remediation: `${DOCS}0000_some_lint`,
		title: "Some lint",
		...overrides,
	};
}

function relation(
	overrides: Partial<RelationRow> & { name: string },
): RelationRow {
	return {
		anon_can_select: false,
		comment: null,
		has_open_anon_policy: false,
		kind: "r",
		rls_enabled: true,
		...overrides,
	};
}

// The gate on the fixture's real client: the advisors answer and the
// relations answer, then the scripted anonymous REST reads.
async function runGate(input: {
	lints?: SupabaseAdvisorLint[];
	relations?: RelationRow[];
	probeAnswers?: (Response | Error)[];
	backend?: AppBackendRow | null;
}) {
	const fixture = await createBackendToolFixture({
		answers: [
			jsonResponse(200, JSON.stringify({ lints: input.lints ?? [] })),
			jsonResponse(200, JSON.stringify(input.relations ?? [])),
		],
		backend: input.backend,
	});
	const probeRequests: RecordedRequest[] = [];
	const gate = new BackendPublishGate({
		backends: fixture.deps.backends,
		captureException: () => undefined,
		client: fixture.deps.client,
		fetch: scriptedFetch(input.probeAnswers ?? [], probeRequests),
		logger: {
			error: () => undefined,
			info: () => undefined,
			warn: () => undefined,
		},
	});
	const findings = await gate.run({
		buildId: "build-1",
		files: [],
		projectId: "project-1",
	});
	return { findings, managementRequests: fixture.requests, probeRequests };
}

describe("BackendPublishGate advisors", () => {
	it.each<{
		case: string;
		lint: SupabaseAdvisorLint;
		expected: PublishGateFinding[];
	}>([
		{
			case: "an ERROR lint blocks",
			lint: lint({ level: "ERROR", name: "rls_disabled_in_public" }),
			expected: [
				{
					detail: "detail",
					kind: "advisor",
					level: "ERROR",
					lintId: "rls_disabled_in_public",
					remediationUrl: `${DOCS}0000_some_lint`,
					severity: "block",
					title: "Some lint",
				},
			],
		},
		{
			case: "a WARN lint warns",
			lint: lint({ name: "function_search_path_mutable" }),
			expected: [
				{
					detail: "detail",
					kind: "advisor",
					level: "WARN",
					lintId: "function_search_path_mutable",
					remediationUrl: `${DOCS}0000_some_lint`,
					severity: "warn",
					title: "Some lint",
				},
			],
		},
		{
			case: "the WARN lint public_bucket_allows_listing blocks",
			lint: lint({ name: "public_bucket_allows_listing" }),
			expected: [
				{
					detail: "detail",
					kind: "advisor",
					level: "WARN",
					lintId: "public_bucket_allows_listing",
					remediationUrl: `${DOCS}0000_some_lint`,
					severity: "block",
					title: "Some lint",
				},
			],
		},
		{
			case: "a WARN lint with the 0025 remediation URL blocks",
			lint: lint({
				name: "renamed_bucket_lint",
				remediation: `${DOCS}0025_public_bucket_allows_listing`,
			}),
			expected: [
				{
					detail: "detail",
					kind: "advisor",
					level: "WARN",
					lintId: "renamed_bucket_lint",
					remediationUrl: `${DOCS}0025_public_bucket_allows_listing`,
					severity: "block",
					title: "Some lint",
				},
			],
		},
		{
			case: "a remediation that is not an https URL gives no link",
			lint: lint({ remediation: "javascript:alert(1)" }),
			expected: [
				{
					detail: "detail",
					kind: "advisor",
					level: "WARN",
					lintId: "some_lint",
					remediationUrl: null,
					severity: "warn",
					title: "Some lint",
				},
			],
		},
		{
			case: "an INFO lint is dropped",
			lint: lint({ level: "INFO" }),
			expected: [],
		},
	])("$case", async ({ lint: advisorLint, expected }) => {
		const { findings } = await runGate({ lints: [advisorLint] });

		expect(findings).toEqual(expected);
	});
});

describe("BackendPublishGate anonymous probe", () => {
	it("skips a relation marked wandit:public and flags a private one that returns rows", async () => {
		const { findings, probeRequests } = await runGate({
			probeAnswers: [jsonResponse(200, JSON.stringify([{ id: 1 }]))],
			relations: [
				relation({ name: "notes" }),
				relation({
					comment: "wandit:public",
					has_open_anon_policy: true,
					name: "posts",
				}),
			],
		});

		expect(findings).toEqual([
			{
				kind: "rls_probe",
				reason: "rows_returned",
				relation: "notes",
				severity: "block",
			},
		]);
		expect(probeRequests).toHaveLength(1);
		expect(probeRequests[0]?.url).toBe(
			`https://${FAKE_REF}.supabase.co/rest/v1/notes?select=*&limit=1`,
		);
		// The anon key in both headers, and no user token.
		expect(probeRequests[0]?.headers).toMatchObject({
			apikey: "anon-key",
			authorization: "Bearer anon-key",
		});
	});

	it("gives one reason per relation: rows_returned, then no_rls, then anon_policy, then probe_timeout", async () => {
		const { findings } = await runGate({
			// The reads start in name order: a, b, c, d, e.
			probeAnswers: [
				jsonResponse(401, "{}"),
				jsonResponse(404, "{}"),
				jsonResponse(200, "[]"),
				jsonResponse(200, JSON.stringify([{ id: 1 }])),
				jsonResponse(500, JSON.stringify({ code: "57014" })),
			],
			relations: [
				// RLS off beats the open policy.
				relation({ has_open_anon_policy: true, name: "a", rls_enabled: false }),
				// A view has no RLS flag, so it is not no_rls.
				relation({ kind: "v", name: "b", rls_enabled: false }),
				relation({ has_open_anon_policy: true, name: "c" }),
				// Rows beat both other reasons.
				relation({
					has_open_anon_policy: true,
					name: "d",
					rls_enabled: false,
				}),
				// A timed-out read does not turn the block into a warning.
				relation({ name: "e", rls_enabled: false }),
			],
		});

		expect(findings).toEqual([
			{ kind: "rls_probe", reason: "no_rls", relation: "a", severity: "block" },
			{
				kind: "rls_probe",
				reason: "anon_policy",
				relation: "c",
				severity: "block",
			},
			{
				kind: "rls_probe",
				reason: "rows_returned",
				relation: "d",
				severity: "block",
			},
			{ kind: "rls_probe", reason: "no_rls", relation: "e", severity: "block" },
		]);
	});

	it("blocks a materialized view or a foreign table with the anon grant, also with no rows", async () => {
		const { findings } = await runGate({
			// The reads start in name order: a, b, c.
			probeAnswers: [
				jsonResponse(200, "[]"),
				jsonResponse(200, "[]"),
				jsonResponse(401, "{}"),
			],
			relations: [
				relation({ anon_can_select: true, kind: "m", name: "a" }),
				relation({ anon_can_select: true, kind: "f", name: "b" }),
				// Without the grant, no row reaches a visitor.
				relation({ kind: "m", name: "c" }),
			],
		});

		expect(findings).toEqual([
			{ kind: "rls_probe", reason: "no_rls", relation: "a", severity: "block" },
			{ kind: "rls_probe", reason: "no_rls", relation: "b", severity: "block" },
		]);
	});

	it.each<{ case: string; answer: Response | Error }>([
		{
			case: "the fetch times out",
			answer: new DOMException("The operation timed out.", "TimeoutError"),
		},
		{
			case: "the database stops the anon statement",
			answer: jsonResponse(500, JSON.stringify({ code: "57014" })),
		},
	])("gives probe_timeout as a warning when $case", async ({ answer }) => {
		const { findings } = await runGate({
			probeAnswers: [answer],
			relations: [relation({ name: "slow" })],
		});

		expect(findings).toEqual([
			{
				kind: "rls_probe",
				reason: "probe_timeout",
				relation: "slow",
				severity: "warn",
			},
		]);
	});

	it("probes the first 200 relations, checks the others in SQL, and warns once", async () => {
		const relations = Array.from({ length: 200 }, (_, index) =>
			relation({ name: `table_${String(index).padStart(3, "0")}` }),
		);
		relations.push(relation({ name: "table_200", rls_enabled: false }));

		const { findings, probeRequests } = await runGate({
			probeAnswers: Array.from({ length: 200 }, () => jsonResponse(404, "{}")),
			relations,
		});

		expect(findings).toEqual([
			{
				kind: "rls_probe",
				reason: "no_rls",
				relation: "table_200",
				severity: "block",
			},
			{
				kind: "rls_probe",
				reason: "probe_timeout",
				relation: null,
				severity: "warn",
			},
		]);
		expect(probeRequests).toHaveLength(200);
		expect(
			probeRequests.some((request) => request.url.includes("table_200")),
		).toBe(false);
	});

	it("fails on an unexpected REST answer instead of a pass", async () => {
		const run = runGate({
			probeAnswers: [jsonResponse(500, "{}")],
			relations: [relation({ name: "notes" })],
		});

		await expect(run).rejects.toThrow("answered HTTP 500");
	});
});

describe("BackendPublishGate without an active backend", () => {
	it("answers [] with no call when the project has no backend", async () => {
		const { findings, managementRequests, probeRequests } = await runGate({
			backend: null,
		});

		expect(findings).toEqual([]);
		expect(managementRequests).toHaveLength(0);
		expect(probeRequests).toHaveLength(0);
	});

	// Security: the build of a paused backend still holds its URL and anon
	// key, so the publish fails instead of going live unchecked.
	it.each([
		"paused",
		"restoring",
	] as const)("throws with no call for a %s backend", async (status) => {
		await expect(
			runGate({ backend: { ...ACTIVE_BACKEND_ROW, status } }),
		).rejects.toThrow(`a ${status} backend`);
	});

	it("throws when an active backend has no Management API client", async () => {
		const fixture = await createBackendToolFixture({ withClient: false });
		const gate = new BackendPublishGate({
			backends: fixture.deps.backends,
			captureException: () => undefined,
			client: null,
			fetch: scriptedFetch([], []),
			logger: {
				error: () => undefined,
				info: () => undefined,
				warn: () => undefined,
			},
		});

		await expect(
			gate.run({ buildId: "build-1", files: [], projectId: "project-1" }),
		).rejects.toThrow("no Supabase client");
	});
});
