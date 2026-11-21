/**
 * The `suggest_follow_ups` host tool of a build turn. `BuilderHostToolRegistry`
 * builds it for a build turn only. The agent calls it once after its final
 * answer. The chat reads the streamed tool input and shows each idea as a
 * row the user can click. The execute only confirms and tells the agent to
 * stop; nothing is billed.
 */
import {
	type SuggestFollowUpsHostToolInput,
	suggestFollowUpsHostToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

/** The tool name that the registry and the web turn parts share. */
export const SUGGEST_FOLLOW_UPS_TOOL_NAME = "suggest_follow_ups";

/**
 * Builds the AI SDK tool the harness sees. The description holds the length
 * limits, because the MCP schema carries no length limits. The AI SDK parses
 * the input with the zod schema; a bad input goes back to the agent as an error.
 */
export function createSuggestFollowUpsTool(): Tool<
	SuggestFollowUpsHostToolInput,
	{ status: "ok"; message: string }
> {
	return tool({
		description:
			"Show the user 2 or 3 next ideas to try. Call it once at the end of " +
			"a build turn, after your final answer. Each idea is a feature, an " +
			"improvement, or a variant of what the user asked for. Write each " +
			"idea as one short prompt in the user's language, as the user would " +
			'type it, for example "Add a dark mode". Not about a web search, ' +
			"not a question to the user, not a repeat of done work. Each idea " +
			"has 3 to 120 characters. Free.",
		inputSchema: suggestFollowUpsHostToolInputSchema,
		// The agent reads this result in one more model step. The message keeps
		// that step short and stops text after the final answer.
		execute: async () => ({
			status: "ok",
			message: "Shown to the user. End the turn now. Write no more text.",
		}),
	});
}
