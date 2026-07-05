import { z } from "zod";
import { composerMetadataSchema } from "./chats";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Shared HTTP agreement for Projects & Dashboard
// (docs/features/projects-dashboard.md) — the exemplar domain file: new
// domains copy this idiom. apps/web derives its feature dto from these
// (z.infer re-exports, never redeclared); the server validates against the
// same schemas.

// Derived server-side from the project's deployments: no live deployment →
// draft, publish in flight → publishing, active deployment → published.
export const projectStatuses = ["draft", "publishing", "published"] as const;

export const projectStatusSchema = z.enum(projectStatuses);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = z.object({
	id: uuidSchema,
	name: z.string(),
	// The first user prompt — dashboard card subtitle.
	prompt: z.string(),
	status: projectStatusSchema,
	leadCount: z.int().min(0),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
	// Deterministic placeholder-art seed until real page thumbnails land.
	thumbnailSeed: z.number(),
	publishedSlug: z.string().optional(),
});

export type Project = z.infer<typeof projectSchema>;

export const listProjectsResponseSchema = z.array(projectSchema);

export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

// Enforced in the PromptBox textarea too — the UI edge and the server pipe
// must reject at the same boundary.
export const projectPromptMaxLength = 2000;

export const createProjectBodySchema = z.object({
	prompt: z.string().min(1).max(projectPromptMaxLength),
	composer: composerMetadataSchema.optional(),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

// Create-with-prompt returns ids only (docs/features/projects-dashboard.md):
// the caller navigates to /p/{projectId} while the first generation is
// already streaming into the chat.
export const createProjectResponseSchema = z.object({
	projectId: uuidSchema,
	chatId: uuidSchema,
});

export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;

// PATCH /projects/:id — rename and pixel IDs (null clears a pixel).
export const updateProjectBodySchema = z.object({
	name: z.string().min(1).max(120).optional(),
	metaPixelId: z.string().nullable().optional(),
	tiktokPixelId: z.string().nullable().optional(),
});

export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;

export const projectByIdResponseSchema = projectSchema;

export type ProjectByIdResponse = z.infer<typeof projectByIdResponseSchema>;

export const updateProjectResponseSchema = projectSchema;

export type UpdateProjectResponse = z.infer<typeof updateProjectResponseSchema>;

export const deleteProjectResponseSchema = z.void();

export type DeleteProjectResponse = z.infer<typeof deleteProjectResponseSchema>;

export const projectsRoutes = {
	list: "/api/v1/projects",
	create: "/api/v1/projects",
	byId: (projectId: string) => `/api/v1/projects/${projectId}`,
	update: (projectId: string) => `/api/v1/projects/${projectId}`,
	delete: (projectId: string) => `/api/v1/projects/${projectId}`,
} as const;
