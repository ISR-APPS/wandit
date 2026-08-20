import {
	type ReadSkillInput,
	type ReadSkillOutput,
	readSkillInputSchema,
	readSkillOutputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import { LIVE_SKILL_SLUGS, loadSkill } from "../skills";

// read_skill is LIVE again for the ads playbooks (it was retired when the
// builder absorbed the design skill). The tool is pure and dependency-free:
// it returns the requested playbook's text as its result so the model reads
// it mid-loop. Old outputs are elided from the model-bound history by
// ai-chat.service.ts, so a loaded skill costs ~0 on later turns.
// Slugs only: the one-line descriptions travel in the per-request ads block
// (agent/ads/index.ts) so they are paid once, and only on ads requests.
const SKILL_LIST = LIVE_SKILL_SLUGS.join(", ");

export const readSkillTool: Tool<ReadSkillInput, ReadSkillOutput> = tool({
	description:
		"Load one of Wandit's ads playbooks (senior media-buying method) and " +
		"apply it. Call it BEFORE advising, planning, reviewing, or changing " +
		"anything about Meta Ads / TikTok Ads; ads-diagnostic first for any " +
		"underperformance question; at most two per turn. Skills: " +
		SKILL_LIST +
		".",
	inputSchema: readSkillInputSchema,
	outputSchema: readSkillOutputSchema,
	execute: async ({ skill }) => ({
		markdown: await loadSkill(skill),
		skill,
	}),
});

// Execute-less twin for validateUIMessages: history validation needs the
// schemas, never the execute — it must never load a skill by accident.
export const readSkillToolSchemaOnly: Tool<ReadSkillInput, ReadSkillOutput> =
	tool({
		inputSchema: readSkillInputSchema,
		outputSchema: readSkillOutputSchema,
	});
