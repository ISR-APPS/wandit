/**
 * The `present_plan` host tool of a Plan Mode turn. `BuilderHostToolRegistry`
 * builds it only for a `plan` turn. It has no execute: the harness pauses the
 * turn, and the chat shows the plan card. "Build this plan" starts a build
 * turn; a typed message continues the call with the change requests.
 */
import {
	type PresentPlanHostToolInput,
	presentPlanHostToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

/** The tool name the harness adapter and the registry share. */
export const PRESENT_PLAN_TOOL_NAME = "present_plan";

/**
 * Builds the AI SDK tool the harness sees. The description holds the card
 * limits, because the MCP schema carries no length limits; the harness
 * adapter cuts the values. The output type is `never`: no execute runs.
 */
export function createPresentPlanTool(): Tool<PresentPlanHostToolInput, never> {
	return tool({
		description:
			"Show your plan to the user for approval. Plan Mode only. Call it " +
			"when the interview gives you a clear picture, as the last call of " +
			"the reply. Write for a non-technical user, in the user's language, " +
			"with no technical words. " +
			"`title`: a short name of the app or of the change. " +
			"`summary`: 2 or 3 sentences: what it does, for whom, and the main gain. " +
			"`sections`: 4 to 8 sections, each with a `title` and 2 to 8 short " +
			"`items`. Use these sections when they fit: Who uses it; What they " +
			"can do (the main jobs, step by step); Screens; Information it keeps; " +
			"Rules and alerts; Reports; Not in the first version. " +
			"`assumptions`: each choice that you made for the user, one line each. " +
			"Limits: title 120 chars, summary 800 chars, 10 sections, section " +
			"title 80 chars, 12 items per section, item 300 chars, 10 assumptions. " +
			'The user then presses "Build this plan", which starts the build in ' +
			"a new message, or writes changes. The result is { feedback }: the " +
			"changes. Update the plan, then call present_plan again with the " +
			"full plan.",
		inputSchema: presentPlanHostToolInputSchema,
	});
}
