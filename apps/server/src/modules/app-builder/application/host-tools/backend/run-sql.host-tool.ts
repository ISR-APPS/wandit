/**
 * The SQL host tools of the builder turn (WANDIT-186): `run_sql` runs a
 * read at once; `run_sql_write` runs a write after the user approves.
 * `BuilderHostToolRegistry` builds both per turn. They call
 * `SupabaseManagementClient.runQuery`, like the Cloud tab SQL console, and
 * a write leaves an audit row with the query hash, never the text.
 */
import { createHash } from "node:crypto";

import {
	BACKEND_SQL_ROW_LIMIT,
	classifySql,
	type RunSqlToolInput,
	type RunSqlToolOutput,
	runSqlToolInputSchema,
	type SqlKind,
	type SqlRow,
	sqlRowSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import { type BackendToolDeps, runBackendTool } from "./backend-tool-deps";

/** `run_sql`: a read runs at once; a write answers `needs_approval` and runs nothing. */
export function createRunSqlTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<RunSqlToolInput, RunSqlToolOutput> {
	return tool({
		description:
			"Run ONE read-only SQL query on the app's Supabase database, for " +
			"example to check data or the schema after a migration. It answers at " +
			"most 200 rows. A statement that writes answers `needs_approval`: then " +
			"call `run_sql_write` only if the write is really needed. Use " +
			"`apply_migration` for schema changes, not this tool.",
		inputSchema: runSqlToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{ input, inputSchema: runSqlToolInputSchema, tool: "run_sql" },
				async ({ backend, client }, { query }): Promise<RunSqlToolOutput> => {
					// Product rule: the user approves each write, through the separate
					// `run_sql_write` tool. The upstream `read_only` flag guards the read.
					if (classifySql(query) === "write") {
						return { status: "needs_approval", tool: "run_sql_write" };
					}
					const rows = await client.runQuery(backend, {
						readOnly: true,
						rowSchema: sqlRowSchema,
						sql: query,
					});
					return okOutput("read", rows);
				},
			),
	});
}

/**
 * `run_sql_write`: the registry marks it `user-approval`, so this body runs
 * only after the user approves the call.
 */
export function createRunSqlWriteTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<RunSqlToolInput, RunSqlToolOutput> {
	return tool({
		description:
			"Run ONE SQL statement that writes data (insert, update, delete) on " +
			"the app's Supabase database. The user must approve the call first. " +
			"Never use it for schema changes: use `apply_migration`.",
		inputSchema: runSqlToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{ input, inputSchema: runSqlToolInputSchema, tool: "run_sql_write" },
				async (
					{ backend, backendId, client },
					{ query },
				): Promise<RunSqlToolOutput> => {
					const rows = await client.runQuery(backend, {
						readOnly: false,
						rowSchema: sqlRowSchema,
						sql: query,
					});
					await deps.audit.insert({
						action: "backend.sql_written",
						actorUserId: context.actorUserId,
						metadata: {
							queryHash: createHash("sha256").update(query).digest("hex"),
							// The rows the endpoint answered. An UPDATE without RETURNING
							// answers none, so this is not the count of changed rows.
							returnedRows: rows.length,
						},
						organizationId: context.organizationId,
						projectId: context.projectId,
						targetId: backendId,
						targetType: "app_backend",
					});
					return okOutput(classifySql(query), rows);
				},
			),
	});
}

function okOutput(kind: SqlKind, rows: SqlRow[]): RunSqlToolOutput {
	// LIMIT: the upstream answers every row and the tool keeps the first 200.
	// Upgrade: wrap a single select in a limited subquery.
	const kept = rows.slice(0, BACKEND_SQL_ROW_LIMIT);
	return {
		kind,
		rowCount: kept.length,
		rows: kept,
		status: "ok",
		truncated: rows.length > kept.length,
	};
}
