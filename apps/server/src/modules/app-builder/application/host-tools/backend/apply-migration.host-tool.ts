/**
 * The migration host tools of the builder turn (WANDIT-186):
 * `apply_migration` for an additive migration, and
 * `apply_destructive_migration`, which the user approves first.
 * `BuilderHostToolRegistry` builds both per turn. Each runs the SQL through
 * `SupabaseManagementClient`, records it in `wandit.migrations`, writes the
 * migration file into the sandbox, and writes an audit row.
 */
import { createHash } from "node:crypto";
import { posix } from "node:path";

import {
	type ApplyMigrationToolInput,
	type ApplyMigrationToolOutput,
	applyMigrationToolInputSchema,
	hasTransactionControl,
	isDestructiveMigration,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";
import { z } from "zod";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import {
	type ActiveBackend,
	type BackendToolDeps,
	runBackendTool,
} from "./backend-tool-deps";

// The ledger of applied migrations. The `wandit` schema is not in the
// Data API schema list, so browser clients never reach it.
const ENSURE_LEDGER_SQL = `create schema if not exists wandit;
create table if not exists wandit.migrations (
  name text primary key,
  sha256 text not null unique,
  applied_at timestamptz not null default now()
);`;

// One ledger row. Any SQL can write the table, so the name gets the input
// pattern again before it becomes a file path; `stamp` is 14 digits.
const ledgerRowSchema = z.object({
	name: applyMigrationToolInputSchema.shape.name,
	stamp: z.string().regex(/^\d{14}$/),
});

// Project-relative folder of the migration files; the turn commit takes them.
const MIGRATIONS_DIR = "supabase/migrations";

/**
 * `apply_migration`: applies an additive migration at once. A migration
 * that can destroy data answers `needs_approval` and runs nothing.
 */
export function createApplyMigrationTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<ApplyMigrationToolInput, ApplyMigrationToolOutput> {
	return tool({
		description:
			"Apply ONE forward-only, additive SQL migration to the app's Supabase " +
			"database, then save it as `supabase/migrations/<timestamp>_<name>.sql` " +
			"in the project. Use it for every schema change: tables, columns, " +
			"indexes, RLS policies, functions, triggers. Enable row level security " +
			"and add policies for every new table in the same migration. The same " +
			"SQL twice is skipped. `name` uses a-z, 0-9, and _, starts with a " +
			"letter, and has at most 64 characters. `name` is new for each " +
			"migration: the ledger keeps one row per name. A statement that can " +
			"destroy data (drop table or column, truncate, delete from, update, " +
			"merge, a column type change, or a do, call, select, with, explain, or " +
			"values statement) answers `needs_approval`: then call " +
			"`apply_destructive_migration` with the same input. Never write " +
			"migration files yourself. The whole migration runs in one " +
			"transaction: the tool refuses begin, commit, rollback, and savepoint; " +
			"do not use `concurrently`. Call `get_advisors` after each migration.",
		inputSchema: applyMigrationToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{
					input,
					inputSchema: applyMigrationToolInputSchema,
					tool: "apply_migration",
				},
				async (active, migration): Promise<ApplyMigrationToolOutput> => {
					// Product rule: the user approves each migration that can destroy
					// data. The approval tool is separate: the harness asks per tool name.
					if (isDestructiveMigration(migration.sql)) {
						return {
							status: "needs_approval",
							tool: "apply_destructive_migration",
						};
					}
					return applyMigration(deps, context, active, migration, false);
				},
			),
	});
}

/**
 * `apply_destructive_migration`: the registry marks it `user-approval`, so
 * this body runs only after the user approves the call.
 */
export function createApplyDestructiveMigrationTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<ApplyMigrationToolInput, ApplyMigrationToolOutput> {
	return tool({
		description:
			"Apply ONE migration that can destroy data (drop, truncate, delete, a " +
			"column type change). The user must approve the call first. Call it " +
			"only after `apply_migration` answered `needs_approval`, with the same " +
			"name and SQL.",
		inputSchema: applyMigrationToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{
					input,
					inputSchema: applyMigrationToolInputSchema,
					tool: "apply_destructive_migration",
				},
				(active, migration) =>
					applyMigration(deps, context, active, migration, true),
			),
	});
}

async function applyMigration(
	deps: BackendToolDeps,
	context: HostToolContext,
	{ backend, backendId, client }: ActiveBackend,
	{ name, sql }: ApplyMigrationToolInput,
	destructive: boolean,
): Promise<ApplyMigrationToolOutput> {
	// A `commit` inside the text would record the migration as applied while
	// its tail can still fail. Refuse before any SQL runs.
	if (hasTransactionControl(sql)) {
		return {
			reason:
				"A migration runs in one transaction. Remove begin, commit, rollback, and savepoint.",
			status: "failed",
		};
	}
	const sha256 = createHash("sha256").update(sql).digest("hex");
	await client.runSql(backend, ENSURE_LEDGER_SQL);
	// The sha is 64 hex characters, so it is safe inside the SQL text.
	const [applied] = await client.runQuery(backend, {
		readOnly: true,
		rowSchema: ledgerRowSchema,
		sql: `select name, to_char(applied_at at time zone 'UTC', 'YYYYMMDDHH24MISS') as stamp from wandit.migrations where sha256 = '${sha256}'`,
	});
	if (applied !== undefined) {
		// The skip writes the file again: a sandbox write that failed after an
		// earlier commit heals here, and the same path makes it a no-op.
		const file = await writeMigrationFile(
			context,
			`${applied.stamp}_${applied.name}`,
			sql,
		);
		return { file, reason: "already applied", status: "skipped" };
	}

	const appliedAt = deps.now().toISOString();
	// One text holds the ledger insert first, then the migration. The
	// Management API runs one text as one implicit transaction (UNVERIFIED
	// for the Beta endpoint). So the row and the migration commit together.
	// A retry after a commit fails on the unique sha; the migration does not
	// run again. The name pattern allows no quote: it is safe in the text.
	await client.runSql(
		backend,
		`insert into wandit.migrations (name, sha256, applied_at) values ('${name}', '${sha256}', '${appliedAt}');\n${sql}`,
	);
	// The audit row comes right after the commit. A failed file write after
	// it must not lose the record of an applied migration.
	await deps.audit.insert({
		action: "backend.migration_applied",
		actorUserId: context.actorUserId,
		metadata: { destructive, name, sha256 },
		organizationId: context.organizationId,
		projectId: context.projectId,
		targetId: backendId,
		targetType: "app_backend",
	});
	// yyyymmddHHMMSS in UTC: the first 14 digits of the ISO time.
	const stamp = appliedAt.replace(/\D/g, "").slice(0, 14);
	const file = await writeMigrationFile(context, `${stamp}_${name}`, sql);
	return { file, status: "applied" };
}

// Writes `supabase/migrations/<baseName>.sql` and answers that
// project-relative path; the turn commit then includes the file.
async function writeMigrationFile(
	context: HostToolContext,
	baseName: string,
	sql: string,
): Promise<string> {
	const file = `${MIGRATIONS_DIR}/${baseName}.sql`;
	await context.sandbox.writeFiles([
		{
			content: `${sql}\n`,
			path: posix.join(context.sandbox.workspaceDir, file),
		},
	]);
	return file;
}
