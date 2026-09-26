/**
 * Shared contract of the Cloud tab (WANDIT-187): one zod schema per route
 * under `/api/v2/projects/:id/cloud/*`, the read-or-write SQL classifier
 * `classifySql`, and the `cloudRoutes` path map. The API validates each
 * request and answer with these schemas; the Cloud tab UI (WANDIT-188)
 * parses the answers with the same schemas.
 */
import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { isoDateSchema, isoDateTimeSchema } from "../v1/shared/primitives";

// ---------------------------------------------------------------------------
// Backend state
// ---------------------------------------------------------------------------

/**
 * Lifecycle states of the hidden backend as the Cloud tab sees them: the
 * `app_backend_status` enum plus `none` when the project has no row.
 */
export const cloudBackendStatuses = [
	"none",
	"creating",
	"active",
	"paused",
	"restoring",
	"deleting",
	"error",
] as const;

/** Validates `status` in the backend answer. */
export const cloudBackendStatusSchema = z.enum(cloudBackendStatuses);

/** TypeScript backend status. */
export type CloudBackendStatus = z.infer<typeof cloudBackendStatusSchema>;

/**
 * Answer of `GET cloud/backend`, `POST cloud/backend`, and
 * `POST cloud/backend/restore`. Every field is null when `status` is `none`.
 */
export const cloudBackendResponseSchema = z.object({
	status: cloudBackendStatusSchema,
	/** The 20-letter Supabase project ref; null until the create call answers. */
	ref: z.string().nullable(),
	/** Supabase region of the project, for example "eu-west-3". */
	region: z.string().nullable(),
	/** Machine failure code of the last failed provisioning run; null while healthy. */
	failureCode: z.string().nullable(),
});

/** TypeScript backend answer. */
export type CloudBackendResponse = z.infer<typeof cloudBackendResponseSchema>;

// ---------------------------------------------------------------------------
// Database: tables, rows, SQL console
// ---------------------------------------------------------------------------

/** One column of a `public` table, from `information_schema.columns`. */
export const cloudColumnSchema = z.object({
	name: z.string(),
	/** Postgres `data_type` text, for example "integer" or "text". */
	dataType: z.string(),
	isNullable: z.boolean(),
	/** The `column_default` expression text; null without a default. */
	defaultValue: z.string().nullable(),
});

/** TypeScript table column. */
export type CloudColumn = z.infer<typeof cloudColumnSchema>;

/** One `public` table with its columns and its live row count. */
export const cloudTableSchema = z.object({
	name: z.string(),
	columns: z.array(cloudColumnSchema),
	/**
	 * Live rows. The `pg_stat_user_tables.n_live_tup` estimate, or the
	 * `count(*)` result when `rowCountExact` is true.
	 */
	rowCount: z.int().nonnegative(),
	rowCountExact: z.boolean(),
});

/** TypeScript table. */
export type CloudTable = z.infer<typeof cloudTableSchema>;

/**
 * A table or column name as the user typed it: at most 63 characters, the
 * Postgres limit. The API accepts it only when `information_schema` lists
 * it, and quotes it before it enters SQL.
 */
export const cloudIdentifierSchema = z.string().min(1).max(63);

/** Query of `GET cloud/tables`. */
export const cloudTablesQuerySchema = z.object({
	/** Name of one `public` table to count with `count(*)` instead of the estimate. */
	exact: cloudIdentifierSchema.optional(),
});

/** TypeScript tables query. */
export type CloudTablesQuery = z.infer<typeof cloudTablesQuerySchema>;

/** Answer of `GET cloud/tables`, ordered by table name. */
export const cloudTablesResponseSchema = z.object({
	tables: z.array(cloudTableSchema),
});

/** TypeScript tables answer. */
export type CloudTablesResponse = z.infer<typeof cloudTablesResponseSchema>;

/**
 * One result row of a SQL query: column name to JSON value. The API passes
 * the rows through unread, so the value type is any JSON.
 */
export const sqlRowSchema = z.record(z.string(), z.json());

/** TypeScript SQL row. */
export type SqlRow = z.infer<typeof sqlRowSchema>;

/**
 * Query of `GET cloud/tables/:table/rows`. `pageSize` caps at 100 through
 * `paginationQuerySchema`.
 */
export const cloudRowsQuerySchema = paginationQuerySchema.extend({
	/** Column to order by; must exist on the table. Default: the first column. */
	sort: cloudIdentifierSchema.optional(),
	dir: z.enum(["asc", "desc"]).default("asc"),
});

/** TypeScript rows query. */
export type CloudRowsQuery = z.infer<typeof cloudRowsQuerySchema>;

/** Answer of `GET cloud/tables/:table/rows`; `total` is an exact `count(*)`. */
export const cloudRowsResponseSchema = paginatedResultSchema(sqlRowSchema);

/** TypeScript rows answer. */
export type CloudRowsResponse = z.infer<typeof cloudRowsResponseSchema>;

/** The two classes `classifySql` answers. */
export const sqlKinds = ["read", "write"] as const;

/** Validates `kind` in the SQL answer. */
export const sqlKindSchema = z.enum(sqlKinds);

/** TypeScript SQL kind. */
export type SqlKind = z.infer<typeof sqlKindSchema>;

/** Body of `POST cloud/sql`. The query text caps at 20 000 characters. */
export const cloudSqlBodySchema = z.object({
	query: z.string().trim().min(1).max(20_000),
	/** Must be true to run a statement `classifySql` marks as a write. */
	confirmWrite: z.boolean().default(false),
});

/** TypeScript SQL body. */
export type CloudSqlBody = z.infer<typeof cloudSqlBodySchema>;

/** Rows `POST cloud/sql` keeps; the rest is dropped and `truncated` is set. */
export const CLOUD_SQL_ROW_LIMIT = 500;

/** Answer of `POST cloud/sql`. */
export const cloudSqlResponseSchema = z.object({
	kind: sqlKindSchema,
	rows: z.array(sqlRowSchema),
	/** Rows in `rows`; at most `CLOUD_SQL_ROW_LIMIT`. */
	rowCount: z.int().nonnegative(),
	/** True when the upstream answered more rows than `CLOUD_SQL_ROW_LIMIT`. */
	truncated: z.boolean(),
});

/** TypeScript SQL answer. */
export type CloudSqlResponse = z.infer<typeof cloudSqlResponseSchema>;

// Statements that read only. Any other first word is a write.
const READ_FIRST_WORDS = new Set([
	"select",
	"with",
	"explain",
	"show",
	"table",
	"values",
]);

// Words that write when they appear inside a statement that starts as a
// read, for example a data-modifying CTE or `select setval(...)`.
const WRITE_WORDS = new Set([
	"insert",
	"update",
	"delete",
	"merge",
	"into",
	"create",
	"alter",
	"drop",
	"truncate",
	"grant",
	"revoke",
	"copy",
	"call",
	"do",
	"lock",
	"refresh",
	"execute",
	"setval",
	"nextval",
]);

// Comments, escape strings (`E'it\'s'`), string literals, quoted
// identifiers, and dollar-quoted strings (`$$`, `$fn1$`). Their text must not
// count as keywords. A missed form would hide the SQL after it. A `$` or an
// `E` inside a name (`x$a$y`, `type'`) opens no string: Postgres wants a
// space or a symbol before a dollar quote.
const SQL_NOISE =
	/--[^\n]*|\/\*[\s\S]*?\*\/|(?<![\w$])[eE]'(?:[^'\\]|\\[\s\S]|'')*'|'(?:[^']|'')*'|"(?:[^"]|"")*"|(?<![\w$])\$([a-zA-Z_][a-zA-Z0-9_]*)?\$[\s\S]*?\$\1\$/g;

/**
 * Replaces comments, string literals, quoted identifiers, and
 * dollar-quoted bodies with a space. `classifySql` and the migration check
 * `isDestructiveMigration` read keywords from the rest only.
 */
export function stripSqlNoise(query: string): string {
	return query.replace(SQL_NOISE, " ");
}

/**
 * Sorts one SQL text as `read` or `write`. A read starts with a read word
 * and holds no write word outside comments and literals. Every doubt
 * answers `write`, so the console asks for a confirm; the upstream
 * `read_only` flag is the real guard.
 */
export function classifySql(query: string): SqlKind {
	const words = stripSqlNoise(query)
		.toLowerCase()
		.match(/[a-z_]+/g);
	if (words === null || words.length === 0) {
		return "write";
	}
	const [first, ...rest] = words;
	if (first === undefined || !READ_FIRST_WORDS.has(first)) {
		return "write";
	}
	return rest.some((word) => WRITE_WORDS.has(word)) ? "write" : "read";
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** One row of `auth.users` the Cloud tab shows. */
export const cloudAuthUserSchema = z.object({
	id: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	lastSignInAt: isoDateTimeSchema.nullable(),
	/** `raw_app_meta_data.provider`, for example "email" or "google"; null when unset. */
	provider: z.string().nullable(),
});

/** TypeScript auth user. */
export type CloudAuthUser = z.infer<typeof cloudAuthUserSchema>;

/** Query of `GET cloud/auth/users`: `page` and `pageSize` (max 100). */
export const cloudAuthUsersQuerySchema = paginationQuerySchema;

/** TypeScript auth users query. */
export type CloudAuthUsersQuery = z.infer<typeof cloudAuthUsersQuerySchema>;

/** Answer of `GET cloud/auth/users`, newest first. */
export const cloudAuthUsersResponseSchema =
	paginatedResultSchema(cloudAuthUserSchema);

/** TypeScript auth users answer. */
export type CloudAuthUsersResponse = z.infer<
	typeof cloudAuthUsersResponseSchema
>;

/** Sign-ups of one UTC day. */
export const cloudSignupDaySchema = z.object({
	/** The day as `YYYY-MM-DD`. */
	date: isoDateSchema,
	count: z.int().nonnegative(),
});

/** Days `GET cloud/auth/signups` covers, today included. */
export const CLOUD_SIGNUP_DAYS = 30;

/** Answer of `GET cloud/auth/signups`: one entry per day, oldest first. */
export const cloudSignupsResponseSchema = z.object({
	days: z.array(cloudSignupDaySchema),
});

/** TypeScript sign-ups answer. */
export type CloudSignupsResponse = z.infer<typeof cloudSignupsResponseSchema>;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** One Storage bucket. `public` means objects are readable without a token. */
export const cloudBucketSchema = z.object({
	id: z.string(),
	name: z.string(),
	public: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/** TypeScript bucket. */
export type CloudBucket = z.infer<typeof cloudBucketSchema>;

/** Answer of `GET cloud/storage/buckets`. */
export const cloudBucketsResponseSchema = z.object({
	buckets: z.array(cloudBucketSchema),
});

/** TypeScript buckets answer. */
export type CloudBucketsResponse = z.infer<typeof cloudBucketsResponseSchema>;

/** A bucket name as Supabase accepts it: letters, digits, `_`, `-`, `.`. */
export const cloudBucketNameSchema = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[\w.-]+$/, "expected a bucket name");

/**
 * An object path inside a bucket: no leading slash, no `..` segment, no
 * empty segment.
 */
export const cloudObjectPathSchema = z
	.string()
	.min(1)
	.max(1_000)
	.refine(
		(path) =>
			path.split("/").every((segment) => segment !== "" && segment !== ".."),
		"expected an object path without empty or .. segments",
	);

/** Objects per page of `GET cloud/storage/buckets/:bucket/objects`. */
export const CLOUD_OBJECTS_PAGE_SIZE = 100;

/** Seconds a signed download URL stays valid: 10 minutes. */
export const CLOUD_SIGNED_URL_TTL_SECONDS = 600;

/** Query of `GET cloud/storage/buckets/:bucket/objects`. */
export const cloudObjectsQuerySchema = z.object({
	/** Folder path to list; empty lists the bucket root. */
	prefix: z.string().max(1_000).default(""),
	/** The `nextCursor` of the previous answer: the offset as decimal digits. */
	cursor: z
		.string()
		.regex(/^\d{1,9}$/)
		.optional(),
});

/** TypeScript objects query. */
export type CloudObjectsQuery = z.infer<typeof cloudObjectsQuerySchema>;

/** One object or folder in a bucket listing. */
export const cloudObjectSchema = z.object({
	/** Name inside the prefix, for example "avatar.png". */
	name: z.string(),
	/** Full path inside the bucket: the prefix plus the name. */
	path: z.string(),
	isFolder: z.boolean(),
	/** Size in bytes; null on a folder. */
	sizeBytes: z.int().nonnegative().nullable(),
	mimeType: z.string().nullable(),
	updatedAt: z.string().nullable(),
	/** Signed download URL, valid `CLOUD_SIGNED_URL_TTL_SECONDS`; null on a folder. */
	downloadUrl: z.string().nullable(),
});

/** TypeScript storage object. */
export type CloudObject = z.infer<typeof cloudObjectSchema>;

/** Answer of `GET cloud/storage/buckets/:bucket/objects`. */
export const cloudObjectsResponseSchema = z.object({
	items: z.array(cloudObjectSchema),
	/** Cursor of the next page; null on the last page. */
	nextCursor: z.string().nullable(),
});

/** TypeScript objects answer. */
export type CloudObjectsResponse = z.infer<typeof cloudObjectsResponseSchema>;

/** Body of `POST cloud/storage/buckets/:bucket/objects/upload-url`. */
export const cloudUploadUrlBodySchema = z.object({
	path: cloudObjectPathSchema,
});

/** TypeScript upload-url body. */
export type CloudUploadUrlBody = z.infer<typeof cloudUploadUrlBodySchema>;

/**
 * Answer of the upload-url route. The browser sends a `PUT` with the file
 * as the body to `uploadUrl`; Supabase keeps the URL valid for two hours.
 */
export const cloudUploadUrlResponseSchema = z.object({
	uploadUrl: z.string(),
	path: z.string(),
});

/** TypeScript upload-url answer. */
export type CloudUploadUrlResponse = z.infer<
	typeof cloudUploadUrlResponseSchema
>;

/** Body of `DELETE cloud/storage/buckets/:bucket/objects`: at most 100 paths. */
export const cloudDeleteObjectsBodySchema = z.object({
	paths: z.array(cloudObjectPathSchema).min(1).max(100),
});

/** TypeScript delete-objects body. */
export type CloudDeleteObjectsBody = z.infer<
	typeof cloudDeleteObjectsBodySchema
>;

/** Answer of the delete-objects route: how many objects Supabase removed. */
export const cloudDeleteObjectsResponseSchema = z.object({
	deleted: z.int().nonnegative(),
});

/** TypeScript delete-objects answer. */
export type CloudDeleteObjectsResponse = z.infer<
	typeof cloudDeleteObjectsResponseSchema
>;

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

/** Log tables the route reads: `edge_logs`, `postgres_logs`, `function_edge_logs`. */
export const cloudLogSources = ["api", "postgres", "functions"] as const;

/** Validates `source` in the logs query. */
export const cloudLogSourceSchema = z.enum(cloudLogSources);

/** TypeScript log source. */
export type CloudLogSource = z.infer<typeof cloudLogSourceSchema>;

/** Levels the route maps HTTP status classes and Postgres severities to. */
export const cloudLogLevels = ["info", "warning", "error"] as const;

/** Validates `level` in the logs query and the entries. */
export const cloudLogLevelSchema = z.enum(cloudLogLevels);

/** TypeScript log level. */
export type CloudLogLevel = z.infer<typeof cloudLogLevelSchema>;

/** Widest window `GET cloud/logs` accepts: 24 hours in milliseconds. */
export const CLOUD_LOGS_MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Entries one logs answer carries at most. */
export const CLOUD_LOGS_PAGE_SIZE = 100;

/** Query of `GET cloud/logs`. `end` minus `start` must stay under 24 hours. */
export const cloudLogsQuerySchema = z.object({
	source: cloudLogSourceSchema,
	start: isoDateTimeSchema,
	end: isoDateTimeSchema,
	level: cloudLogLevelSchema.optional(),
	/** Substring of the event message; at most 200 characters. */
	search: z.string().trim().min(1).max(200).optional(),
});

/** TypeScript logs query. */
export type CloudLogsQuery = z.infer<typeof cloudLogsQuerySchema>;

/** One log line. */
export const cloudLogEntrySchema = z.object({
	id: z.string(),
	timestamp: isoDateTimeSchema,
	level: cloudLogLevelSchema,
	message: z.string(),
});

/** TypeScript log entry. */
export type CloudLogEntry = z.infer<typeof cloudLogEntrySchema>;

/** Answer of `GET cloud/logs`, newest first, at most `CLOUD_LOGS_PAGE_SIZE`. */
export const cloudLogsResponseSchema = z.object({
	entries: z.array(cloudLogEntrySchema),
});

/** TypeScript logs answer. */
export type CloudLogsResponse = z.infer<typeof cloudLogsResponseSchema>;

// ---------------------------------------------------------------------------
// Functions and jobs
// ---------------------------------------------------------------------------

/** One Edge Function with its last deploy and its 24-hour call count. */
export const cloudFunctionSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	/** Supabase status text, for example "ACTIVE". */
	status: z.string(),
	version: z.int().nonnegative(),
	/** Time of the last deploy, from the function's `updated_at`. */
	lastDeployedAt: isoDateTimeSchema,
	/** Calls in the last 24 hours, counted from `function_edge_logs`. */
	invocations24h: z.int().nonnegative(),
});

/** TypeScript Edge Function. */
export type CloudFunction = z.infer<typeof cloudFunctionSchema>;

/** Answer of `GET cloud/functions`. */
export const cloudFunctionsResponseSchema = z.object({
	functions: z.array(cloudFunctionSchema),
});

/** TypeScript functions answer. */
export type CloudFunctionsResponse = z.infer<
	typeof cloudFunctionsResponseSchema
>;

/** One row of `cron.job_run_details`. */
export const cloudJobRunSchema = z.object({
	runId: z.int(),
	/** pg_cron status text, for example "succeeded"; null while the run is open. */
	status: z.string().nullable(),
	startTime: isoDateTimeSchema.nullable(),
	endTime: isoDateTimeSchema.nullable(),
	returnMessage: z.string().nullable(),
});

/** TypeScript job run. */
export type CloudJobRun = z.infer<typeof cloudJobRunSchema>;

/** Runs the jobs answer carries per job, newest first. */
export const CLOUD_JOB_RUNS_PER_JOB = 20;

/** One row of `cron.job` with its last runs. */
export const cloudJobSchema = z.object({
	jobId: z.int(),
	/** pg_cron job name; null on an unnamed job. */
	name: z.string().nullable(),
	/** Cron expression, for example "0 3 * * *". */
	schedule: z.string(),
	command: z.string(),
	active: z.boolean(),
	runs: z.array(cloudJobRunSchema),
});

/** TypeScript job. */
export type CloudJob = z.infer<typeof cloudJobSchema>;

/** Answer of `GET cloud/jobs`. */
export const cloudJobsResponseSchema = z.object({
	/** False when the `pg_cron` extension is not installed; `jobs` is then empty. */
	installed: z.boolean(),
	jobs: z.array(cloudJobSchema),
});

/** TypeScript jobs answer. */
export type CloudJobsResponse = z.infer<typeof cloudJobsResponseSchema>;

// ---------------------------------------------------------------------------
// Server-side row shapes. The API parses the backend's SQL and log answers
// with these before it maps them to the route answers above. The browser
// never receives them. Dates are ISO text from `to_char` in the SQL.
// ---------------------------------------------------------------------------

/** One row of the tables query: one column of one `public` base table. */
export const cloudTableColumnRowSchema = z.object({
	table_name: z.string(),
	column_name: z.string(),
	data_type: z.string(),
	is_nullable: z.boolean(),
	column_default: z.string().nullable(),
	/** `pg_stat_user_tables.n_live_tup` cast to float8, so big counts stay a JSON number. */
	row_estimate: z.number().nonnegative(),
});

/** The one row of a `count(*)` query, cast to float8. */
export const cloudCountRowSchema = z.object({
	count: z.number().nonnegative(),
});

/**
 * The one row of a paged query: the exact `count(*)` of the table and the
 * page as a JSON array built with `json_agg`.
 */
export function cloudPageRowSchema<TItem extends z.ZodType>(itemSchema: TItem) {
	return z.object({
		total: z.number().nonnegative(),
		items: z.array(itemSchema),
	});
}

/** One `auth.users` row as the users query selects it. */
export const cloudAuthUserRowSchema = z.object({
	id: z.string(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	created_at: isoDateTimeSchema,
	last_sign_in_at: isoDateTimeSchema.nullable(),
	provider: z.string().nullable(),
});

/** One row of the sign-ups query: one day and its count. */
export const cloudSignupRowSchema = z.object({
	date: isoDateSchema,
	count: z.number().nonnegative(),
});

/** The one row of the `to_regclass('cron.job')` check. */
export const cloudInstalledRowSchema = z.object({
	installed: z.boolean(),
});

/** One `cron.job` row with its last runs as a JSON array. */
export const cloudJobRowSchema = z.object({
	jobid: z.int(),
	jobname: z.string().nullable(),
	schedule: z.string(),
	command: z.string(),
	active: z.boolean(),
	runs: z.array(
		z.object({
			runid: z.int(),
			status: z.string().nullable(),
			start_time: isoDateTimeSchema.nullable(),
			end_time: isoDateTimeSchema.nullable(),
			return_message: z.string().nullable(),
		}),
	),
});

/**
 * One log line as the analytics endpoint answers it. `timestamp` is unix
 * microseconds or ISO text (UNVERIFIED which one the endpoint sends).
 */
export const cloudLogRowSchema = z.object({
	id: z.string(),
	timestamp: z.union([z.number(), z.iso.datetime({ offset: true })]),
	event_message: z.string().nullable(),
	/** HTTP status code (api, functions) or Postgres severity text (postgres); null when absent. */
	level_value: z.union([z.number(), z.string()]).nullable(),
});

/** One row of the 24-hour invocation count query, grouped by function id. */
export const cloudFunctionCountRowSchema = z.object({
	function_id: z.string().nullable(),
	count: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const cloudBase = (projectId: string) => `/api/v2/projects/${projectId}/cloud`;

/** Every route of the Cloud tab. All need the workspace header and `project:update`. */
export const cloudRoutes = {
	// GET the backend state; POST creates the backend when the project has none.
	backend: (projectId: string) => `${cloudBase(projectId)}/backend`,
	// POST wakes a paused backend.
	restoreBackend: (projectId: string) =>
		`${cloudBase(projectId)}/backend/restore`,
	// GET the `public` tables with columns and row counts.
	tables: (projectId: string) => `${cloudBase(projectId)}/tables`,
	// GET one page of rows of one table.
	rows: (projectId: string, table: string) =>
		`${cloudBase(projectId)}/tables/${encodeURIComponent(table)}/rows`,
	// POST one SQL statement from the console.
	sql: (projectId: string) => `${cloudBase(projectId)}/sql`,
	// GET one page of `auth.users`.
	authUsers: (projectId: string) => `${cloudBase(projectId)}/auth/users`,
	// GET the sign-ups per day of the last 30 days.
	authSignups: (projectId: string) => `${cloudBase(projectId)}/auth/signups`,
	// GET the Storage buckets.
	buckets: (projectId: string) => `${cloudBase(projectId)}/storage/buckets`,
	// GET one page of objects; DELETE removes the listed paths.
	objects: (projectId: string, bucket: string) =>
		`${cloudBase(projectId)}/storage/buckets/${encodeURIComponent(bucket)}/objects`,
	// POST a signed upload URL for one path.
	uploadUrl: (projectId: string, bucket: string) =>
		`${cloudBase(projectId)}/storage/buckets/${encodeURIComponent(bucket)}/objects/upload-url`,
	// GET log lines of one source inside a window of at most 24 hours.
	logs: (projectId: string) => `${cloudBase(projectId)}/logs`,
	// GET the Edge Functions with deploy time and 24-hour call counts.
	functions: (projectId: string) => `${cloudBase(projectId)}/functions`,
	// GET the pg_cron jobs with their last runs.
	jobs: (projectId: string) => `${cloudBase(projectId)}/jobs`,
} as const;
