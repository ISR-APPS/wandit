/**
 * Contract of the write-only project secrets routes
 * (`/api/v2/projects/:id/secrets`, WANDIT-185).
 * The API validates the name and the body with these schemas; the Cloud
 * tab Secrets panel reads the list shape. No schema here carries a value.
 */
import { z } from "zod";
import { isoDateTimeSchema } from "../v1/shared/primitives";

// An env-style identifier, at most 64 characters. The same pattern is the
// check constraint `project_secrets_name_ck`.
const PROJECT_SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/** Runtime validator of the `:name` route parameter and of a listed name. */
export const projectSecretNameSchema = z
	.string()
	.regex(
		PROJECT_SECRET_NAME_PATTERN,
		"Use A-Z, 0-9, and _; start with a letter; at most 64 characters",
	);

/**
 * Who wrote the row. `user` rows come from the panel; `system` rows come
 * from server code (the Supabase keys) and a user can never replace or
 * delete one.
 */
export const projectSecretKinds = ["user", "system"] as const;

/** Runtime validator of a secret kind. */
export const projectSecretKindSchema = z.enum(projectSecretKinds);

/** TypeScript secret kind. */
export type ProjectSecretKind = z.infer<typeof projectSecretKindSchema>;

/** Largest accepted value, in bytes of UTF-8: 8 KB. */
export const PROJECT_SECRET_VALUE_MAX_BYTES = 8 * 1024;

/** Body of `PUT /api/v2/projects/:id/secrets/:name`. */
export const setProjectSecretRequestSchema = z.object({
	// The byte length, not the character count: a 4-byte character counts 4.
	value: z
		.string()
		.min(1)
		.refine(
			(value) =>
				new TextEncoder().encode(value).length <=
				PROJECT_SECRET_VALUE_MAX_BYTES,
			`The value is larger than ${PROJECT_SECRET_VALUE_MAX_BYTES} bytes`,
		),
});

/** TypeScript set-secret body. */
export type SetProjectSecretRequest = z.infer<
	typeof setProjectSecretRequestSchema
>;

/** One row of the list: the name, the kind, and the dates. Never a value. */
export const projectSecretSummarySchema = z.object({
	name: projectSecretNameSchema,
	kind: projectSecretKindSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

/** TypeScript secret summary. */
export type ProjectSecretSummary = z.infer<typeof projectSecretSummarySchema>;

/** Answer of `GET /api/v2/projects/:id/secrets`, sorted by name. */
export const listProjectSecretsResponseSchema = z.object({
	secrets: z.array(projectSecretSummarySchema),
});

/** TypeScript list-secrets response. */
export type ListProjectSecretsResponse = z.infer<
	typeof listProjectSecretsResponseSchema
>;
