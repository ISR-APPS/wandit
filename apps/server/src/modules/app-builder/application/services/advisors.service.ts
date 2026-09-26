/**
 * Collects the backend findings of one V2 app: the Supabase security and
 * performance advisors plus the wandit RLS check on the `public` schema
 * (WANDIT-186). The `get_advisors` host tool calls it; the publish gate of
 * WANDIT-190 calls it later. It reads through `SupabaseManagementClient`.
 * No Nest decorator: the builder-turn task composes it by hand.
 */
import type { GateFinding, SupabaseAdvisorLint } from "@wandit/contracts";
import { z } from "zod";

import type {
	BackendRef,
	SupabaseManagementClient,
} from "../../infrastructure/supabase/supabase-management.client";

// Every ordinary or partitioned table of `public` with RLS off or without a
// policy. The migration ledger lives in `wandit`, so it stays out.
const RLS_CHECK_SQL = `select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and (not c.relrowsecurity or not exists (
    select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
  ))
order by c.relname`;

// One table the RLS check reports.
const rlsCheckRowSchema = z.object({
	table_name: z.string(),
	rls_enabled: z.boolean(),
});

const RLS_DOCS_URL =
	"https://supabase.com/docs/guides/database/postgres/row-level-security";

// Lint entities the user reads as tables; the finding names them.
const TABLE_LIKE_TYPES = new Set([
	"table",
	"view",
	"materialized view",
	"foreign table",
]);

/** Advisors plus the RLS check; one instance per client. */
export class AdvisorsService {
	constructor(
		private readonly client: Pick<
			SupabaseManagementClient,
			"getAdvisors" | "runQuery"
		>,
	) {}

	/**
	 * The findings of one backend, the wandit RLS findings first. The caller
	 * resolves the active backend first. An upstream error propagates.
	 */
	async run(backend: BackendRef): Promise<GateFinding[]> {
		// One call after the other: the three calls share the project bucket,
		// and three round trips after a migration are fast enough.
		const security = await this.client.getAdvisors(backend, "security");
		const performance = await this.client.getAdvisors(backend, "performance");
		const unprotected = await this.client.runQuery(backend, {
			readOnly: true,
			rowSchema: rlsCheckRowSchema,
			sql: RLS_CHECK_SQL,
		});
		return [
			...unprotected.map(rlsFinding),
			...[...security, ...performance].flatMap(lintFinding),
		];
	}
}

function rlsFinding(row: z.infer<typeof rlsCheckRowSchema>): GateFinding {
	const table = `public.${row.table_name}`;
	return {
		detail: row.rls_enabled
			? `${table} has row level security on but no policy, so every client request fails.`
			: `${table} has row level security off, so every client can read and write it.`,
		level: "error",
		lintId: "wandit_rls_missing",
		remediationUrl: RLS_DOCS_URL,
		table,
		title: "Table without row level security policies",
	};
}

function lintFinding(lint: SupabaseAdvisorLint): GateFinding[] {
	// INFO lints are advice; the agent and the publish gate act on error and warn only.
	if (lint.level === "INFO") {
		return [];
	}
	const schema = lint.metadata?.schema;
	const name = lint.metadata?.name;
	const isTable =
		lint.metadata?.type !== undefined &&
		TABLE_LIKE_TYPES.has(lint.metadata.type);
	return [
		{
			detail: lint.detail,
			level: lint.level === "ERROR" ? "error" : "warn",
			lintId: lint.name,
			remediationUrl: URL.canParse(lint.remediation) ? lint.remediation : null,
			table:
				isTable && schema !== undefined && name !== undefined
					? `${schema}.${name}`
					: null,
			title: lint.title,
		},
	];
}
