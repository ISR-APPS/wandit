import type { AiChatTools } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { ToolLoopAgent, type UIMessage } from "ai";

import { WANDIT_SYSTEM_PROMPT } from "./system-prompt";
import { askUserTool } from "./tools/ask-user.tool";
import {
	createGeneratePageTool,
	type GeneratePageTool,
	type GeneratePageToolDeps,
	generatePageToolSchemaOnly,
} from "./tools/generate-page.tool";
import {
	readSkillTool,
	readSkillToolSchemaOnly,
} from "./tools/read-skill.tool";

type AiChatToolSet = {
	ask_user: typeof askUserTool;
	read_skill: typeof readSkillTool;
	generate_page: GeneratePageTool;
};

export type WanditUIMessage = UIMessage<never, never, AiChatTools>;

/**
 * The agent is built PER REQUEST now (it used to be a module singleton):
 * generate_page must know which project/chat it acts for, and those ids only
 * exist once the controller has loaded the owned chat. Everything else —
 * prompt, model, provider options — is unchanged.
 */
export function createChatAgent(
	deps: GeneratePageToolDeps,
): ToolLoopAgent<never, AiChatToolSet> {
	return new ToolLoopAgent({
		instructions: WANDIT_SYSTEM_PROMPT,
		model: env.AI_CHAT_MODEL,
		providerOptions: {
			// Anthropic's fine-grained tool streaming can emit unvalidated JSON.
			anthropic: { toolStreaming: false },
		},
		tools: {
			ask_user: askUserTool,
			generate_page: createGeneratePageTool(deps),
			read_skill: readSkillTool,
		},
	});
}

/**
 * Static, execute-less tool map used ONLY by validateUIMessages in the
 * controller. Validation needs the input/output schemas, never execute —
 * using schema-only twins means history validation can never run a tool
 * (re-read a skill, queue a build) by accident.
 */
export const aiChatToolsForValidation = {
	ask_user: askUserTool,
	generate_page: generatePageToolSchemaOnly,
	read_skill: readSkillToolSchemaOnly,
};
