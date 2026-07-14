import {
	type ReadSkillInput,
	type ReadSkillOutput,
	readSkillInputSchema,
	readSkillOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

// read_skill is RETIRED: the director no longer loads skill playbooks (the
// builder carries its design guidance in its own system prompt now). Only
// this execute-less twin survives, so validateUIMessages still accepts the
// tool parts persisted by older chats.
export const readSkillToolSchemaOnly: Tool<ReadSkillInput, ReadSkillOutput> =
	tool({
		inputSchema: readSkillInputSchema,
		outputSchema: readSkillOutputSchema,
	});
