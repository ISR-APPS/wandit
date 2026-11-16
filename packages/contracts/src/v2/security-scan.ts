/**
 * Shared contract of the V2 security scan.
 * A `security_scan` builder turn runs two host checks (backend advisors and
 * `pnpm audit`), then the agent audits the code with the vendored Cloudflare
 * skill. The `builder-turn` task parses the raw outputs with the boundary
 * schemas below and stores one report row. The web Security panel and the
 * `data-security-report` chat card read the report shapes.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";

// --- Report ----------------------------------------------------------------

/**
 * Severity of one finding, highest first. The web groups findings in this
 * order. The Cloudflare skill calls `info` "informational".
 */
export const securityFindingSeverities = [
	"critical",
	"high",
	"medium",
	"low",
	"info",
] as const;

/** Runtime validator for a finding severity. */
export const securityFindingSeveritySchema = z.enum(securityFindingSeverities);

/** One of `securityFindingSeverities`. */
export type SecurityFindingSeverity = z.infer<
	typeof securityFindingSeveritySchema
>;

/**
 * The check that found a finding. `database` is the Supabase security
 * advisors plus the RLS check, `dependency` is `pnpm audit`, `code` is the
 * agent audit with the Cloudflare skill.
 */
export const securityScanSources = ["database", "dependency", "code"] as const;

/** Runtime validator for a scan source. */
export const securityScanSourceSchema = z.enum(securityScanSources);

/** One of `securityScanSources`. */
export type SecurityScanSource = z.infer<typeof securityScanSourceSchema>;

/** Max findings in one report. The task keeps the most severe ones. */
export const SECURITY_SCAN_MAX_FINDINGS = 100;

/** Max chars of `detail` and `fix`. The task cuts a longer text. */
export const SECURITY_FINDING_TEXT_MAX = 2_000;

/** One finding of a scan, in the shape the Security panel shows. */
export const securityScanFindingSchema = z.object({
	// Stable id inside one report, for example `database:rls_disabled_in_public:todos`,
	// `dependency:1193725`, or `code:<skill fingerprint>`.
	id: z.string().min(1).max(300),
	source: securityScanSourceSchema,
	// `confirmed` has a severity. `needs_review` is a skill `needs_validation`
	// record: the source trace is not complete, so the skill gives no severity.
	status: z.enum(["confirmed", "needs_review"]),
	// Null only when `status` is `needs_review`.
	severity: securityFindingSeveritySchema.nullable(),
	title: z.string().min(1).max(300),
	// What is wrong and why it matters. Untrusted text: it comes from the agent
	// or from an advisory feed, so the web renders it as plain text.
	detail: z.string().max(SECURITY_FINDING_TEXT_MAX),
	// Where the problem is: `src/routes/api.ts:42`, a table name, or `pkg@1.2.3`.
	// Null when the check gives no place.
	location: z.string().max(500).nullable(),
	// How to fix it, in plain words. "" when the check gives no fix.
	fix: z.string().max(SECURITY_FINDING_TEXT_MAX),
	// A docs or advisory link. Null when the check gives none.
	url: z.url().nullable(),
});

/** One finding; see `securityScanFindingSchema`. */
export type SecurityScanFinding = z.infer<typeof securityScanFindingSchema>;

/**
 * The result of one check of a scan. `skipped`: the check does not apply,
 * for example `database` on a project without a backend. `failed`: the check
 * ran and gave no usable result, so the report can miss findings.
 */
export const securityScanCheckSchema = z.object({
	source: securityScanSourceSchema,
	state: z.enum(["ok", "skipped", "failed"]),
	// Machine reason of a `skipped` or `failed` state, for example
	// `no_backend`, `backend_paused`, `audit_unreadable`, `findings_missing`. Null on `ok`.
	reason: z.string().max(64).nullable(),
});

/** One check result; see `securityScanCheckSchema`. */
export type SecurityScanCheck = z.infer<typeof securityScanCheckSchema>;

/** The full report of one scan. The `security_scans.report` column holds it. */
export const securityScanReportSchema = z.object({
	// Most severe first; at most `SECURITY_SCAN_MAX_FINDINGS`.
	findings: z.array(securityScanFindingSchema).max(SECURITY_SCAN_MAX_FINDINGS),
	// One entry per source, in `securityScanSources` order.
	checks: z.array(securityScanCheckSchema),
});

/** One scan report; see `securityScanReportSchema`. */
export type SecurityScanReport = z.infer<typeof securityScanReportSchema>;

/**
 * Count of findings per severity, plus `needsReview` for the findings with no
 * severity. The chat card shows it; the full list stays in the panel.
 */
export const securityScanCountsSchema = z.object({
	critical: z.int().nonnegative(),
	high: z.int().nonnegative(),
	medium: z.int().nonnegative(),
	low: z.int().nonnegative(),
	info: z.int().nonnegative(),
	needsReview: z.int().nonnegative(),
});

/** Counts of one report; see `securityScanCountsSchema`. */
export type SecurityScanCounts = z.infer<typeof securityScanCountsSchema>;

/**
 * `data` of the `data-security-report` part. The task writes it once, at the
 * end of a `security_scan` turn that ended normally. "Open report" opens the
 * Security panel, which reads the stored report.
 */
export const turnSecurityReportDataSchema = z.object({
	counts: securityScanCountsSchema,
	checks: z.array(securityScanCheckSchema),
	// False when the task could not store the report row. The panel then
	// still shows the previous scan.
	saved: z.boolean(),
});

/** One `data-security-report` part; id is `security-${turnId}`. */
export const turnSecurityReportDataPartSchema = z.object({
	type: z.literal("data-security-report"),
	id: z.string(),
	data: turnSecurityReportDataSchema,
});

/** The chat card payload; see `turnSecurityReportDataSchema`. */
export type TurnSecurityReportData = z.infer<
	typeof turnSecurityReportDataSchema
>;

/** Body of `GET /api/v2/projects/:id/security-scans/latest`. */
export const latestSecurityScanResponseSchema = z.object({
	// Null when the project has no finished scan yet.
	scan: z
		.object({
			id: uuidSchema,
			// The `security_scan` turn that made the report.
			turnId: uuidSchema,
			createdAt: isoDateTimeSchema,
			report: securityScanReportSchema,
		})
		.nullable(),
});

/** TypeScript latest-scan body. */
export type LatestSecurityScanResponse = z.infer<
	typeof latestSecurityScanResponseSchema
>;

/** Every security scan route. All need the workspace header. */
export const securityScanRoutes = {
	// GET the newest finished scan of the project. Editors only.
	latest: (projectId: string) =>
		`/api/v2/projects/${projectId}/security-scans/latest`,
} as const;

// --- Boundary: `pnpm audit --json` ------------------------------------------

/**
 * One advisory of `pnpm audit --json` (pnpm 11, npm v6 audit format). Only
 * the fields the task reads. Checked against the web-app template output.
 */
export const pnpmAuditAdvisorySchema = z.object({
	id: z.int(),
	title: z.string(),
	module_name: z.string(),
	severity: z.enum(["info", "low", "moderate", "high", "critical"]),
	vulnerable_versions: z.string(),
	patched_versions: z.string(),
	url: z.string(),
	findings: z.array(
		z.object({
			version: z.string(),
			paths: z.array(z.string()),
			// True when only dev dependencies reach the package.
			dev: z.boolean().optional(),
		}),
	),
});

/** One parsed advisory; see `pnpmAuditAdvisorySchema`. */
export type PnpmAuditAdvisory = z.infer<typeof pnpmAuditAdvisorySchema>;

/** Stdout of `pnpm audit --json`; the keys of `advisories` are the advisory ids. */
export const pnpmAuditOutputSchema = z.object({
	advisories: z.record(z.string(), pnpmAuditAdvisorySchema),
});

// --- Boundary: Cloudflare skill `findings.json` ------------------------------

/** One step of a skill trace, from the entry point to the sink. */
const auditTraceStepSchema = z.object({
	kind: z.enum(["entrypoint", "propagation", "sink"]),
	file: z.string(),
	line: z.int().min(1),
});

/** Skill severity names, mapped to `securityFindingSeverities` by the task. */
const auditSeverityScoreSchema = z.enum([
	"informational",
	"low",
	"medium",
	"high",
	"critical",
]);

/**
 * One record of the skill `findings.json` (`report-schema.json` of
 * cloudflare/security-audit-skill at c1c8a8c). Only the fields the task
 * reads; the skill validator checks the full schema in the sandbox.
 * The agent writes the file, so the task treats it as untrusted input.
 */
export const securityAuditRecordSchema = z.discriminatedUnion("verdict", [
	z.object({
		verdict: z.literal("confirmed"),
		fingerprint: z.string().min(1),
		title: z.string().min(1),
		description: z.string(),
		trace: z.array(auditTraceStepSchema).min(1),
		remediation: z.object({ strategy: z.string() }),
		severity: z.object({ overall_severity: auditSeverityScoreSchema }),
	}),
	z.object({
		verdict: z.literal("needs_validation"),
		fingerprint: z.string().min(1),
		title: z.string().min(1),
		description: z.string(),
		trace: z.array(auditTraceStepSchema).min(1),
		blockers: z.array(z.string()).min(1),
	}),
	z.object({
		verdict: z.literal("rejected"),
		fingerprint: z.string().min(1),
	}),
]);

/** One parsed skill record; see `securityAuditRecordSchema`. */
export type SecurityAuditRecord = z.infer<typeof securityAuditRecordSchema>;
