import {
	type AskUserInput,
	type AskUserOutput,
	askUserInputSchema,
	askUserOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

// No execute: the UI renders the question and returns the human's selection.
export const askUserTool: Tool<AskUserInput, AskUserOutput> = tool({
	description:
		"Ask the user ONE focused question, answered in the chat's request tray. " +
		"Never pack several questions into one question string. To ask several " +
		"independent questions, call this tool once PER question in the same " +
		"reply — the UI steps the user through them one at a time and returns " +
		"all answers together.",
	inputSchema: askUserInputSchema,
	outputSchema: askUserOutputSchema,
});
