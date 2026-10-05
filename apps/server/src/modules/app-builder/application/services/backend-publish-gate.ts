/**
 * Publish gate of the app backend (WANDIT-190). It maps the Supabase security
 * advisors to findings. Then it checks each unmarked `public` relation in
 * SQL. It reads up to 200 of them through the REST API with the anon key,
 * like a visitor without sign-in.
 * `publish-app.task.ts` composes it by hand after the secret scan.
 */
import {
	type PublishGateFinding,
	type rlsProbeReasons,
	type SupabaseAdvisorLint,
	supabaseProjectUrl,
} from "@wandit/contracts";
import { z } from "zod";

import type { PublishGate } from "../../domain/ports/publish-gate";
import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import type { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import type { SupabaseManagementClient } from "../../infrastructure/supabase/supabase-management.client";

// Supabase lint 0025: a public bucket that lists its files. Supabase sends
// it as WARN, but it shows every file name, so it blocks. The owner can
// still override it, because the level stays WARN.
const PUBLIC_BUCKET_LISTING_LINT = "public_bucket_allows_listing";
// The docs anchor of lint 0025 in the remediation URL, in case the name changes.
const PUBLIC_BUCKET_LISTING_ANCHOR = "0025_public_bucket_allows_listing";

// The table comment that marks a relation as public on purpose. The
// template CLAUDE.md tells the agent to write it in the same migration.
const PUBLIC_RELATION_MARK = "wandit:public";

// LIMIT: the probe reads 200 relations at most. The SQL checks still cover
// every unmarked relation. 40 rounds of 5 reads fit in 20 s only when one read takes
// 0.5 s or less. Upgrade: a longer deadline or more reads at a time.
const MAX_PROBED_RELATIONS = 200;
// 5 reads at a time: fast enough, and far below the REST API limits of a micro instance.
const PROBE_CONCURRENCY = 5;
// 5 s per read covers a slow network. The database itself stops an `anon`
// statement after 3 s (the Supabase default).
const PROBE_REQUEST_TIMEOUT_MS = 5_000;
// 20 s for all reads together, so a slow backend cannot hold the publish run.
const PROBE_DEADLINE_MS = 20_000;
// PostgREST answers 401 or 403 when `anon` may not read the relation, and
// 404 when the API does not expose it. No row reaches the visitor.
const NO_ROWS_STATUSES = new Set([401, 403, 404]);
// SQLSTATE `query_canceled`: PostgREST answers 500 with it when the 3 s
// statement timeout of `anon` stops the read.
const QUERY_CANCELED_SQLSTATE = "57014";

// Every relation of `public` with a kind that PostgREST exposes.
// `anon_can_select` is true when `anon` has SELECT on the relation or on
// one of its columns. The last column is true when a permissive policy
// lets `anon` (or every role) read all rows.
const RELATIONS_SQL = `select c.relname as name,
  c.relkind::text as kind,
  c.relrowsecurity as rls_enabled,
  obj_description(c.oid, 'pg_class') as comment,
  has_any_column_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname
      and p.permissive = 'PERMISSIVE'
      and p.cmd in ('SELECT', 'ALL')
      and p.roles && array['anon', 'public']::name[]
      and p.qual = 'true'
  ) as has_open_anon_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
order by c.relname`;

// One relation of `RELATIONS_SQL`.
const relationRowSchema = z.object({
	name: z.string().min(1),
	// `r` table, `p` partitioned table, `v` view, `m` materialized view, `f` foreign table.
	kind: z.enum(["r", "p", "v", "m", "f"]),
	rls_enabled: z.boolean(),
	comment: z.string().nullable(),
	anon_can_select: z.boolean(),
	has_open_anon_policy: z.boolean(),
});

type RelationRow = z.infer<typeof relationRowSchema>;

// The REST answer to a `limit=1` read. The rows stay unread; only the count matters.
const probeAnswerSchema = z.array(z.looseObject({}));

// The error body of PostgREST; only the SQLSTATE or `PGRST` code is read.
const postgrestErrorSchema = z.object({ code: z.string() });

// What one anonymous read found.
type ProbeOutcome = "rows" | "no_rows" | "timeout";

/** Dependencies of `BackendPublishGate`; `publish-app.task.ts` composes them. */
export type BackendPublishGateDeps = {
	/** Reads the `app_backends` row: status, ref, and anon key. */
	backends: Pick<AppBackendsRepository, "findByProjectId">;
	/** Worker Management API client. Null without `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID`. */
	client: Pick<SupabaseManagementClient, "getAdvisors" | "runQuery"> | null;
	/** `globalThis.fetch` for the anonymous REST reads; the spec passes a fake. */
	fetch: typeof globalThis.fetch;
	logger: SandboxLogger;
	/** `Sentry.captureException` with the project id and the ref as tags. */
	captureException: (
		error: unknown,
		tags: { projectId: string; ref: string },
	) => void;
};

/**
 * The backend gate. A project without an active backend passes with no
 * call. A gate that cannot finish throws, and the publish fails with
 * `gate_unavailable`.
 */
export class BackendPublishGate implements PublishGate {
	readonly id = "backend";

	constructor(private readonly deps: BackendPublishGateDeps) {}

	async run({
		projectId,
	}: Parameters<PublishGate["run"]>[0]): Promise<PublishGateFinding[]> {
		const backend = await this.deps.backends.findByProjectId(projectId);
		if (backend === null || backend.ref === null || backend.anonKey === null) {
			return [];
		}
		// Security: the build of a paused backend still gets its URL and anon
		// key, and a later restore makes the data reachable. So a backend that
		// cannot answer the checks fails the publish; it never goes live unchecked.
		if (backend.status === "paused" || backend.status === "restoring") {
			throw new Error(
				`project ${projectId} has a ${backend.status} backend; the checks need it awake`,
			);
		}
		if (backend.status !== "active") {
			return [];
		}
		const { client } = this.deps;
		// Security check: an active backend never publishes unchecked. A
		// worker without the client is a deploy bug, so the publish fails.
		if (client === null) {
			throw new Error(
				`project ${projectId} has an active backend, but the worker has no Supabase client`,
			);
		}
		const scope = { projectId, ref: backend.ref };
		try {
			const lints = await client.getAdvisors(scope, "security");
			const relations = await client.runQuery(scope, {
				readOnly: true,
				rowSchema: relationRowSchema,
				sql: RELATIONS_SQL,
			});
			const checked = relations.filter(
				(relation) => relation.comment !== PUBLIC_RELATION_MARK,
			);
			const isCut = checked.length > MAX_PROBED_RELATIONS;
			const probe = await this.probe(
				backend.ref,
				backend.anonKey,
				checked.slice(0, MAX_PROBED_RELATIONS).map((relation) => relation.name),
			);

			const findings: PublishGateFinding[] = lints.flatMap(advisorFinding);
			for (const relation of checked) {
				const reason = probeReason(relation, probe.outcomes.get(relation.name));
				if (reason !== null) {
					findings.push({
						kind: "rls_probe",
						reason,
						relation: relation.name,
						severity: reason === "probe_timeout" ? "warn" : "block",
					});
				}
			}
			if (isCut || probe.isDeadlineHit) {
				findings.push({
					kind: "rls_probe",
					reason: "probe_timeout",
					relation: null,
					severity: "warn",
				});
			}
			this.deps.logger.info("publish-gate.backend", {
				findings: String(findings.length),
				projectId,
				relations: String(checked.length),
			});
			return findings;
		} catch (error) {
			this.deps.captureException(error, scope);
			throw error;
		}
	}

	// Reads each relation with the anon key, at most PROBE_CONCURRENCY at a
	// time. A relation that the deadline stopped has no outcome.
	private async probe(
		ref: string,
		anonKey: string,
		names: string[],
	): Promise<{ outcomes: Map<string, ProbeOutcome>; isDeadlineHit: boolean }> {
		const deadline = AbortSignal.timeout(PROBE_DEADLINE_MS);
		const queue = [...names];
		const outcomes = new Map<string, ProbeOutcome>();
		const errors: unknown[] = [];
		const worker = async () => {
			// A worker stops at the deadline, or after any worker failed:
			// the gate throws anyway, so more reads are waste.
			while (errors.length === 0 && !deadline.aborted) {
				const name = queue.shift();
				if (name === undefined) {
					return;
				}
				try {
					const outcome = await this.readAnonymously(
						ref,
						anonKey,
						name,
						deadline,
					);
					if (outcome !== null) {
						outcomes.set(name, outcome);
					}
				} catch (error) {
					errors.push(error);
				}
			}
		};
		await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, worker));
		if (errors.length > 0) {
			throw errors[0];
		}
		return { isDeadlineHit: deadline.aborted, outcomes };
	}

	// One `limit=1` read with the anon key and no user token. Null when the
	// probe deadline stopped it. An unexpected answer throws.
	private async readAnonymously(
		ref: string,
		anonKey: string,
		name: string,
		deadline: AbortSignal,
	): Promise<ProbeOutcome | null> {
		try {
			const response = await this.deps.fetch(
				`${supabaseProjectUrl(ref)}/rest/v1/${encodeURIComponent(name)}?select=*&limit=1`,
				{
					// The same two headers that supabase-js sends for a visitor.
					headers: {
						accept: "application/json",
						apikey: anonKey,
						authorization: `Bearer ${anonKey}`,
					},
					signal: AbortSignal.any([
						AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS),
						deadline,
					]),
				},
			);
			if (NO_ROWS_STATUSES.has(response.status)) {
				// The body stays unread; the cancel frees the connection at once.
				await response.body?.cancel();
				return "no_rows";
			}
			if (!response.ok) {
				const failure = postgrestErrorSchema.safeParse(
					// A body that is not JSON has no code; the throw below names the status.
					await response.json().catch(() => null),
				);
				const code = failure.success ? failure.data.code : "none";
				if (code === QUERY_CANCELED_SQLSTATE) {
					return "timeout";
				}
				throw new Error(
					`anonymous read of public.${name} answered HTTP ${response.status}, code ${code}`,
				);
			}
			const rows = probeAnswerSchema.parse(await response.json());
			return rows.length > 0 ? "rows" : "no_rows";
		} catch (error) {
			if (!isTimeoutError(error)) {
				throw error;
			}
			return deadline.aborted ? null : "timeout";
		}
	}
}

// INFO lints are advice and never reach the popover. ERROR blocks without
// an override. WARN warns, except lint 0025, which blocks with an override.
function advisorFinding(lint: SupabaseAdvisorLint): PublishGateFinding[] {
	if (lint.level === "INFO") {
		return [];
	}
	const isPublicBucketListing =
		lint.name === PUBLIC_BUCKET_LISTING_LINT ||
		lint.remediation.includes(PUBLIC_BUCKET_LISTING_ANCHOR);
	return [
		{
			detail: lint.detail,
			kind: "advisor",
			level: lint.level,
			lintId: lint.name,
			remediationUrl: isHttpsUrl(lint.remediation) ? lint.remediation : null,
			severity:
				lint.level === "ERROR" || isPublicBucketListing ? "block" : "warn",
			title: lint.title,
		},
	];
}

// One reason per relation, the first match wins. Only a table has an RLS
// flag. A view uses the RLS of its tables.
function probeReason(
	relation: RelationRow,
	outcome: ProbeOutcome | undefined,
): (typeof rlsProbeReasons)[number] | null {
	if (outcome === "rows") {
		return "rows_returned";
	}
	if (
		(relation.kind === "r" || relation.kind === "p") &&
		!relation.rls_enabled
	) {
		return "no_rls";
	}
	// A materialized view or a foreign table cannot have RLS. With the grant,
	// `anon` reads every row, also when the probe found none today.
	if (
		(relation.kind === "m" || relation.kind === "f") &&
		relation.anon_can_select
	) {
		return "no_rls";
	}
	if (relation.has_open_anon_policy) {
		return "anon_policy";
	}
	return outcome === "timeout" ? "probe_timeout" : null;
}

// Security check: the popover renders the URL as a link, so a
// `javascript:` URL from the upstream must not reach it.
function isHttpsUrl(value: string): boolean {
	return URL.canParse(value) && new URL(value).protocol === "https:";
}

// `AbortSignal.timeout` rejects the fetch and the body read with a
// `TimeoutError` DOMException.
function isTimeoutError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "TimeoutError";
}
