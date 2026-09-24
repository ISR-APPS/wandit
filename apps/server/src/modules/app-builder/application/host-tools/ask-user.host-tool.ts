/**
 * The `ask_user` host tool of the builder turn. `BuilderHostToolRegistry`
 * builds it once per turn. It has no execute: the harness pauses the turn,
 * the chat shows the questions above the prompt box, and the next turn
 * sends the answers back as the tool result (builder-turn.runtime.ts).
 */
import {
	type AskUserHostToolInput,
	askUserHostToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

/** The tool name the harness adapter and the registry share. */
export const ASK_USER_TOOL_NAME = "ask_user";

/**
 * Builds the AI SDK tool the harness sees. The description holds the card
 * limits, because the MCP schema carries no length limits. The output type
 * is `never`: no execute runs; the runtime builds the result
 * (`askUserHostToolOutputSchema`) on the answer turn.
 */
export function createAskUserTool(): Tool<AskUserHostToolInput, never> {
	return tool({
		description:
			"Ask the user a question in the chat. Ask only when you are blocked: " +
			"a missing fact, a business choice, or an image only the user has. " +
			"Put EVERY question of one step in ONE call (max 4 questions). " +
			"Never call ask_user twice in one reply. Limits: question 300 chars, " +
			"max 6 options, label 120 chars, helper and description 200 chars. " +
			'Kinds: "single-choice", "multi-select", "free-text" (no options), ' +
			'"attachments" (images, logos, photos; set maxFiles, 1 to 6). The user ' +
			"can always type an answer. For a design world choice, use " +
			'"single-choice" with 2 to 4 options, each with `worldId` = a world ' +
			"skill id from .claude/skills/design-worlds-website (or -product, " +
			"-cod); the user then sees the world card. The result is { answers: " +
			"[{ questionId, question, action, selected, text, files }] }. " +
			'"answered": use selected, text, and files. "delegated": decide ' +
			'yourself. "dismissed": the user skipped; follow `text` when present. ' +
			"files[].path is the copy inside the project (public/uploads/<name>); " +
			"read it to see the image. In the app, use the URL /uploads/<name>, " +
			"because Vite serves public/ at the site root.",
		inputSchema: askUserHostToolInputSchema,
	});
}
