import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Publishing & Site Serving contracts (docs/features/publishing-serving.md).
// Each publish attempt is its own row: pending → active | failed; a newer
// publish supersedes the previous one, unpublish frees the slug.

// Mirrors deployment_status in packages/db/src/schema/deployments.ts.
export const deploymentStatuses = [
	"pending",
	"active",
	"failed",
	"superseded",
	"unpublished",
] as const;

export const deploymentStatusSchema = z.enum(deploymentStatuses);

export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;

// What the workspace UI renders. Server-side mapping:
// pending → publishing · active → published · failed → failed ·
// superseded | unpublished | no row → draft.
export const deploymentUiStates = [
	"draft",
	"publishing",
	"published",
	"failed",
] as const;

export const deploymentUiStateSchema = z.enum(deploymentUiStates);

export type DeploymentUiState = z.infer<typeof deploymentUiStateSchema>;

// Canonical lowercase DNS label for {slug}.wandit.app — same shape the
// deployments_slug_dns_label_ck check enforces in Postgres, and the same
// regex as isValidSlug in the web workspace helpers. Keep all three in
// lockstep.
export const deploymentSlugSchema = z
	.string()
	.max(63)
	.regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

/*
 * Hostnames on the sites zone that must never become a customer site.
 * `customers` is non-negotiable: it is the live DOMAINS_FALLBACK_ORIGIN for
 * Cloudflare-for-SaaS custom hostnames. The rest reserve app surfaces and
 * common infrastructure labels.
 */
export const RESERVED_SLUGS = [
	"account",
	"admin",
	"api",
	"app",
	"assets",
	"auth",
	"billing",
	"blog",
	"cdn",
	"customers",
	"dashboard",
	"dev",
	"docs",
	"ftp",
	"help",
	"login",
	"mail",
	"preview",
	"smtp",
	"staging",
	"static",
	"status",
	"support",
	"test",
	"wandit",
	"www",
] as const;

export function isReservedSlug(slug: string): boolean {
	return (RESERVED_SLUGS as readonly string[]).includes(slug);
}

export const deploymentSchema = z.object({
	id: uuidSchema,
	projectId: uuidSchema,
	versionId: uuidSchema,
	slug: deploymentSlugSchema,
	status: deploymentStatusSchema,
	error: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type Deployment = z.infer<typeof deploymentSchema>;

/*
 * The single "what should the publish UI show" answer for a project.
 * liveUrl is server-derived (https://{slug}.{SITES_DOMAIN}) so the web
 * never hardcodes the sites domain.
 */
export const deploymentCurrentSchema = z.object({
	uiState: deploymentUiStateSchema,
	// The slug of the live (or in-flight) deployment; null when never
	// published. The web uses it to prefill the slug editor.
	slug: deploymentSlugSchema.nullable(),
	activeDeploymentId: uuidSchema.nullable(),
	publishedVersionId: uuidSchema.nullable(),
	// The draft pointer (artifacts.activeVersionId) — what publish would ship.
	pendingVersionId: uuidSchema.nullable(),
	publishedAt: isoDateTimeSchema.nullable(),
	liveUrl: z.url().nullable(),
	// Failure summary of the most recent attempt when uiState === "failed".
	error: z.string().nullable(),
});

export type DeploymentCurrent = z.infer<typeof deploymentCurrentSchema>;

export const publishDeploymentBodySchema = z.object({
	// Omitted → server keeps the live slug, or generates one from the
	// project name on first publish.
	slug: deploymentSlugSchema.optional(),
	// Omitted → the project's current draft version (artifacts.activeVersionId).
	versionId: uuidSchema.optional(),
});

export type PublishDeploymentBody = z.infer<typeof publishDeploymentBodySchema>;

export const publishDeploymentResponseSchema = z.object({
	deployment: deploymentSchema,
	current: deploymentCurrentSchema,
});

export type PublishDeploymentResponse = z.infer<
	typeof publishDeploymentResponseSchema
>;

export const rollbackDeploymentBodySchema = z.object({
	// The historical deployment whose bytes to restore. A rollback is a
	// normal publish of that deployment's version under the current slug.
	deploymentId: uuidSchema,
});

export type RollbackDeploymentBody = z.infer<
	typeof rollbackDeploymentBodySchema
>;

export const deploymentCurrentResponseSchema = z.object({
	current: deploymentCurrentSchema,
});

export type DeploymentCurrentResponse = z.infer<
	typeof deploymentCurrentResponseSchema
>;

export const listDeploymentsResponseSchema = z.object({
	deployments: z.array(deploymentSchema),
});

export type ListDeploymentsResponse = z.infer<
	typeof listDeploymentsResponseSchema
>;

export const slugAvailabilityQuerySchema = z.object({
	slug: deploymentSlugSchema,
});

export type SlugAvailabilityQuery = z.infer<typeof slugAvailabilityQuerySchema>;

export const slugAvailabilityResponseSchema = z.object({
	slug: deploymentSlugSchema,
	available: z.boolean(),
	// Why an unavailable slug is unavailable — lets the UI phrase it.
	reason: z.enum(["taken", "reserved"]).nullable(),
});

export type SlugAvailabilityResponse = z.infer<
	typeof slugAvailabilityResponseSchema
>;

export const deploymentsRoutes = {
	listByProject: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments`,
	current: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments/current`,
	publish: (projectId: string) => `/api/v1/projects/${projectId}/deployments`,
	unpublish: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments/active`,
	rollback: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments/rollback`,
	slugAvailability: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments/slug-availability`,
} as const;
