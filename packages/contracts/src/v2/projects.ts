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
import { uuidSchema } from "../v1/shared/primitives";
import { projectEngineSchema } from "../v1/shared/project-engine";
import { targetPlatformSchema } from "../v1/shared/target-platform";

// The engine enum moved to the V1 shared folder (WANDIT-175): the V1
// `projectSchema` carries it now. This line keeps earlier V2 imports working.
export {
	type ProjectEngine,
	projectEngineSchema,
	projectEngines,
} from "../v1/shared/project-engine";

// The target platform enum moved to the V1 shared folder (WANDIT-192): the
// V1 `projectSchema` carries it now. This line keeps V2 imports working.
export {
	type TargetPlatform,
	targetPlatformSchema,
	targetPlatforms,
} from "../v1/shared/target-platform";

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
 * Answer of `POST /api/v2/projects`: the ids the web app needs to open the
 * workspace and follow the first turn.
 */
export const createAppProjectResponseSchema = z.object({
	projectId: uuidSchema,
	chatId: uuidSchema,
	// Id of the first builder turn. Null when the turn could not start; the
	// web app sends the first message again through POST .../turns.
	turnId: uuidSchema.nullable(),
});

/** TypeScript create-app-project response. */
export type CreateAppProjectResponse = z.infer<
	typeof createAppProjectResponseSchema
>;

/**
 * A V2 project row over the API: the V1 project fields plus the app-engine
 * fields. `framework`/`templateVersion` name the template the sandbox
 * boots from; null until the create flow assigns them.
 */
export const appProjectSchema = projectSchema.extend({
	engine: projectEngineSchema,
	targetPlatform: targetPlatformSchema.nullable(),
	// Template archive prefix: "web-app" or "mobile-app". The sandbox boots
	// from `templates/<framework>-<semver>.tar.gz`.
	framework: z.string().nullable(),
	// Version of the template the project was created from.
	templateVersion: z.string().nullable(),
	languages: z.array(appLanguageSchema),
});

/** TypeScript V2 app project type. */
export type AppProject = z.infer<typeof appProjectSchema>;
