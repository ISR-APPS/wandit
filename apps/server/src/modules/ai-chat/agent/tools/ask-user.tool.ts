import {
	type AskUserInput,
	type AskUserOutput,
	askUserInputSchema,
	askUserOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

// No execute: the UI renders the question and returns the human's selection.
export const askUserTool: Tool<AskUserInput, AskUserOutput> = tool({
	description: "Ask the user one focused question with concrete options.",
	inputSchema: askUserInputSchema,
	outputSchema: askUserOutputSchema,
});
