import { z } from "zod";

// Publishing & Site Serving contracts (docs/features/publishing-serving.md).
// Structural stub — schemas land with the feature slice. Each publish attempt
// is its own row: pending → active | failed; a newer publish supersedes the
// previous one, unpublish frees the slug.

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

// Canonical lowercase DNS label for {slug}.wandit.app — same shape the
// deployments_slug_dns_label_ck check enforces in Postgres.
export const deploymentSlugSchema = z
	.string()
	.max(63)
	.regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

// Draft route map — finalize with the feature slice.
export const deploymentsRoutes = {
	listByProject: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments`,
	publish: (projectId: string) => `/api/v1/projects/${projectId}/deployments`,
	unpublish: (projectId: string) =>
		`/api/v1/projects/${projectId}/deployments/active`,
} as const;
