/**
 * Shared contract for V2 app projects.
 *
 * A V2 project is an app built inside a sandbox by the HarnessAgent.
 * V1 page projects keep the V1 contracts; this file only adds the fields
 * the app engine needs.
 */
import { z } from "zod";
import { fileRefSchema } from "../v1/attachments";
import { composerMetadataSchema } from "../v1/chats";
import { projectPromptMaxLength, projectSchema } from "../v1/projects";

/**
 * Which builder produced the project. Matches the `project_engine` database
 * enum (WANDIT-163). A project never changes engine after creation (D11).
 */
export const projectEngines = ["v1_page", "v2_app"] as const;

/** Runtime validator for a project engine. */
export const projectEngineSchema = z.enum(projectEngines);

/** TypeScript project engine type. */
export type ProjectEngine = z.infer<typeof projectEngineSchema>;

/** Device family a V2 app targets. Matches `project_target_platform`. */
export const targetPlatforms = ["web", "mobile"] as const;

/** Runtime validator for a target platform. */
export const targetPlatformSchema = z.enum(targetPlatforms);

/** TypeScript target platform type. */
export type TargetPlatform = z.infer<typeof targetPlatformSchema>;

/** Languages the agent must build in (D7: Arabic, French, English). */
export const appLanguages = ["ar", "fr", "en"] as const;

/** Runtime validator for an app language. */
export const appLanguageSchema = z.enum(appLanguages);

/** TypeScript app language type. */
export type AppLanguage = z.infer<typeof appLanguageSchema>;

/**
 * Body of `POST /api/v2/projects`. Same admission rule as V1: a non-empty
 * prompt or at least one attachment, never both empty.
 */
export const createAppProjectRequestSchema = z
	.object({
		prompt: z.string().max(projectPromptMaxLength),
		composer: composerMetadataSchema.optional(),
		attachments: z.array(fileRefSchema).max(6).optional(),
		targetPlatform: targetPlatformSchema.default("web"),
		// 1 to 3 languages the generated app ships in (D7).
		languages: z.array(appLanguageSchema).min(1).max(3),
	})
	.refine(
		(body) =>
			body.prompt.trim().length > 0 || (body.attachments?.length ?? 0) > 0,
		{
			message: "prompt or at least one attachment is required",
			path: ["prompt"],
		},
	);

/** TypeScript create-app-project body. */
export type CreateAppProjectRequest = z.infer<
	typeof createAppProjectRequestSchema
>;

/**
 * A V2 project row over the API: the V1 project fields plus the app-engine
 * fields. `framework`/`templateVersion` name the template the sandbox
 * boots from; null until the create flow assigns them.
 */
export const appProjectSchema = projectSchema.extend({
	engine: projectEngineSchema,
	targetPlatform: targetPlatformSchema.nullable(),
	// Template stack id, for example "tanstack-start" (D15).
	framework: z.string().nullable(),
	// Version of the template the project was created from.
	templateVersion: z.string().nullable(),
	languages: z.array(appLanguageSchema),
});

/** TypeScript V2 app project type. */
export type AppProject = z.infer<typeof appProjectSchema>;
