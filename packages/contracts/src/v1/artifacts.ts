import { z } from "zod";

// Artifacts & versions contracts (docs/features/chat-generation.md).
// Structural stub — schemas land with the feature slice. Versions are
// immutable R2 pointers; every generation appends one and moves the
// artifact's active-version pointer, so rollback is always possible.

// MVP generates landing pages only; image/video/strategy are added later.
// Mirrors artifact_kind in packages/db/src/schema/artifacts.ts.
export const artifactKinds = ["landing_page"] as const;

export const artifactKindSchema = z.enum(artifactKinds);

export type ArtifactKind = z.infer<typeof artifactKindSchema>;

// Draft route map — finalize with the feature slice.
export const artifactsRoutes = {
	listByProject: (projectId: string) =>
		`/api/v1/projects/${projectId}/artifacts`,
	byId: (artifactId: string) => `/api/v1/artifacts/${artifactId}`,
	versions: (artifactId: string) => `/api/v1/artifacts/${artifactId}/versions`,
} as const;
