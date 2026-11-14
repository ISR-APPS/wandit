import {
	type GateFinding,
	SECURITY_FINDING_TEXT_MAX,
	SECURITY_SCAN_MAX_FINDINGS,
	type SecurityScanFinding,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	codeFindingsOf,
	databaseFindingsOf,
	dependencyFindingsOf,
	securityScanReportOf,
} from "./security-scan";

// One advisory of the `pnpm audit --json` output shape.
function advisory(
	id: number,
	severity: string,
	findings: { version: string; paths: string[]; dev?: boolean }[],
) {
	return {
		findings,
		id,
		module_name: `pkg-${id}`,
		patched_versions: ">=2.0.0",
		severity,
		title: `Advisory ${id}`,
		url: `https://github.com/advisories/GHSA-${id}`,
		vulnerable_versions: "<2.0.0",
	};
}

const OK_CHECK = { reason: null, state: "ok" } as const;
const ALL_OK = { code: OK_CHECK, database: OK_CHECK, dependency: OK_CHECK };

function finding(
	id: string,
	severity: SecurityScanFinding["severity"],
): SecurityScanFinding {
	return {
		detail: "",
		fix: "",
		id,
		location: null,
		severity,
		source: "code",
		status: severity === null ? "needs_review" : "confirmed",
		title: id,
		url: null,
	};
}

describe("dependencyFindingsOf", () => {
	it.each([
		["text that is not JSON", "ERR_PNPM_AUDIT_BAD_RESPONSE"],
		["JSON without advisories", JSON.stringify({ error: { code: "E500" } })],
		[
			"an advisory without a field",
			JSON.stringify({ advisories: { "1": { id: 1 } } }),
		],
	])("answers null for %s", (_name, stdout) => {
		expect(dependencyFindingsOf(stdout)).toBeNull();
	});

	it("keeps critical and high advisories that reach a shipped dependency", () => {
		const stdout = JSON.stringify({
			advisories: {
				"1": advisory(1, "critical", [
					{ dev: true, paths: [".>vitest>pkg-1"], version: "1.0.0" },
					{ dev: false, paths: [".>next>pkg-1"], version: "1.2.0" },
				]),
				"2": advisory(2, "high", [
					{ dev: true, paths: [".>vitest>pkg-2"], version: "1.0.0" },
				]),
				"3": advisory(3, "moderate", [
					{ paths: [".>pkg-3"], version: "1.0.0" },
				]),
				"4": advisory(4, "low", [{ paths: [".>pkg-4"], version: "1.0.0" }]),
			},
		});

		// 2 is dev-only, 3 and 4 are below high: the product rule drops them.
		expect(dependencyFindingsOf(stdout)).toEqual([
			{
				detail: "Vulnerable versions: <2.0.0. Dependency path: .>next>pkg-1.",
				fix: "Upgrade pkg-1 to >=2.0.0.",
				id: "dependency:1",
				location: "pkg-1@1.2.0",
				severity: "critical",
				source: "dependency",
				status: "confirmed",
				title: "Advisory 1",
				url: "https://github.com/advisories/GHSA-1",
			},
		]);
	});
});

describe("databaseFindingsOf", () => {
	it.each([
		["wandit_rls_missing", "error", "critical"],
		["rls_disabled_in_public", "error", "high"],
		["function_search_path_mutable", "warn", "medium"],
	] as const)("maps %s at level %s to %s", (lintId, level, severity) => {
		const gate: GateFinding = {
			detail: "Detail.",
			level,
			lintId,
			remediationUrl: "https://supabase.com/docs/x",
			table: "public.todos",
			title: "Title",
		};

		expect(databaseFindingsOf([gate])[0]).toMatchObject({
			id: `database:${lintId}:public.todos`,
			location: "public.todos",
			severity,
			url: "https://supabase.com/docs/x",
		});
	});
});

describe("codeFindingsOf", () => {
	it.each([
		["text that is not JSON", "{"],
		["an object, not an array", JSON.stringify({ findings: [] })],
	])("answers null for %s", (_name, text) => {
		expect(codeFindingsOf(text)).toBeNull();
	});

	it("maps confirmed and needs_validation records and skips the others", () => {
		const trace = [
			{ file: "src/routes/api.ts", kind: "entrypoint", line: 3 },
			{ file: "src/lib/db.ts", kind: "sink", line: 42 },
		];
		const text = JSON.stringify([
			{
				description: "Any user reads every order.\u0000",
				fingerprint: "fp-1",
				remediation: { strategy: "Filter by the user id." },
				severity: { overall_severity: "informational" },
				title: "Orders leak",
				trace,
				verdict: "confirmed",
			},
			{
				blockers: ["run the app", "read the policy"],
				description: "The token may reach the bundle.",
				fingerprint: "fp-2",
				title: "Token in bundle",
				trace,
				verdict: "needs_validation",
			},
			{ fingerprint: "fp-3", verdict: "rejected" },
			// No trace: the record fails the schema and is skipped.
			{ fingerprint: "fp-4", title: "Bad", verdict: "confirmed" },
		]);

		expect(codeFindingsOf(text)).toEqual({
			findings: [
				{
					// U+0000 goes: Postgres jsonb refuses it.
					detail: "Any user reads every order.",
					fix: "Filter by the user id.",
					id: "code:fp-1",
					location: "src/lib/db.ts:42",
					severity: "info",
					source: "code",
					status: "confirmed",
					title: "Orders leak",
					url: null,
				},
				{
					detail: "The token may reach the bundle.",
					fix: "To check: run the app; read the policy",
					id: "code:fp-2",
					location: "src/lib/db.ts:42",
					severity: null,
					source: "code",
					status: "needs_review",
					title: "Token in bundle",
					url: null,
				},
			],
			invalidRecords: 1,
		});
	});

	it("cuts a long text without splitting a surrogate pair", () => {
		// The emoji is two UTF-16 units and starts at the last allowed unit.
		const description = `${"a".repeat(SECURITY_FINDING_TEXT_MAX - 1)}😀tail`;
		const text = JSON.stringify([
			{
				blockers: ["x"],
				description,
				fingerprint: "fp-1",
				title: "Long",
				trace: [{ file: "a.ts", kind: "sink", line: 1 }],
				verdict: "needs_validation",
			},
		]);

		expect(codeFindingsOf(text)?.findings[0]?.detail).toBe(
			"a".repeat(SECURITY_FINDING_TEXT_MAX - 1),
		);
	});
});

describe("securityScanReportOf", () => {
	it("sorts by severity with needs_review last, keeps ids unique, and orders the checks", () => {
		const report = securityScanReportOf({
			checks: {
				code: { reason: "findings_missing", state: "failed" },
				database: { reason: "no_backend", state: "skipped" },
				dependency: OK_CHECK,
			},
			findings: [
				finding("review", null),
				finding("low", "low"),
				finding("dup", "critical"),
				finding("dup", "high"),
			],
		});

		expect(report.findings.map((item) => item.id)).toEqual([
			"dup",
			"dup:2",
			"low",
			"review",
		]);
		expect(report.checks).toEqual([
			{ reason: "no_backend", source: "database", state: "skipped" },
			{ reason: null, source: "dependency", state: "ok" },
			{ reason: "findings_missing", source: "code", state: "failed" },
		]);
	});

	it("keeps only the most severe findings past the cap", () => {
		const findings = [
			...Array.from({ length: SECURITY_SCAN_MAX_FINDINGS }, (_, index) =>
				finding(`info-${index}`, "info"),
			),
			finding("critical", "critical"),
		];

		const report = securityScanReportOf({ checks: ALL_OK, findings });

		expect(report.findings).toHaveLength(SECURITY_SCAN_MAX_FINDINGS);
		expect(report.findings[0]?.id).toBe("critical");
	});
});
