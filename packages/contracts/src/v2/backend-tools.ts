/**
 * Wire contract of the agent backend tools (WANDIT-186). It holds the
 * schemas of the seven host tools, the `GateFinding` shape, and the check
 * `isDestructiveMigration`. The tools act on the hidden Supabase project of
 * a V2 app. The host tools in `apps/server/.../host-tools/backend/` use it.
 * Later, the web tool cards read it too.
 */
import { z } from "zod";

import { sqlKindSchema, sqlRowSchema, stripSqlNoise } from "./cloud";
import { projectSecretNameSchema } from "./secrets";

/**
 * The tool names the agent sees. The harness reads approval per tool
 * name, so each write the user must approve is its own tool
 * (`apply_destructive_migration`, `run_sql_write`).
 */
export const backendToolNames = [
	"apply_migration",
	"apply_destructive_migration",
	"run_sql",
	"run_sql_write",
	"deploy_function",
	"set_secret",
	"get_advisors",
] as const;

/** One backend tool name; the key in the harness tool set. */
export type BackendToolName = (typeof backendToolNames)[number];

/** Rows `run_sql` and `run_sql_write` keep; the rest is dropped and `truncated` is set. */
export const BACKEND_SQL_ROW_LIMIT = 200;

// The four failures every backend tool can answer. Each output union
// spreads them, so they are written once.
const backendToolFailures = [
	// The project has no `active` backend with a ref yet.
	z.object({ status: z.literal("backend_not_ready") }),
	// The backend sleeps; a restore from the Cloud tab wakes it.
	z.object({ status: z.literal("backend_paused") }),
	z.object({
		status: z.literal("rate_limited"),
		// Seconds until the Supabase bucket of the project accepts a call again.
		retryAfterSeconds: z.int().nonnegative(),
	}),
	z.object({
		status: z.literal("failed"),
		// One short plain sentence for the agent. Never a secret value.
		reason: z.string(),
	}),
] as const;

/** The failure branches shared by all seven outputs; the server helpers answer them. */
export const backendToolFailureSchema = z.discriminatedUnion(
	"status",
	backendToolFailures,
);

/** One shared failure answer of a backend tool. */
export type BackendToolFailure = z.infer<typeof backendToolFailureSchema>;

/**
 * Input of `apply_migration` and `apply_destructive_migration`. The name
 * becomes part of the migration file name and of the ledger SQL text,
 * so the pattern allows no quote.
 */
export const applyMigrationToolInputSchema = z.object({
	name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
	sql: z.string().trim().min(1).max(100_000),
});

/** Parsed migration input. */
export type ApplyMigrationToolInput = z.infer<
	typeof applyMigrationToolInputSchema
>;

/**
 * Output of both migration tools. `file` is the project-relative path
 * `supabase/migrations/<yyyymmddHHMMSS>_<name>.sql`. Only
 * `apply_migration` answers `needs_approval`.
 */
export const applyMigrationToolOutputSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("applied"), file: z.string() }),
	z.object({
		status: z.literal("skipped"),
		reason: z.string(),
		file: z.string(),
	}),
	z.object({
		status: z.literal("needs_approval"),
		tool: z.literal("apply_destructive_migration"),
	}),
	...backendToolFailures,
]);

/** Parsed migration output. */
export type ApplyMigrationToolOutput = z.infer<
	typeof applyMigrationToolOutputSchema
>;

/** Input of `run_sql` and `run_sql_write`. Same cap as the Cloud tab console. */
export const runSqlToolInputSchema = z.object({
	query: z.string().trim().min(1).max(20_000),
});

/** Parsed SQL input. */
export type RunSqlToolInput = z.infer<typeof runSqlToolInputSchema>;

/**
 * Output of both SQL tools. `rows` holds at most `BACKEND_SQL_ROW_LIMIT`
 * rows. Only `run_sql` answers `needs_approval`.
 */
export const runSqlToolOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("ok"),
		kind: sqlKindSchema,
		rows: z.array(sqlRowSchema),
		// Rows in `rows`, not the rows the upstream answered.
		rowCount: z.int().nonnegative(),
		truncated: z.boolean(),
	}),
	z.object({
		status: z.literal("needs_approval"),
		tool: z.literal("run_sql_write"),
	}),
	...backendToolFailures,
]);

/** Parsed SQL output. */
export type RunSqlToolOutput = z.infer<typeof runSqlToolOutputSchema>;

/**
 * Input of `deploy_function`. The slug becomes a sandbox folder name and
 * a URL segment, so the pattern allows no `/` and no `.`.
 */
export const deployFunctionToolInputSchema = z.object({
	slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
});

/** Parsed deploy input. */
export type DeployFunctionToolInput = z.infer<
	typeof deployFunctionToolInputSchema
>;

/** Output of `deploy_function`: the public function URL on success. */
export const deployFunctionToolOutputSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("deployed"), url: z.url() }),
	...backendToolFailures,
]);

/** Parsed deploy output. */
export type DeployFunctionToolOutput = z.infer<
	typeof deployFunctionToolOutputSchema
>;

/**
 * Input of `set_secret`. The model names the secret and its source, never
 * the value. Supabase reserves the `SUPABASE_` prefix and refuses it.
 */
export const setSecretToolInputSchema = z.object({
	name: projectSecretNameSchema.refine(
		(name) => !name.startsWith("SUPABASE_"),
		"Names that start with SUPABASE_ are reserved",
	),
	// `project_secret` reads the stored value; `generate` creates one when none exists.
	source: z.enum(["project_secret", "generate"]),
});

/** Parsed secret input. */
export type SetSecretToolInput = z.infer<typeof setSecretToolInputSchema>;

/**
 * Output of `set_secret`. `missing` means the project has no stored value;
 * the web app then shows the secret input of the Cloud tab.
 */
export const setSecretToolOutputSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("synced"), name: z.string() }),
	z.object({ status: z.literal("missing"), name: z.string() }),
	...backendToolFailures,
]);

/** Parsed secret output. */
export type SetSecretToolOutput = z.infer<typeof setSecretToolOutputSchema>;

/** Input of `get_advisors`: the tool takes no field. */
export const getAdvisorsToolInputSchema = z.object({});

/**
 * One finding of the backend checks. `get_advisors` answers it. Later, the
 * publish gate of WANDIT-190 reads it. `table` is `<schema>.<name>` or null.
 */
export const gateFindingSchema = z.object({
	// The Supabase lint name, or `wandit_rls_missing` for the wandit RLS check.
	lintId: z.string(),
	// The agent must fix every `error`; the gate blocks publish on one.
	level: z.enum(["error", "warn"]),
	title: z.string(),
	detail: z.string(),
	remediationUrl: z.url().nullable(),
	table: z.string().nullable(),
});

/** Parsed finding. */
export type GateFinding = z.infer<typeof gateFindingSchema>;

/** Output of `get_advisors`. */
export const getAdvisorsToolOutputSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("ok"), findings: z.array(gateFindingSchema) }),
	...backendToolFailures,
]);

/** Parsed advisors output. */
export type GetAdvisorsToolOutput = z.infer<typeof getAdvisorsToolOutputSchema>;

// Objects a `drop` can remove without a data loss. Any other `drop`
// target (table, column, schema, type, ...) counts as destructive.
const SAFE_DROP_TARGETS = new Set([
	"policy",
	"trigger",
	"function",
	"index",
	"view",
	"constraint",
	"default",
	"not",
	"identity",
	"expression",
]);

// A column type change reads `alter [column] <name> [set data] type`:
// `type` comes at most 5 words after the inner `alter`.
const TYPE_CHANGE_WINDOW = 5;

/**
 * True when one statement of the migration can destroy data. It catches
 * truncate, `delete from`, `update ... set`, `merge into`, a drop of a data
 * object, a drop with cascade, a column type change, and a `do`, `call`, or
 * `select` statement. It is not a parser, and a function body stays hidden.
 * Every doubt answers true, so the user approves once.
 */
export function isDestructiveMigration(sql: string): boolean {
	return (
		stripSqlNoise(sql)
			.toLowerCase()
			.split(";")
			// A name can hold digits and `$`; `a1b2` stays one word.
			.some((statement) =>
				isDestructiveStatement(statement.match(/[a-z_][a-z0-9_$]*/g)),
			)
	);
}

function isDestructiveStatement(words: string[] | null): boolean {
	if (words === null) {
		return false;
	}
	// A `do` block, a `call`, or a `select` of a function runs code the noise
	// strip hides, for example `select cron.schedule(...)` with a delete.
	if (words[0] === "do" || words[0] === "call" || words[0] === "select") {
		return true;
	}
	if (words.includes("truncate")) {
		return true;
	}
	// A cascade after `on delete` or `on update` is a foreign key action,
	// not a cascade of the drop.
	const dropCascades =
		words.includes("drop") &&
		words.some(
			(word, index) =>
				word === "cascade" &&
				words[index - 1] !== "delete" &&
				words[index - 1] !== "update",
		);
	if (dropCascades) {
		return true;
	}
	return words.some((word, index) => {
		const next = words[index + 1];
		if (word === "delete") {
			// `on delete cascade` in a foreign key stays additive.
			return next === "from";
		}
		if (word === "update") {
			// An update overwrites values. `on update` is a foreign key action;
			// `for update` and `grant update` hold no `set`.
			return (
				words[index - 1] !== "on" && words.slice(index + 1).includes("set")
			);
		}
		if (word === "merge") {
			return next === "into";
		}
		if (word === "drop") {
			return next === undefined || !SAFE_DROP_TARGETS.has(next);
		}
		// The first `alter` opens the statement; a later one alters a column.
		if (word === "alter" && index > 0 && words[0] === "alter") {
			return words
				.slice(index + 1, index + 1 + TYPE_CHANGE_WINDOW)
				.includes("type");
		}
		return false;
	});
}
