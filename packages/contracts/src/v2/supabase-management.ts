/**
 * Schemas for the Supabase Management API answers wandit reads.
 * The server client `supabase-management.client.ts` parses each response
 * with them; the provisioning runtime reads the enum types.
 *
 * Covered paths, base `https://api.supabase.com/v1`:
 * - POST  /projects
 * - GET   /projects/{ref}
 * - POST  /projects/{ref}/restore
 * - GET   /projects/{ref}/api-keys?reveal=true
 * - POST  /projects/{ref}/database/query
 * - PATCH /projects/{ref}/config/auth
 * - GET   /projects/{ref}/storage/buckets
 * - GET   /projects/{ref}/functions
 * - POST  /projects/{ref}/functions/deploy (multipart, WANDIT-186)
 * - POST  /projects/{ref}/secrets (WANDIT-186)
 * - GET   /projects/{ref}/advisors/{security|performance} (WANDIT-186)
 * - GET   /projects/{ref}/analytics/endpoints/logs.all
 *
 * Covered paths of the project Storage API, base
 * `https://{ref}.supabase.co/storage/v1` (the Cloud tab, WANDIT-187):
 * - POST   /object/list/{bucket}
 * - POST   /object/sign/{bucket}
 * - POST   /object/upload/sign/{bucket}/{path}
 * - DELETE /object/{bucket}
 */
import { z } from "zod";

/** Regions the Management API accepts on project create. */
export const supabaseRegions = [
	"us-east-1",
	"us-east-2",
	"us-west-1",
	"us-west-2",
	"ap-east-1",
	"ap-southeast-1",
	"ap-northeast-1",
	"ap-northeast-2",
	"ap-southeast-2",
	"eu-west-1",
	"eu-west-2",
	"eu-west-3",
	"eu-north-1",
	"eu-central-1",
	"eu-central-2",
	"ca-central-1",
	"ap-south-1",
	"sa-east-1",
] as const;

/** Zod source of `SupabaseRegion`; accepts only codes the create call takes. */
export const supabaseRegionSchema = z.enum(supabaseRegions);

/** Value of `region` in the create body; `BackendRegion` in the server is its EU subset. */
export type SupabaseRegion = z.infer<typeof supabaseRegionSchema>;

/** Instance sizes the Management API accepts on project create. */
export const supabaseInstanceSizes = [
	"nano",
	"micro",
	"small",
	"medium",
	"large",
	"xlarge",
	"2xlarge",
	"4xlarge",
	"8xlarge",
	"12xlarge",
	"16xlarge",
	"24xlarge",
	"24xlarge_optimized_memory",
	"24xlarge_optimized_cpu",
	"24xlarge_high_memory",
	"48xlarge",
	"48xlarge_optimized_memory",
	"48xlarge_optimized_cpu",
	"48xlarge_high_memory",
] as const;

/** Zod source of `SupabaseInstanceSize`; accepts only sizes the create call takes. */
export const supabaseInstanceSizeSchema = z.enum(supabaseInstanceSizes);

/** Value of `desired_instance_size`; `SUPABASE_PLATFORM_INSTANCE_SIZE` must be one of these. */
export type SupabaseInstanceSize = z.infer<typeof supabaseInstanceSizeSchema>;

/** Lifecycle states a Supabase project reports. */
export const supabaseProjectStatuses = [
	"INACTIVE",
	"ACTIVE_HEALTHY",
	"ACTIVE_UNHEALTHY",
	"COMING_UP",
	"UNKNOWN",
	"GOING_DOWN",
	"INIT_FAILED",
	"REMOVED",
	"RESTORING",
	"UPGRADING",
	"PAUSING",
	"RESTORE_FAILED",
	"RESTARTING",
	"PAUSE_FAILED",
	"RESIZING",
] as const;

/** Validates `status` in the create-project and get-project answers. */
export const supabaseProjectStatusSchema = z.enum(supabaseProjectStatuses);

/** Status `SupabaseManagementClient.getProject` answers. */
export type SupabaseProjectStatus = z.infer<typeof supabaseProjectStatusSchema>;

/**
 * Answer of `POST /projects` (201). `id` and `organization_id` are
 * deprecated upstream but still required fields of the response.
 */
export const supabaseCreateProjectResponseSchema = z.object({
	id: z.string(),
	// The ref is the public id of the project: 20 lower-case letters.
	ref: z
		.string()
		.length(20)
		.regex(/^[a-z]+$/),
	organization_id: z.string(),
	organization_slug: z.string(),
	name: z.string(),
	region: z.string(),
	status: supabaseProjectStatusSchema,
	created_at: z.string(),
});

/** Parsed answer of `SupabaseManagementClient.createProject`. */
export type SupabaseCreateProjectResponse = z.infer<
	typeof supabaseCreateProjectResponseSchema
>;

/**
 * Answer of `GET /projects/{ref}` (200): the create fields plus the
 * database endpoint block. `database.host` is the Postgres host of the
 * project.
 */
export const supabaseProjectResponseSchema =
	supabaseCreateProjectResponseSchema.extend({
		database: z.object({
			host: z.string().min(1),
			version: z.string(),
			postgres_engine: z.string(),
			release_channel: z.string(),
		}),
	});

/** Parsed answer of `SupabaseManagementClient.getProject`. */
export type SupabaseProjectResponse = z.infer<
	typeof supabaseProjectResponseSchema
>;

/**
 * One entry of the `GET /projects/{ref}/api-keys?reveal=true` answer.
 * `api_key` is null when `reveal` is absent; the client always sends
 * `reveal=true`. Zod strips the other documented fields.
 */
export const supabaseApiKeySchema = z.object({
	name: z.string(),
	api_key: z.string().nullable().optional(),
	id: z.string().nullable().optional(),
	prefix: z.string().nullable().optional(),
	type: z.enum(["legacy", "publishable", "secret"]).nullable().optional(),
});

/** One entry of the answer `SupabaseManagementClient.getApiKeys` parses. */
export type SupabaseApiKey = z.infer<typeof supabaseApiKeySchema>;

/** The api-keys answer is a bare array of entries. */
export const supabaseApiKeysResponseSchema = z.array(supabaseApiKeySchema);

/** Parsed answer of `SupabaseManagementClient.getApiKeys`. */
export type SupabaseApiKeysResponse = z.infer<
	typeof supabaseApiKeysResponseSchema
>;

/**
 * The fields the client reads out of the `PATCH /projects/{ref}/config/auth`
 * answer (200). The response carries over 200 fields; zod strips the rest.
 */
export const supabaseAuthConfigResponseSchema = z.object({
	site_url: z.string().nullable(),
	uri_allow_list: z.string().nullable(),
	external_email_enabled: z.boolean().nullable(),
});

/** Parsed answer of `SupabaseManagementClient.updateAuthConfig`. */
export type SupabaseAuthConfigResponse = z.infer<
	typeof supabaseAuthConfigResponseSchema
>;

/** Error body of the Management API: a `message` field when present. */
export const supabaseErrorBodySchema = z.object({
	message: z.string().optional(),
});

/** One bucket of `GET /projects/{ref}/storage/buckets`. */
export const supabaseBucketSchema = z.object({
	id: z.string(),
	name: z.string(),
	public: z.boolean(),
	created_at: z.string(),
	updated_at: z.string(),
});

/** One bucket `SupabaseManagementClient.listBuckets` answers. */
export type SupabaseBucket = z.infer<typeof supabaseBucketSchema>;

/** The buckets answer is a bare array. */
export const supabaseBucketsResponseSchema = z.array(supabaseBucketSchema);

/**
 * One function of `GET /projects/{ref}/functions`. `created_at` and
 * `updated_at` are unix milliseconds. Zod strips the other fields.
 */
export const supabaseFunctionSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	status: z.string(),
	version: z.int().nonnegative(),
	created_at: z.number(),
	updated_at: z.number(),
});

/** One function `SupabaseManagementClient.listFunctions` answers. */
export type SupabaseFunction = z.infer<typeof supabaseFunctionSchema>;

/** The functions answer is a bare array. */
export const supabaseFunctionsResponseSchema = z.array(supabaseFunctionSchema);

/**
 * Answer of `POST /projects/{ref}/functions/deploy` (OpenAPI operation
 * `v1-deploy-a-function`, 201). Zod strips the optional fields.
 */
export const supabaseDeployFunctionResponseSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	// `ACTIVE`, `REMOVED`, or `THROTTLED` upstream; a string, like the list answer.
	status: z.string(),
	version: z.int().nonnegative(),
});

/** The deployed function `SupabaseManagementClient.deployFunction` answers. */
export type SupabaseDeployedFunction = z.infer<
	typeof supabaseDeployFunctionResponseSchema
>;

/** The two advisor lists of `GET /projects/{ref}/advisors/{kind}`. */
export const supabaseAdvisorKinds = ["security", "performance"] as const;

/** One advisor list; `AdvisorsService` reads both. */
export type SupabaseAdvisorKind = (typeof supabaseAdvisorKinds)[number];

/**
 * One lint of the advisors answer (OpenAPI `V1ProjectAdvisorsResponse`,
 * operations `v1-get-security-advisors` and `v1-get-performance-advisors`).
 * `name` stays a string: a new upstream lint must not fail the call.
 * The spec marks `facing`, `categories`, and `cache_key` required; the code
 * does not read them, so they are optional here.
 */
export const supabaseAdvisorLintSchema = z.object({
	// The lint id, for example `rls_disabled_in_public`.
	name: z.string(),
	title: z.string(),
	level: z.enum(["ERROR", "WARN", "INFO"]),
	facing: z.string().optional(),
	categories: z.array(z.string()).optional(),
	description: z.string(),
	detail: z.string(),
	// A docs URL in practice; the spec types it as a plain string.
	remediation: z.string(),
	metadata: z
		.object({
			schema: z.string().optional(),
			name: z.string().optional(),
			entity: z.string().optional(),
			// `table`, `view`, `materialized view`, `foreign table`, `function`, ...
			type: z.string().optional(),
			fkey_name: z.string().optional(),
			fkey_columns: z.array(z.number()).optional(),
		})
		.optional(),
	cache_key: z.string().optional(),
});

/** One lint `SupabaseManagementClient.getAdvisors` answers. */
export type SupabaseAdvisorLint = z.infer<typeof supabaseAdvisorLintSchema>;

/** The advisors answer: the lints under `lints`. */
export const supabaseAdvisorsResponseSchema = z.object({
	lints: z.array(supabaseAdvisorLintSchema),
});

/**
 * Answer of `GET /projects/{ref}/analytics/endpoints/logs.all`: the rows in
 * `result`, or an `error` text when the SQL failed (UNVERIFIED shape). The
 * caller passes the row schema of its own SQL.
 */
export function supabaseLogsResponseSchema<TRow extends z.ZodType>(
	rowSchema: TRow,
) {
	return z.object({
		result: z.array(rowSchema).optional(),
		error: z.string().nullable().optional(),
	});
}

/**
 * One entry of `POST /object/list/{bucket}`. A folder carries a null `id`
 * and no `metadata`.
 */
export const supabaseStorageObjectSchema = z.object({
	name: z.string(),
	id: z.string().nullable(),
	updated_at: z.string().nullable().optional(),
	metadata: z
		.object({
			size: z.int().nonnegative().optional(),
			mimetype: z.string().optional(),
		})
		.nullable()
		.optional(),
});

/** One entry `SupabaseManagementClient.listObjects` answers. */
export type SupabaseStorageObject = z.infer<typeof supabaseStorageObjectSchema>;

/** The list answer is a bare array. */
export const supabaseStorageObjectsResponseSchema = z.array(
	supabaseStorageObjectSchema,
);

/**
 * One entry of the batch sign answer `POST /object/sign/{bucket}`.
 * `signedURL` is a path under the Storage base URL; `error` is set when
 * the object is missing.
 */
export const supabaseSignedUrlSchema = z.object({
	path: z.string().nullable(),
	signedURL: z.string().nullable(),
	error: z.string().nullable(),
});

/** The batch sign answer is a bare array, one entry per input path. */
export const supabaseSignedUrlsResponseSchema = z.array(
	supabaseSignedUrlSchema,
);

/** Answer of `POST /object/upload/sign/{bucket}/{path}`: a path with the token query. */
export const supabaseUploadUrlResponseSchema = z.object({
	url: z.string(),
});

/** Answer of `DELETE /object/{bucket}`: one entry per removed object. */
export const supabaseDeletedObjectsResponseSchema = z.array(
	z.object({ name: z.string() }),
);

/**
 * Public URL of a Supabase project. The builder-turn runtime writes it as
 * `VITE_SUPABASE_URL` into the sandbox env.
 */
export function supabaseProjectUrl(ref: string): string {
	return `https://${ref}.supabase.co`;
}

/** Base URL of the project Storage API the Cloud routes call. */
export function supabaseStorageUrl(ref: string): string {
	return `${supabaseProjectUrl(ref)}/storage/v1`;
}
