import type {
	AiChatDataParts,
	AiChatMessageMetadata,
	AiChatTools,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { isStepCount, type Tool, ToolLoopAgent, type UIMessage } from "ai";

import type { McpToolApprovalMap } from "../../mcp-connectors/domain/mcp-tool-policy";
import type { PageEditsService } from "../../pages/application/services/page-edits.service";
import { AI_CHAT_MAX_OUTPUT_TOKENS, AI_CHAT_MAX_STEPS } from "./chat-metering";
import { WANDIT_SYSTEM_PROMPT } from "./system-prompt";
import {
	type AnimateImageTool,
	type AnimateImageToolDeps,
	animateImageToolSchemaOnly,
	createAnimateImageTool,
} from "./tools/animate-image.tool";
import { askUserTool } from "./tools/ask-user.tool";
import {
	createGenerateImageTool,
	type GenerateImageTool,
	type GenerateImageToolDeps,
	generateImageToolSchemaOnly,
} from "./tools/generate-image.tool";
import {
	createGenerateMarketingAssetTool,
	type GenerateMarketingAssetTool,
	type GenerateMarketingAssetToolDeps,
	generateMarketingAssetToolSchemaOnly,
} from "./tools/generate-marketing-asset.tool";
import {
	createGeneratePageTool,
	type GeneratePageTool,
	type GeneratePageToolDeps,
	generatePageToolSchemaOnly,
} from "./tools/generate-page.tool";
// EXPERIMENT (2026-07-27): worlds OFF again — the live tool is unplugged and
// the brain invents the whole art direction itself. The schema-only twin
// stays so chats that used the tool still validate.
import { getDirectionCandidatesToolSchemaOnly } from "./tools/get-direction-candidates.tool";
import {
	createPageEditTools,
	type PageEditTools,
	pageEditToolsSchemaOnly,
} from "./tools/page-edit.tools";
import { readSkillToolSchemaOnly } from "./tools/read-skill.tool";
import {
	createScrapeLeadsTool,
	type ScrapeLeadsTool,
	type ScrapeLeadsToolDeps,
	scrapeLeadsToolSchemaOnly,
} from "./tools/scrape-leads.tool";

type AiChatToolSet = {
	animate_image: AnimateImageTool;
	ask_user: typeof askUserTool;
	generate_image: GenerateImageTool;
	generate_marketing_asset: GenerateMarketingAssetTool;
	generate_page: GeneratePageTool;
	scrape_leads: ScrapeLeadsTool;
	get_page_outline: PageEditTools["get_page_outline"];
	apply_element_ops: PageEditTools["apply_element_ops"];
	read_elements: PageEditTools["read_elements"];
	read_theme: PageEditTools["read_theme"];
	read_section: PageEditTools["read_section"];
	replace_section: PageEditTools["replace_section"];
};

type McpToolSet = Record<string, Tool>;

export type WanditUIMessage = UIMessage<
	AiChatMessageMetadata,
	AiChatDataParts,
	AiChatTools
>;

// Everything the per-request tools need: generate_page's queue deps, the
// scrape_leads queue deps, plus the edit tools' mutation service.
export type ChatAgentDeps = GeneratePageToolDeps &
	Omit<ScrapeLeadsToolDeps, "chatId" | "projectId"> & {
		pageEditsService: PageEditsService;
	} & Omit<AnimateImageToolDeps, "chatId" | "projectId"> &
	Omit<GenerateMarketingAssetToolDeps, "chatId" | "projectId"> &
	Omit<GenerateImageToolDeps, "chatId" | "projectId">;

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
	mcpTools: McpToolSet = {},
	approvalMap: McpToolApprovalMap = {},
): ToolLoopAgent<never, AiChatToolSet & McpToolSet> {
	return new ToolLoopAgent({
		instructions: contextBlock
			? `${WANDIT_SYSTEM_PROMPT}\n\n${contextBlock}`
			: WANDIT_SYSTEM_PROMPT,
		model: env.AI_CHAT_MODEL,
		maxOutputTokens: AI_CHAT_MAX_OUTPUT_TOKENS,
		providerOptions: {
			// Anthropic's fine-grained tool streaming can emit unvalidated JSON.
			anthropic: { toolStreaming: false },
			// Gemini thinking level — only Google models read this key; every
			// other provider ignores it. MEDIUM: the launch-window compromise
			// between snappy chat replies and brief quality (2026-07-26).
			google: { thinkingConfig: { thinkingLevel: "medium" } },
			gateway: {
				quotaEntityId: deps.userId,
				tags: ["op:chat"],
				user: deps.userId,
			},
			// The brief IS the product: the brain must reason hard when it
			// composes one. Only OpenAI models read this key.
			openai: { reasoningEffort: "high" },
		},
		stopWhen: isStepCount(AI_CHAT_MAX_STEPS),
		// ToolLoopAgentSettings does not expose experimental_toolApprovalSecret.
		toolApproval: approvalMap,
		tools: {
			animate_image: createAnimateImageTool({
				availableImages: deps.availableImages,
				chatId: deps.chatId,
				mediaGenerationsRepository: deps.mediaGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requireSelectedSource: deps.requireSelectedSource,
				requestKeySeed: deps.requestKeySeed,
				selectedSourceImage: deps.selectedSourceImage,
				userId: deps.userId,
			}),
			ask_user: askUserTool,
			generate_image: createGenerateImageTool({
				availableImages: deps.availableImages,
				chatId: deps.chatId,
				imageGenerationsRepository: deps.imageGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				quality: deps.quality,
				requestKeySeed: deps.requestKeySeed,
				userId: deps.userId,
			}),
			generate_marketing_asset: createGenerateMarketingAssetTool({
				chatId: deps.chatId,
				marketingAssetsRepository: deps.marketingAssetsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				quality: deps.quality,
				requestKeySeed: deps.requestKeySeed,
				userId: deps.userId,
			}),
			generate_page: createGeneratePageTool({
				builderModel: deps.builderModel,
				chatId: deps.chatId,
				pagesRepository: deps.pagesRepository,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				userId: deps.userId,
			}),
			scrape_leads: createScrapeLeadsTool({
				chatId: deps.chatId,
				leadScrapesRepository: deps.leadScrapesRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requestCountryCode: deps.requestCountryCode,
				userId: deps.userId,
			}),
			...createPageEditTools({
				pageEditsService: deps.pageEditsService,
				pagesRepository: deps.pagesRepository,
				projectId: deps.projectId,
			}),
			...mcpTools,
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
	animate_image: animateImageToolSchemaOnly,
	ask_user: askUserTool,
	generate_image: generateImageToolSchemaOnly,
	generate_marketing_asset: generateMarketingAssetToolSchemaOnly,
	generate_page: generatePageToolSchemaOnly,
	scrape_leads: scrapeLeadsToolSchemaOnly,
	get_direction_candidates: getDirectionCandidatesToolSchemaOnly,
	...pageEditToolsSchemaOnly,
	// read_skill was retired from the live agent; the schema stays so chats
	// that used it still validate.
	read_skill: readSkillToolSchemaOnly,
};
