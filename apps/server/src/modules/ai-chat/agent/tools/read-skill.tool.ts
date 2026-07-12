import {
	type ReadSkillInput,
	type ReadSkillOutput,
	readSkillInputSchema,
	readSkillOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { SKILLS } from "../skills";

// Unlike ask_user (client-side, no execute), this tool runs on the server:
// the model calls it mid-loop and gets the skill markdown back as the result.
export const readSkillTool: Tool<ReadSkillInput, ReadSkillOutput> = tool({
	description:
		"Load a skill playbook (markdown) into context. Call this BEFORE giving design direction, page structure, or visual advice — never design from memory.",
	inputSchema: readSkillInputSchema,
	outputSchema: readSkillOutputSchema,
	execute: async ({ skill }) => {
		const entry = SKILLS[skill];

		// The input schema's enum should make this unreachable; guard anyway so
		// a registry/contracts mismatch fails loudly instead of returning junk.
		if (!entry) {
			throw new Error(
				`Unknown skill "${skill}". Available: ${Object.keys(SKILLS).join(", ")}`,
			);
		}

		return { markdown: await entry.load(), skill };
	},
});

// Execute-less twin used ONLY for validateUIMessages in the controller —
// validating old messages must never re-read skill files from disk.
export const readSkillToolSchemaOnly: Tool<ReadSkillInput, ReadSkillOutput> =
	tool({
		inputSchema: readSkillInputSchema,
		outputSchema: readSkillOutputSchema,
	});
