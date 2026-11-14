/**
 * The pure rules of a `security_scan` builder turn. `runBuilderTurn`
 * (builder-turn.runtime.ts) calls them: the scan prompt, the mapping of the
 * two host checks (backend advisors, `pnpm audit`), the mapping of the skill
 * `findings.json`, and the report sort and cap. No I/O here.
 */
import {
	type GateFinding,
	pnpmAuditOutputSchema,
	SECURITY_FINDING_TEXT_MAX,
	SECURITY_SCAN_MAX_FINDINGS,
	type SecurityAuditRecord,
	type SecurityFindingSeverity,
	type SecurityScanCheck,
	type SecurityScanCounts,
	type SecurityScanFinding,
	type SecurityScanReport,
	type SecurityScanSource,
	securityAuditRecordSchema,
	securityFindingSeverities,
	securityScanReportSchema,
	securityScanSources,
	type TargetPlatform,
} from "@wandit/contracts";

/**
 * Sandbox folder of the vendored Cloudflare skill. The runtime writes the
 * files of `templates/skills/security-audit/` here before the agent starts.
 * `/tmp` is outside the project, so the turn commit never holds them.
 */
export const SECURITY_AUDIT_SKILL_DIR = "/tmp/wandit/security-audit-skill";

/**
 * Sandbox output folder of one scan turn. The agent writes the skill files
 * there; the settle reads `findings.json` from it. Outside the project too.
 */
export function securityScanOutputDirOf(turnId: string): string {
	return `/tmp/wandit/security-scan/${turnId}`;
}

// The schema limits of `securityScanFindingSchema`. A longer text is cut,
// so one long agent text never fails the whole report parse.
const FINDING_ID_MAX = 300;
const FINDING_TITLE_MAX = 300;
const FINDING_LOCATION_MAX = 500;

/**
 * The stack facts of each platform for the agent. They tell the agent which
 * keys are public by design, so it does not report them.
 */
const STACK_FACTS: Record<TargetPlatform, string> = {
	web: "Stack: a TanStack Start web app on Cloudflare Workers with a Supabase backend. The Supabase anon key in client code is public by design: do not report it. A service-role key or any other secret must never reach client code or a client bundle. Row level security must protect every table of the public schema.",
	mobile:
		"Stack: an Expo mobile app with a Supabase backend. The Supabase anon key in the app is public by design: do not report it. A service-role key or any other secret must never reach the app bundle. Row level security must protect every table of the public schema.",
	desktop:
		"Stack: a Tauri desktop app for Windows and macOS with a local SQLite database and no cloud backend. Any secret in the frontend bundle is readable by every user of the app.",
};

/**
 * The rules in front of the user's message of a `security_scan` turn. They
 * go in the prompt, never in the instructions: the instructions are the key
 * of the Claude Code process, and a scan must not change it.
 */
export function securityScanPromptOf(input: {
	/** The scan turn; it names the output folder. */
	turnId: string;
	/** `projects.target_platform`, from the template profile of the project. */
	platform: TargetPlatform;
	/** What the host checks found before the agent starts. */
	hostFindings: readonly SecurityScanFinding[];
}): string {
	const outputDir = securityScanOutputDirOf(input.turnId);
	const hostLines =
		input.hostFindings.length === 0
			? ["none"]
			: input.hostFindings.map(
					(finding) =>
						`- ${finding.severity ?? "needs review"}: ${finding.title} (${finding.location ?? "no location"})`,
				);
	return [
		`This turn is a security scan. Read ${SECURITY_AUDIT_SKILL_DIR}/SKILL.md and follow its full audit mode with the \`quick\` profile. Do not ask the user about the mode, the profile, or the budget.`,
		`Target: the project root, which is your current directory. Output directory: ${outputDir}. It is outside the project.`,
		"Write files only in the output directory. Do not change, add, or delete a project file: the host commits every change in the project folder.",
		"This session has no Task tool. You are the parent agent: do every role of the skill yourself, in order. Verify each candidate in a separate, skeptical second read that tries to disprove it. Ignore the agent budget rules.",
		"This sandbox does not meet the OS sandbox controls of the skill. So do not run the app, its tests, a build, a package script, or any project code. Do a source review only. Record a lead that needs execution as `needs_validation`, as the skill says. Do not send requests to deployed endpoints.",
		...(input.platform === "desktop"
			? []
			: [
					"You can call get_advisors and run_sql (read only) to read the database tables and policies.",
				]),
		STACK_FACTS[input.platform],
		"The host already ran these checks. Do not repeat them:",
		...hostLines,
		`At the end, run \`node ${SECURITY_AUDIT_SKILL_DIR}/validate-findings.cjs ${outputDir}/findings.json\`. Fix findings.json until the script prints PASS.`,
		"Then answer the user in 3 to 6 short sentences, for a non-technical reader: what you checked and the main risks. Do not list the findings: the app shows them.",
	].join("\n");
}

/**
 * The `database` findings of the Supabase security advisors and the wandit
 * RLS check (`AdvisorsService.runSecurity`).
 */
export function databaseFindingsOf(
	findings: readonly GateFinding[],
): SecurityScanFinding[] {
	return findings.map((finding) => ({
		detail: cutText(finding.detail, SECURITY_FINDING_TEXT_MAX),
		fix: "",
		id: cutText(
			`database:${finding.lintId}:${finding.table ?? "-"}`,
			FINDING_ID_MAX,
		),
		location:
			finding.table === null
				? null
				: cutText(finding.table, FINDING_LOCATION_MAX),
		// Product rule: a table that every client can read or write is the
		// worst case, so the wandit RLS check outranks a Supabase error.
		severity:
			finding.lintId === "wandit_rls_missing"
				? "critical"
				: finding.level === "error"
					? "high"
					: "medium",
		source: "database",
		status: "confirmed",
		title: titleOf(finding.title),
		url: httpsUrlOrNull(finding.remediationUrl),
	}));
}

/**
 * The `dependency` findings of the stdout of `pnpm audit --json --prod`, or
 * null when the output is not JSON or not the audit shape.
 */
export function dependencyFindingsOf(
	stdout: string,
): SecurityScanFinding[] | null {
	let json: unknown;
	try {
		json = JSON.parse(stdout);
	} catch {
		// Not JSON: pnpm printed an error text. The caller marks the check failed.
		return null;
	}
	const parsed = pnpmAuditOutputSchema.safeParse(json);
	if (!parsed.success) {
		return null;
	}
	return Object.values(parsed.data.advisories).flatMap(
		(advisory): SecurityScanFinding[] => {
			// Product rule (like Lovable): only critical and high advisories count.
			if (advisory.severity !== "critical" && advisory.severity !== "high") {
				return [];
			}
			// `--prod` already skips dev dependencies. A package that only dev
			// dependencies reach never ships to the user, so it is dropped too.
			const shipped = advisory.findings.find((finding) => finding.dev !== true);
			if (advisory.findings.length > 0 && shipped === undefined) {
				return [];
			}
			const path = shipped?.paths[0];
			return [
				{
					detail: cutText(
						`Vulnerable versions: ${advisory.vulnerable_versions}.${path === undefined ? "" : ` Dependency path: ${path}.`}`,
						SECURITY_FINDING_TEXT_MAX,
					),
					fix: cutText(
						`Upgrade ${advisory.module_name} to ${advisory.patched_versions}.`,
						SECURITY_FINDING_TEXT_MAX,
					),
					id: cutText(`dependency:${advisory.id}`, FINDING_ID_MAX),
					location: cutText(
						shipped === undefined
							? advisory.module_name
							: `${advisory.module_name}@${shipped.version}`,
						FINDING_LOCATION_MAX,
					),
					severity: advisory.severity,
					source: "dependency",
					status: "confirmed",
					title: titleOf(advisory.title),
					url: httpsUrlOrNull(advisory.url),
				},
			];
		},
	);
}

/** The `code` findings of one `findings.json` text, plus the count of records that failed the parse. */
export type CodeFindingsResult = {
	findings: SecurityScanFinding[];
	/** Records that failed `securityAuditRecordSchema`; the runtime logs the count. */
	invalidRecords: number;
};

/**
 * The `code` findings of the skill `findings.json` that the agent wrote, or
 * null when the text is not JSON or not an array. The agent writes the file,
 * so each record is untrusted: an invalid record is skipped, not fatal.
 */
export function codeFindingsOf(text: string): CodeFindingsResult | null {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		// Not JSON: the caller marks the check failed.
		return null;
	}
	if (!Array.isArray(json)) {
		return null;
	}
	const findings: SecurityScanFinding[] = [];
	let invalidRecords = 0;
	for (const raw of json) {
		const parsed = securityAuditRecordSchema.safeParse(raw);
		if (!parsed.success) {
			invalidRecords += 1;
			continue;
		}
		const finding = codeFindingOf(parsed.data);
		if (finding !== null) {
			findings.push(finding);
		}
	}
	return { findings, invalidRecords };
}

/** One skill record as a finding; null for a `rejected` record. */
function codeFindingOf(
	record: SecurityAuditRecord,
): SecurityScanFinding | null {
	if (record.verdict === "rejected") {
		return null;
	}
	// The last trace step is the sink: the line where the harm happens.
	const sink = record.trace[record.trace.length - 1];
	const common = {
		detail: cutText(record.description, SECURITY_FINDING_TEXT_MAX),
		id: cutText(`code:${record.fingerprint}`, FINDING_ID_MAX),
		location:
			sink === undefined
				? null
				: cutText(`${sink.file}:${sink.line}`, FINDING_LOCATION_MAX),
		source: "code" as const,
		title: titleOf(record.title),
		url: null,
	};
	if (record.verdict === "confirmed") {
		const score = record.severity.overall_severity;
		return {
			...common,
			fix: cutText(record.remediation.strategy, SECURITY_FINDING_TEXT_MAX),
			// The skill says "informational"; the report says "info".
			severity: score === "informational" ? "info" : score,
			status: "confirmed",
		};
	}
	return {
		...common,
		fix: cutText(
			`To check: ${record.blockers.join("; ")}`,
			SECURITY_FINDING_TEXT_MAX,
		),
		// The trace is not complete, so the skill gives no severity.
		severity: null,
		status: "needs_review",
	};
}

/** The state of one check, before the report adds its source. */
export type SecurityScanCheckResult = Omit<SecurityScanCheck, "source">;

/**
 * The stored report: the findings most severe first, then `needs_review`,
 * cut to `SECURITY_SCAN_MAX_FINDINGS`, with one check per source in
 * `securityScanSources` order. The final parse proves the shape; a throw
 * here is a bug in this file.
 */
export function securityScanReportOf(input: {
	/** Host findings first, then code findings; the sort keeps that order inside one severity. */
	findings: readonly SecurityScanFinding[];
	checks: Record<SecurityScanSource, SecurityScanCheckResult>;
}): SecurityScanReport {
	const sorted = [...input.findings].sort(
		(left, right) => severityRank(left.severity) - severityRank(right.severity),
	);
	return securityScanReportSchema.parse({
		checks: securityScanSources.map((source) => ({
			...input.checks[source],
			source,
		})),
		findings: withUniqueIds(sorted.slice(0, SECURITY_SCAN_MAX_FINDINGS)),
	});
}

/** The chat card counts of one report: one per severity, plus `needsReview`. */
export function securityScanCountsOf(
	findings: readonly SecurityScanFinding[],
): SecurityScanCounts {
	const counts: SecurityScanCounts = {
		critical: 0,
		high: 0,
		info: 0,
		low: 0,
		medium: 0,
		needsReview: 0,
	};
	for (const finding of findings) {
		if (finding.severity === null) {
			counts.needsReview += 1;
		} else {
			counts[finding.severity] += 1;
		}
	}
	return counts;
}

/** 0 for `critical` up to 4 for `info`; a `needs_review` finding (no severity) sorts last. */
function severityRank(severity: SecurityFindingSeverity | null): number {
	return severity === null
		? securityFindingSeverities.length
		: securityFindingSeverities.indexOf(severity);
}

/**
 * Adds `:2`, `:3` to a repeated id. Two advisor lints of one kind on two
 * functions both have the table `-`, and the web keys each finding by id.
 */
function withUniqueIds(
	findings: readonly SecurityScanFinding[],
): SecurityScanFinding[] {
	const seen = new Map<string, number>();
	return findings.map((finding) => {
		const count = (seen.get(finding.id) ?? 0) + 1;
		seen.set(finding.id, count);
		// The cut leaves room for `:100`, the suffix at the findings cap.
		return count === 1
			? finding
			: {
					...finding,
					id: `${finding.id.slice(0, FINDING_ID_MAX - 4)}:${count}`,
				};
	});
}

/** A trimmed title within the schema limit; an empty title gets a generic one. */
function titleOf(text: string): string {
	return cutText(text.trim(), FINDING_TITLE_MAX) || "Untitled finding";
}

/**
 * `text` without U+0000, cut to `max` UTF-16 units. Postgres jsonb refuses
 * U+0000 and a lone surrogate, so the cut never splits a surrogate pair.
 */
function cutText(text: string, max: number): string {
	const clean = text.replaceAll("\u0000", "");
	if (clean.length <= max) {
		return clean;
	}
	const cut = clean.slice(0, max);
	const last = cut.charCodeAt(cut.length - 1);
	// 0xD800-0xDBFF is a high surrogate: its pair starts past the cut.
	return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** `url` when it is an https URL, else null. The web links only https. */
function httpsUrlOrNull(url: string | null): string | null {
	return url !== null && URL.canParse(url) && new URL(url).protocol === "https:"
		? url
		: null;
}
