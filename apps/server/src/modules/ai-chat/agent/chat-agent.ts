import { Logger } from "@nestjs/common";
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
import { llmGenerationCaptureFromError } from "../../metering/domain/gateway-metering";
import {
	type CapturedGeneration,
	helperStepUsage,
} from "../../metering/domain/metering";
import type { PageEditsService } from "../../pages/application/services/page-edits.service";
import { AI_CHAT_MAX_OUTPUT_TOKENS, AI_CHAT_MAX_STEPS } from "./chat-metering";
import { chatGatewayFetch } from "./gateway-fetch";
import {
	INSPECT_VIDEO_BRAIN_GUIDANCE,
	WANDIT_SYSTEM_PROMPT,
} from "./system-prompt";
import {
	type AnimateImageTool,
	type AnimateImageToolDeps,
	animateImageToolSchemaOnly,
	createAnimateImageTool,
} from "./tools/animate-image.tool";
import { askUserTool } from "./tools/ask-user.tool";
import {
	createEditVideoTool,
	type EditVideoTool,
	type EditVideoToolDeps,
	editVideoToolSchemaOnly,
} from "./tools/edit-video.tool";
import {
	createExtendVideoTool,
	type ExtendVideoTool,
	type ExtendVideoToolDeps,
	extendVideoToolSchemaOnly,
} from "./tools/extend-video.tool";
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
	createInspectVideoTool,
	type InspectVideoTool,
	type InspectVideoToolDeps,
	inspectVideoToolSchemaOnly,
} from "./tools/inspect-video.tool";
import {
	createPageEditTools,
	type PageEditTools,
	pageEditToolsSchemaOnly,
} from "./tools/page-edit.tools";
import {
	createProductVideoTool,
	type ProductVideoTool,
	type ProductVideoToolDeps,
	productVideoToolSchemaOnly,
} from "./tools/product-video.tool";
import {
	createReadAttachmentTool,
	type ReadAttachmentTool,
	type ReadAttachmentToolDeps,
	readAttachmentToolSchemaOnly,
} from "./tools/read-attachment.tool";
import {
	createReadLeadPerformanceTool,
	type ReadLeadPerformanceTool,
	type ReadLeadPerformanceToolDeps,
	readLeadPerformanceToolSchemaOnly,
} from "./tools/read-lead-performance.tool";
import {
	readSkillTool,
	readSkillToolSchemaOnly,
} from "./tools/read-skill.tool";
import {
	createScrapeLeadsTool,
	type ScrapeLeadsTool,
	type ScrapeLeadsToolDeps,
	scrapeLeadsToolSchemaOnly,
} from "./tools/scrape-leads.tool";

type AiChatToolSet = {
	animate_image: AnimateImageTool;
	ask_user: typeof askUserTool;
	edit_video: EditVideoTool;
	extend_video: ExtendVideoTool;
	generate_image: GenerateImageTool;
	generate_marketing_asset: GenerateMarketingAssetTool;
	generate_page: GeneratePageTool;
	generate_video: GenerateVideoTool;
	get_direction_candidates: typeof getDirectionCandidatesTool;
	inspect_video?: InspectVideoTool;
	product_video: ProductVideoTool;
	read_attachment: ReadAttachmentTool;
	read_lead_performance: ReadLeadPerformanceTool;
	read_skill: typeof readSkillTool;
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

const REPAIR_CAPTURE_ATTEMPTS = 3;
const repairLogger = new Logger("chat-tool-call-repair");

export type ChatToolCallRepairCapture = (
	capture: CapturedGeneration,
) => Promise<void>;

export function createChatToolCallRepair({
	captureGeneration,
	model,
}: {
	/** Bills the repair call inside the parent chat event; absent when billing is off. */
	captureGeneration?: ChatToolCallRepairCapture;
	model: LanguageModel;
}): ToolCallRepairFunction<Record<string, Tool>> {
	// A capture failure must never break the repair (the user-facing result);
	// the metering sweep and the gateway remain the cost backstop.
	const captureSafely = async (capture: CapturedGeneration) => {
		if (!captureGeneration) {
			return;
		}

		try {
			await captureGeneration(capture);
		} catch (captureError) {
			repairLogger.warn(
				`Chat tool-call repair usage capture failed: ${
					captureError instanceof Error
						? captureError.message
						: String(captureError)
				}`,
			);
		}
	};

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
			const result = await generateObject({
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

			await captureSafely({
				providerMetadata: result.providerMetadata,
				stepUsage: helperStepUsage("tool_call_repair", result.usage),
			});

			return { ...toolCall, input: JSON.stringify(result.object) };
		} catch (repairError) {
			const errorCapture = llmGenerationCaptureFromError(repairError);

			if (errorCapture) {
				await captureSafely({
					providerMetadata: errorCapture.providerMetadata,
					stepUsage: helperStepUsage("tool_call_repair", null),
				});
			}

			return null;
		}
	};
}

/**
 * Capture bound to the parent chat event with the same bounded retry as the
 * stream's own captures. Undefined when the request holds no event (billing
 * off), so the repair runs unmetered exactly like the chat turn itself.
 */
function chatToolCallRepairCapture(
	deps: Pick<ChatAgentDeps, "meteringService" | "parentEventId">,
): ChatToolCallRepairCapture | undefined {
	const eventId = deps.parentEventId;

	if (!eventId) {
		return undefined;
	}

	return async (capture) => {
		let lastError: unknown;

		for (let attempt = 1; attempt <= REPAIR_CAPTURE_ATTEMPTS; attempt += 1) {
			try {
				const generationRef = await deps.meteringService.captureGeneration(
					eventId,
					capture,
				);

				if (!generationRef) {
					throw new Error("AI Gateway generation id is missing");
				}

				return;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError;
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
		hasHiggsfieldConnector?: boolean;
		pageEditsService: PageEditsService;
	} & Omit<AnimateImageToolDeps, "chatId" | "projectId"> &
	Omit<EditVideoToolDeps, "chatId" | "projectId"> &
	Omit<ExtendVideoToolDeps, "chatId" | "projectId"> &
	Omit<GenerateMarketingAssetToolDeps, "chatId" | "projectId"> &
	Omit<GenerateImageToolDeps, "chatId" | "projectId"> &
	Omit<GenerateVideoToolDeps, "chatId" | "projectId"> &
	Omit<InspectVideoToolDeps, "organizationId"> &
	Omit<ProductVideoToolDeps, "chatId" | "projectId"> &
	ReadAttachmentToolDeps &
	Omit<ReadLeadPerformanceToolDeps, "now" | "projectId">;

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
	const inspectVideoAvailable = deps.hasHiggsfieldConnector !== true;
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

	const systemPrompt = inspectVideoAvailable
		? `${WANDIT_SYSTEM_PROMPT}\n\n${INSPECT_VIDEO_BRAIN_GUIDANCE}`
		: WANDIT_SYSTEM_PROMPT;

	return new ToolLoopAgent({
		experimental_repairToolCall: createChatToolCallRepair({
			captureGeneration: chatToolCallRepairCapture(deps),
			model,
		}),
		instructions: contextBlock
			? `${systemPrompt}\n\n${contextBlock}`
			: systemPrompt,
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
			edit_video: createEditVideoTool({
				chatId: deps.chatId,
				mediaGenerationsRepository: deps.mediaGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requestKeySeed: deps.requestKeySeed,
				subject: deps.subject,
				userId: deps.userId,
			}),
			extend_video: createExtendVideoTool({
				chatId: deps.chatId,
				mediaGenerationsRepository: deps.mediaGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requestKeySeed: deps.requestKeySeed,
				subject: deps.subject,
				userId: deps.userId,
			}),
			generate_image: createGenerateImageTool({
				availableImages: deps.availableImages,
				chatId: deps.chatId,
				imageGenerationsRepository: deps.imageGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				pagesRepository: deps.pagesRepository,
				projectId: deps.projectId,
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
			...(inspectVideoAvailable
				? {
						inspect_video: createInspectVideoTool({
							availableVideos: deps.availableVideos,
							meteringService: deps.meteringService,
							organizationId: deps.subject.organizationId ?? null,
							parentEventId: deps.parentEventId,
							userId: deps.userId,
						}),
					}
				: {}),
			product_video: createProductVideoTool({
				availableImages: deps.availableImages,
				chatId: deps.chatId,
				imageGenerationsRepository: deps.imageGenerationsRepository,
				mediaGenerationsRepository: deps.mediaGenerationsRepository,
				meteringService: deps.meteringService,
				parentEventId: deps.parentEventId,
				projectId: deps.projectId,
				requestKeySeed: deps.requestKeySeed,
				subject: deps.subject,
				userId: deps.userId,
			}),
			read_attachment: createReadAttachmentTool({
				availableDocuments: deps.availableDocuments,
			}),
			read_lead_performance: createReadLeadPerformanceTool({
				leadsRepository: deps.leadsRepository,
				projectId: deps.projectId,
			}),
			// Live again for the ads playbooks (agent/ads); pure, no deps.
			read_skill: readSkillTool,
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
	edit_video: editVideoToolSchemaOnly,
	extend_video: extendVideoToolSchemaOnly,
	generate_image: generateImageToolSchemaOnly,
	generate_marketing_asset: generateMarketingAssetToolSchemaOnly,
	generate_page: generatePageToolSchemaOnly,
	generate_video: generateVideoToolSchemaOnly,
	get_direction_candidates: getDirectionCandidatesToolSchemaOnly,
	inspect_video: inspectVideoToolSchemaOnly,
	product_video: productVideoToolSchemaOnly,
	scrape_leads: scrapeLeadsToolSchemaOnly,
	read_attachment: readAttachmentToolSchemaOnly,
	read_lead_performance: readLeadPerformanceToolSchemaOnly,
	...pageEditToolsSchemaOnly,
	read_skill: readSkillToolSchemaOnly,
};
