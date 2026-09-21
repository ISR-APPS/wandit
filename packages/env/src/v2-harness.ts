/**
 * Coding-agent harness selection for the V2 app builder.
 * The `V2_HARNESS` env var parses through `v2HarnessSchema`; the app-builder
 * module and the builder-turn task read the result from `env.V2_HARNESS`.
 */
import { z } from "zod";

/**
 * Which coding-agent harness the V2 builder runs. D17: Claude Code first,
 * OpenCode later — the value must change without a code change.
 */
export const v2HarnessSchema = z
	.enum(["claude-code", "opencode"])
	.default("claude-code");

/** Selected harness id, parsed from `V2_HARNESS`. */
export type V2Harness = z.infer<typeof v2HarnessSchema>;
