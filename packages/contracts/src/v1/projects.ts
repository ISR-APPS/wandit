/**
 * Shared contract for projects.
 *
 * Used by frontend and API for project list/get/create/update/delete.
 * Creating a project from a prompt also starts the first chat generation.
 */
// Zod validates real JSON at runtime.
import { z } from "zod";
// Uploaded-attachment references ride the create body (V2 spec §11).
import { fileRefSchema } from "./attachments";
// Composer settings are shared with chat messages.
import { composerMetadataSchema } from "./chats";
// Shared id/date validators.
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Shared HTTP agreement for Projects & Dashboard
// (docs/features/projects-dashboard.md) — the exemplar domain file: new
// domains copy this idiom. apps/web derives its feature dto from these
// (z.infer re-exports, never redeclared); the server validates against the
// same schemas.

// Public project lifecycle labels.
export const projectStatuses = ["draft", "publishing", "published"] as const;

// Runtime validator for project status.
export const projectStatusSchema = z.enum(projectStatuses);

// TypeScript project status type.
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

// Project shape returned by list/get/update endpoints.
export const projectSchema = z.object({
	id: uuidSchema,
	name: z.string(),
	// First user prompt shown on dashboard.
	prompt: z.string(),
	status: projectStatusSchema,
	leadCount: z.int().min(0),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
	// Temporary thumbnail seed until real thumbnails exist.
	thumbnailSeed: z.number(),
	publishedSlug: z.string().optional(),
	// Ad pixels injected into the published page at publish time.
	metaPixelId: z.string().nullable(),
	tiktokPixelId: z.string().nullable(),
});

// TypeScript project type.
export type Project = z.infer<typeof projectSchema>;

// Dashboard list response.
export const listProjectsResponseSchema = z.array(projectSchema);

// TypeScript list response.
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

// Max length for the first prompt that creates a project.
export const projectPromptMaxLength = 2000;

// Body for creating a project from a prompt. The composer allows
// attachment-only submissions, so the prompt may be empty WHEN at least one
// attachment rides along — never both empty.
export const createProjectBodySchema = z
	.object({
		prompt: z.string().max(projectPromptMaxLength),
		composer: composerMetadataSchema.optional(),
		// First-message assets already uploaded through /api/v1/attachments — the
		// server persists them as file parts on the chat's first user message.
		attachments: z.array(fileRefSchema).max(6).optional(),
	})
	.refine(
		(body) =>
			body.prompt.trim().length > 0 || (body.attachments?.length ?? 0) > 0,
		{
			message: "prompt or at least one attachment is required",
			path: ["prompt"],
		},
	);

// TypeScript create body.
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

// Create returns ids only. The first assistant answer streams later.
export const createProjectResponseSchema = z.object({
	projectId: uuidSchema,
	chatId: uuidSchema,
});

// TypeScript create response.
export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;

// Body for updating project settings.
export const updateProjectBodySchema = z.object({
	name: z.string().min(1).max(120).optional(),
	// null clears the pixel id; undefined leaves it unchanged.
	metaPixelId: z.string().nullable().optional(),
	tiktokPixelId: z.string().nullable().optional(),
});

// TypeScript update body.
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;

// GET one project response.
export const projectByIdResponseSchema = projectSchema;

// TypeScript get response.
export type ProjectByIdResponse = z.infer<typeof projectByIdResponseSchema>;

// PATCH response.
export const updateProjectResponseSchema = projectSchema;

// TypeScript update response.
export type UpdateProjectResponse = z.infer<typeof updateProjectResponseSchema>;

// DELETE returns no JSON body.
export const deleteProjectResponseSchema = z.void();

// TypeScript delete response.
export type DeleteProjectResponse = z.infer<typeof deleteProjectResponseSchema>;

// Route path builders. These return strings; they do not make network calls.
export const projectsRoutes = {
	// GET dashboard projects.
	list: "/api/v1/projects",
	// POST create project and start first generation.
	create: "/api/v1/projects",
	// GET one project.
	byId: (projectId: string) => `/api/v1/projects/${projectId}`,
	// PATCH one project.
	update: (projectId: string) => `/api/v1/projects/${projectId}`,
	// DELETE soft-deletes one project.
	delete: (projectId: string) => `/api/v1/projects/${projectId}`,
} as const;
