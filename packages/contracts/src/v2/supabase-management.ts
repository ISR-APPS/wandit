/**
 * Schemas for the Supabase Management API answers wandit reads.
 * The server client `supabase-management.client.ts` parses each response
 * with them; the provisioning runtime reads the enum types.
 *
 * Covered paths, base `https://api.supabase.com/v1`:
 * - POST  /projects
 * - GET   /projects/{ref}
 * - GET   /projects/{ref}/api-keys?reveal=true
 * - POST  /projects/{ref}/database/query
 * - PATCH /projects/{ref}/config/auth
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

/**
 * Public URL of a Supabase project. The builder-turn runtime writes it as
 * `VITE_SUPABASE_URL` into the sandbox env.
 */
export function supabaseProjectUrl(ref: string): string {
	return `https://${ref}.supabase.co`;
}
