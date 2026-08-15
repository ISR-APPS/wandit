import type {
	AiChatDataParts,
	AiChatMessageMetadata,
	AiChatTools,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import {
	generateObject,
	isStepCount,
	jsonSchema,
	type LanguageModel,
	NoSuchToolError,
	type Tool,
	type ToolCallRepairFunction,
	ToolLoopAgent,
	type UIMessage,
} from "ai";
import {
	createLlmModel,
	withLlmAttribution,
} from "../../ai-provider/domain/llm-provider";
import type { McpToolApprovalMap } from "../../mcp-connectors/domain/mcp-tool-policy";
import type { PageEditsService } from "../../pages/application/services/page-edits.service";
import { AI_CHAT_MAX_OUTPUT_TOKENS, AI_CHAT_MAX_STEPS } from "./chat-metering";
import { chatGatewayFetch } from "./gateway-fetch";
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
import {
	createGenerateVideoTool,
	type GenerateVideoTool,
	type GenerateVideoToolDeps,
	generateVideoToolSchemaOnly,
} from "./tools/generate-video.tool";
// Worlds serve BOTH build kinds since the landing-batch merge: COD samples a
// fusion menu (base + donors, law), websites sample a departure-point menu
// (one world as inspiration; the brain writes its own divergences). The
// schema-only twin keeps historical tool calls valid.
import {
	getDirectionCandidatesTool,
	getDirectionCandidatesToolSchemaOnly,
} from "./tools/get-direction-candidates.tool";
import {
	createPageEditTools,
	type PageEditTools,
	pageEditToolsSchemaOnly,
} from "./tools/page-edit.tools";
import {
	createReadAttachmentTool,
	type ReadAttachmentTool,
	type ReadAttachmentToolDeps,
	readAttachmentToolSchemaOnly,
} from "./tools/read-attachment.tool";
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
	generate_video: GenerateVideoTool;
	get_direction_candidates: typeof getDirectionCandidatesTool;
	read_attachment: ReadAttachmentTool;
	scrape_leads: ScrapeLeadsTool;
	get_page_outline: PageEditTools["get_page_outline"];
	apply_element_ops: PageEditTools["apply_element_ops"];
	read_elements: PageEditTools["read_elements"];
	read_theme: PageEditTools["read_theme"];
	read_section: PageEditTools["read_section"];
	insert_section: PageEditTools["insert_section"];
	replace_section: PageEditTools["replace_section"];
};

type McpToolSet = Record<string, Tool>;

export function createChatToolCallRepair({
	model,
}: {
	model: LanguageModel;
}): ToolCallRepairFunction<Record<string, Tool>> {
	return async ({
		error,
		inputSchema,
		instructions,
		messages,
		system,
		toolCall,
	}) => {
		if (NoSuchToolError.isInstance(error)) {
			return null;
		}

		try {
			const schema = jsonSchema<Record<string, unknown>>(
				await inputSchema({ toolName: toolCall.toolName }),
			);
			const { object } = await generateObject({
				instructions: instructions ?? system,
				maxOutputTokens: AI_CHAT_MAX_OUTPUT_TOKENS,
				messages: [
					...messages,
					{
						role: "user",
						content: `Your previous ${toolCall.toolName} call was cut off before the JSON closed. Return the COMPLETE arguments as valid JSON that satisfies the tool schema.`,
					},
				],
				model,
				schema,
			});

			return { ...toolCall, input: JSON.stringify(object) };
		} catch {
			return null;
		}
	};
}

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
	Omit<GenerateImageToolDeps, "chatId" | "projectId"> &
	Omit<GenerateVideoToolDeps, "chatId" | "projectId"> &
	ReadAttachmentToolDeps;

/**
 * The agent is built PER REQUEST now (it used to be a module singleton):
 * generate_page and the page-edit tools must know which project/chat they act
 * for, and those ids only exist once the controller has loaded the owned
 * chat. contextBlock is the pre-built per-request text from
 * request-context.ts (mode metadata, active outline, preview selection, and
 * manual-edit notes), appended to the static system prompt when present.
 */
export function createChatAgent(
	deps: ChatAgentDeps,
	contextBlock?: string | null,
	mcpTools: McpToolSet = {},
	approvalMap: McpToolApprovalMap = {},
): ToolLoopAgent<never, AiChatToolSet & McpToolSet> {
	const meteringContext = {
		operation: "chat" as const,
		organizationId: deps.subject.organizationId ?? null,
		userId: deps.userId,
	};

	// The long-idle fetch travels with the model on either provider; on
	// OpenRouter the "high" effort maps to unified reasoning instead of the
	// openai providerOptions key below.
	const model = createLlmModel(env.AI_CHAT_MODEL, {
		context: meteringContext,
		fetch: chatGatewayFetch,
		reasoningEffort: "high",
		task: "chat",
	});

	return new ToolLoopAgent({
		experimental_repairToolCall: createChatToolCallRepair({ model }),
		instructions: contextBlock
			? `${WANDIT_SYSTEM_PROMPT}\n\n${contextBlock}`
			: WANDIT_SYSTEM_PROMPT,
		maxOutputTokens: AI_CHAT_MAX_OUTPUT_TOKENS,
		model,
		providerOptions: withLlmAttribution(
			{
				// Anthropic's fine-grained tool streaming can emit unvalidated JSON.
				anthropic: { toolStreaming: false },
				// Gemini thinking level — only Google models read this key; every
				// other provider ignores it. MEDIUM: the launch-window compromise
				// between snappy chat replies and brief quality (2026-07-26).
				google: { thinkingConfig: { thinkingLevel: "medium" } },
				// The brief IS the product: the brain must reason hard when it
				// composes one. Only OpenAI models read this key.
				openai: { reasoningEffort: "high" },
			},
			meteringContext,
			"chat",
		),
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
				subject: deps.subject,
				userId: deps.userId,
			}),
			ask_user: askUserTool,
			generate_image: createGenerateImageTool({
				availableImages: deps.availableImages,
				chatId: deps.chatId,
				imageGenerationsRepository: deps.imageGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				pagesRepository: deps.pagesRepository,
				projectId: deps.projectId,
				quality: deps.quality,
				requestKeySeed: deps.requestKeySeed,
				subject: deps.subject,
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
				subject: deps.subject,
				userId: deps.userId,
			}),
			generate_page: createGeneratePageTool({
				builderModel: deps.builderModel,
				chatId: deps.chatId,
				conversationAssets: deps.conversationAssets,
				conversationUserLinks: deps.conversationUserLinks,
				pagesRepository: deps.pagesRepository,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				subject: deps.subject,
				userId: deps.userId,
			}),
			generate_video: createGenerateVideoTool({
				chatId: deps.chatId,
				mediaGenerationsRepository: deps.mediaGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requestKeySeed: deps.requestKeySeed,
				subject: deps.subject,
				userId: deps.userId,
				videoDirector: deps.videoDirector,
			}),
			get_direction_candidates: getDirectionCandidatesTool,
			read_attachment: createReadAttachmentTool({
				availableDocuments: deps.availableDocuments,
			}),
			scrape_leads: createScrapeLeadsTool({
				chatId: deps.chatId,
				leadScrapesRepository: deps.leadScrapesRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requestCountryCode: deps.requestCountryCode,
				subject: deps.subject,
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
	generate_video: generateVideoToolSchemaOnly,
	scrape_leads: scrapeLeadsToolSchemaOnly,
	get_direction_candidates: getDirectionCandidatesToolSchemaOnly,
	read_attachment: readAttachmentToolSchemaOnly,
	...pageEditToolsSchemaOnly,
	// read_skill was retired from the live agent; the schema stays so chats
	// that used it still validate.
	read_skill: readSkillToolSchemaOnly,
};
