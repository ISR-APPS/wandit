import type { AiChatTools } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { ToolLoopAgent, type UIMessage } from "ai";

import type { PageEditsService } from "../../pages/application/services/page-edits.service";
import { WANDIT_SYSTEM_PROMPT } from "./system-prompt";
import { askUserTool } from "./tools/ask-user.tool";
import {
	createGeneratePageTool,
	type GeneratePageTool,
	type GeneratePageToolDeps,
	generatePageToolSchemaOnly,
} from "./tools/generate-page.tool";
import {
	getDirectionCandidatesTool,
	getDirectionCandidatesToolSchemaOnly,
} from "./tools/get-direction-candidates.tool";
import {
	createPageEditTools,
	type PageEditTools,
	pageEditToolsSchemaOnly,
} from "./tools/page-edit.tools";
import { readSkillToolSchemaOnly } from "./tools/read-skill.tool";

type AiChatToolSet = {
	ask_user: typeof askUserTool;
	get_direction_candidates: typeof getDirectionCandidatesTool;
	generate_page: GeneratePageTool;
	get_page_outline: PageEditTools["get_page_outline"];
	read_section: PageEditTools["read_section"];
	replace_section: PageEditTools["replace_section"];
};

export type WanditUIMessage = UIMessage<never, never, AiChatTools>;

// Everything the per-request tools need: generate_page's queue deps plus the
// edit tools' mutation service.
export type ChatAgentDeps = GeneratePageToolDeps & {
	pageEditsService: PageEditsService;
};

/**
 * The agent is built PER REQUEST now (it used to be a module singleton):
 * generate_page and the page-edit tools must know which project/chat they act
 * for, and those ids only exist once the controller has loaded the owned
 * chat. contextBlock is the pre-built per-request text from
 * request-context.ts (mode metadata, preview selection, manual-edit notes),
 * appended to the static system prompt when present.
 */
export function createChatAgent(
	deps: ChatAgentDeps,
	contextBlock?: string | null,
): ToolLoopAgent<never, AiChatToolSet> {
	const { pageEditsService, ...generatePageDeps } = deps;

	return new ToolLoopAgent({
		instructions: contextBlock
			? `${WANDIT_SYSTEM_PROMPT}\n\n${contextBlock}`
			: WANDIT_SYSTEM_PROMPT,
		model: env.AI_CHAT_MODEL,
		providerOptions: {
			// Anthropic's fine-grained tool streaming can emit unvalidated JSON.
			anthropic: { toolStreaming: false },
			// Gemini 3 thinking level — only Google models read this key;
			// every other provider ignores it.
			google: { thinkingConfig: { thinkingLevel: "high" } },
		},
		tools: {
			ask_user: askUserTool,
			generate_page: createGeneratePageTool(generatePageDeps),
			get_direction_candidates: getDirectionCandidatesTool,
			...createPageEditTools({
				pageEditsService,
				pagesRepository: deps.pagesRepository,
				projectId: deps.projectId,
			}),
		},
	});
}

/**
 * Static, execute-less tool map used ONLY by validateUIMessages in the
 * controller. Validation needs the input/output schemas, never execute —
 * using schema-only twins means history validation can never run a tool
 * (re-read a skill, queue a build, write a version) by accident.
 */
export const aiChatToolsForValidation = {
	ask_user: askUserTool,
	generate_page: generatePageToolSchemaOnly,
	get_direction_candidates: getDirectionCandidatesToolSchemaOnly,
	...pageEditToolsSchemaOnly,
	// read_skill was retired from the live agent; the schema stays so chats
	// that used it still validate.
	read_skill: readSkillToolSchemaOnly,
};
