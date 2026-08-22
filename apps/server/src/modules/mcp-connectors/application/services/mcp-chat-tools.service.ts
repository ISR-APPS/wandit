import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
	createMCPClient,
	type ListToolsResult,
	type MCPClient,
} from "@ai-sdk/mcp";
import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	CONNECTOR_GENERATION_OUTPUT_KIND,
	type TriggerRealtimeHandle,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/nestjs";
import { dynamicTool, type Tool, type ToolExecutionOptions } from "ai";
import { z } from "zod";
// Type-only import: pulling the task VALUE here would drag the Trigger task
// (and its DB pool) into the Nest process.
import type { runConnectorGenerationTask } from "../../../../trigger/run-connector-generation.task";
import { extractMediaUrls } from "../../../connector-generations/domain/extract-media-urls";
import { ConnectorGenerationsRepository } from "../../../connector-generations/infrastructure/persistence/connector-generations.repository";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	fixedGenerationStepUsage,
	gatewayGenerationCaptureFromError,
} from "../../../metering/domain/gateway-metering";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { assertUsdAdBudgetArgs } from "../../domain/ad-budget-guard";
import {
	classifyAdsToolApproval,
	isAdsApprovalConnector,
} from "../../domain/ads-approval-policy";
import { evaluateAdsChangeWindow } from "../../domain/ads-change-window-guard";
import {
	adsPlatformError,
	extractAdsCreatedEntityIds,
	extractAdsTargetEntityIds,
	isAdsCreateToolName,
	resultPayloads,
} from "../../domain/ads-target-entity";
import {
	connectorGatewayCaptures,
	connectorGenerationPlan,
	connectorGenerationReference,
	IMAGE_GENERATION_TOOLS,
	normalizeConnectorToolName,
	VIDEO_GENERATION_TOOLS,
} from "../../domain/connector-generation-metering";
import { sanitizeConnectorOperationError } from "../../domain/connector-operation-error";
import { classifyToolName } from "../../domain/mcp-tool-classification";
import {
	type McpToolApprovalMap,
	mcpToolPolicySchema,
} from "../../domain/mcp-tool-policy";
import { ConnectorOperationEventsRepository } from "../../infrastructure/persistence/connector-operation-events.repository";
import type { McpConnectionRow } from "../../infrastructure/persistence/mcp-connections.repository";
import { McpConnectionsRepository } from "../../infrastructure/persistence/mcp-connections.repository";
import type { McpConnectorRow } from "../../infrastructure/persistence/mcp-connectors.repository";
import { McpConnectorsRepository } from "../../infrastructure/persistence/mcp-connectors.repository";
import {
	type ConnectorGenerationBilling,
	type ConnectorGenerationReservations,
	captureConnectorGenerationResult,
	connectorBillingAdmissionMode,
	createConnectorGenerationBilling,
	finalizeConnectorGenerationBilling,
	recordConnectorSubmitReceipt,
} from "./connector-generation-billing";
import {
	HiggsfieldPromptRefinerService,
	locateGenerationPrompt,
} from "./higgsfield-prompt-refiner.service";
import { McpConnectionsService } from "./mcp-connections.service";
import {
	type McpCatalogTool,
	McpRuntimeCacheService,
	type McpRuntimeSession,
	type TikTokHiddenOperation,
} from "./mcp-runtime-cache.service";

const MCP_CONNECT_TIMEOUT_MS = 10_000;
const READ_RETRY_DELAYS_MS = [250, 1_000] as const;
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";
const VALID_TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PLATFORM_TOOL_RESULT_LIMIT = 12;
const PLATFORM_TOOL_SUMMARY_LENGTH = 160;
const TIKTOK_GATEWAY_TOOLS = new Set(["tool_execute", "tool_get", "tool_list"]);
const ADS_CHANGE_WINDOW_ACK_TTL_MS = 30 * 60 * 1000;
const GENERIC_WRAPPER_TOOLS = new Set(["tool_execute"]);
// Reachable only through the run_platform_tool door (never in the visible
// set): they render for minutes inline with no billing plan and no card.
const HIGGSFIELD_BATCH_TOOLS = new Set([
	"generate_audio_batch",
	"generate_image_batch",
	"generate_video_batch",
]);

// Connector tools whose provider call is a SUBMIT-style generation (a job
// receipt in ~1s, the render minutes later) or simply runs for minutes:
// executing them inline would block the chat stream, die on the API
// process's 5-minute undici ceiling, and — for submit-style tools — hand the
// model a receipt with demo garnish instead of the render. They are
// intercepted and replayed by the run-connector-generation Trigger.dev task,
// which follows the provider job to its real media; the chat card follows
// the run over Realtime. The set is exactly the metering registry's image +
// video generations, so every billed generation gets a live card. Names are
// normalized (normalizeToolName).
const BACKGROUND_GENERATION_TOOLS: Record<string, ReadonlySet<string>> = {
	higgsfield: new Set([...IMAGE_GENERATION_TOOLS, ...VIDEO_GENERATION_TOOLS]),
};

function isBackgroundGenerationTool(slug: string, toolName: string): boolean {
	return (
		BACKGROUND_GENERATION_TOOLS[slug]?.has(normalizeToolName(toolName)) ?? false
	);
}

// Creative generations whose prompt is rewritten by the refiner model before
// the provider call. Names are normalized (normalizeToolName).
const PROMPT_REFINED_TOOLS: Record<string, ReadonlySet<string>> = {
	higgsfield: new Set(["generate_image", "generate_video"]),
};

function isPromptRefinedTool(slug: string, toolName: string): boolean {
	return PROMPT_REFINED_TOOLS[slug]?.has(normalizeToolName(toolName)) ?? false;
}

// Higgsfield nests its real arguments as `params` (object or JSON string);
// bare top-level arguments are the degenerate fallback shape.
function readHiggsfieldParams(args: unknown): Record<string, unknown> | null {
	if (typeof args !== "object" || args === null) {
		return null;
	}

	const record = args as Record<string, unknown>;

	return typeof record.params === "object" &&
		record.params !== null &&
		!Array.isArray(record.params)
		? (record.params as Record<string, unknown>)
		: typeof record.params === "string"
			? tryParseJsonRecord(record.params)
			: record;
}

// Higgsfield's `get_cost: true` turns a generate call into a fast, free cost
// preflight: queueing or billing it would reserve credits, insert an attempt
// row, and show a phantom progress card for a call that renders nothing.
function isCostPreflight(args: unknown): boolean {
	return readHiggsfieldParams(args)?.get_cost === true;
}

function tryParseJsonRecord(value: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(value);
		return typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

// The unified creative director applies to EVERY from-scratch video render:
// a Higgsfield generate_video call must carry a composed creative brief (the
// same intake as the gateway generate_video tool), never a one-line wish.
// The floor is deliberately low — it only catches calls that plainly skipped
// the intake, and the rejection costs nothing (no reservation, no row).
const VIDEO_BRIEF_MIN_CHARS = 40;

function videoBriefGateError(
	connectorSlug: string,
	toolName: string,
	args: unknown,
): Record<string, unknown> | null {
	if (
		connectorSlug !== "higgsfield" ||
		normalizeToolName(toolName) !== "generate_video" ||
		isCostPreflight(args)
	) {
		return null;
	}

	// Image-to-video and motion-transfer calls carry reference media — that
	// is animate-an-existing-asset territory, not a from-scratch commercial:
	// a short motion hint next to a start_image is legitimate, never gated.
	const medias = readHiggsfieldParams(args)?.medias;

	if (Array.isArray(medias) && medias.length > 0) {
		return null;
	}

	const prompt = locateGenerationPrompt(args);

	if (!prompt || prompt.trim().length >= VIDEO_BRIEF_MIN_CHARS) {
		return null;
	}

	return platformToolError(
		"This video call needs a complete creative brief, not a one-line " +
			"prompt. Run the creative-director intake first (ask_user: video " +
			"type, key moment, setting, mood, audience — plus format and " +
			"duration when unset), then call again with the composed CREATIVE " +
			"BRIEF as the prompt. Wandit's video director turns that brief into " +
			"the provider's own prompt language automatically.",
	);
}

// Higgsfield's upload surfaces are dead ends in this client: Wandit cannot
// render the Apps-UI upload widget (the chat card has nothing to click), and
// the chat agent has no shell for media_upload's presigned-URL curl flow.
// Models land on them because the provider's own descriptions claim chat
// attachments are unreadable — untrue in Wandit, where every attachment is
// already a public HTTPS URL that media_import_url can ingest. The rejection
// is free (no provider call, no reservation) and self-corrects in-turn.
const HIGGSFIELD_UPLOAD_SURFACE_TOOLS = new Set([
	"media_upload",
	"media_upload_widget",
]);

function uploadSurfaceRedirectError(
	connectorSlug: string,
	toolName: string,
): Record<string, unknown> | null {
	if (
		connectorSlug !== "higgsfield" ||
		!HIGGSFIELD_UPLOAD_SURFACE_TOOLS.has(normalizeToolName(toolName))
	) {
		return null;
	}

	return platformToolError(
		"This chat cannot display Higgsfield's upload widget or run its " +
			"presigned-URL uploads — media_upload and media_upload_widget never " +
			"work here. Files the user attached to this chat are ALREADY hosted " +
			"at public HTTPS URLs: find the [Attached image/file …] marker in " +
			"the conversation and call media_import_url with that exact URL — " +
			"it returns a confirmed media_id to pass in the generation's " +
			"medias. If no attachment exists yet, ask the user to attach the " +
			'file to a chat message (ask_user kind "attachments"), then import ' +
			"its marker URL the same way.",
	);
}

// DEMO-SAFE: the provider's own tool descriptions pass through UNCHANGED.
// A Wandit-authored rewrite here once dropped Higgsfield's model-id
// documentation and the chat model started inventing ids ("higgsfield_soul")
// — a failed, refunded generation. Any future rewrite must keep the exact
// model ids and the media_id rules from the live descriptions.
const HIGGSFIELD_AUTO_TOOLS = [
	"media_upload",
	"media_upload_widget",
	"media_import_url",
	"media_confirm",
	"select_workspace",
	"generate_image",
	"generate_video",
	"generate_audio",
	"generate_3d",
	"animation_actions",
	"outpaint_image",
	"reframe",
	"remove_background",
	"upscale_image",
	"upscale_video",
	"motion_control",
	"voice_change",
	"dubbing",
] as const;
const HIGGSFIELD_TIKTOK_AUTO_TOOLS = [
	"tiktok_accounts",
	"tiktok_connect",
	"tiktok_music_trending",
	"tiktok_music_tune",
	"tiktok_prepare_publish",
	"tiktok_publish_status",
	"tiktok_reconnect",
] as const;
const CONNECTOR_TOOL_OVERRIDES: Record<
	string,
	{ autoTools: readonly string[]; autoApproveTools?: readonly string[] }
> = {
	higgsfield: {
		autoApproveTools: HIGGSFIELD_TIKTOK_AUTO_TOOLS,
		autoTools: HIGGSFIELD_AUTO_TOOLS,
	},
};
const DEFAULT_VISIBLE_TOOLS: Record<string, readonly string[]> = {
	higgsfield: [
		...HIGGSFIELD_AUTO_TOOLS,
		"models_explore",
		"job_status",
		"job_display",
		"show_generations",
	],
	"meta-ads": [
		"ads_get_ad_accounts",
		"ads_get_ad_entities",
		"ads_entity_get_report",
		"ads_insights_performance_trend",
		"ads_insights_advertiser_context",
		"ads_get_ad_preview",
		"ads_get_creatives",
		"ads_get_ad_account_pages",
		"ads_get_ig_accounts",
		"ads_get_ad_account_custom_audiences",
		"ads_get_errors",
		"ads_library_search",
		"ads_get_field_context",
	],
	"tiktok-ads": [
		"advertiser_info_get",
		"auth_advertiser_get",
		"report_integrated_get",
		"identity_get",
		"page_get",
		"pixel_list_get",
		"dmp_custom_audience_list_get",
		"smart_plus_campaign_get",
	],
};

const platformConnectorSchema = z.enum([
	"tiktok-ads",
	"meta-ads",
	"higgsfield",
]);
const searchPlatformToolsInputSchema = z
	.object({
		connector: platformConnectorSchema.optional(),
		query: z.string().min(1),
	})
	.strict();
const describePlatformToolInputSchema = z
	.object({
		connector: z.string().min(1),
		tool_name: z.string().min(1),
	})
	.strict();
const runPlatformToolInputSchema = z
	.object({
		connector: z.string().min(1),
		params: z.record(z.string(), z.unknown()),
		tool_name: z.string().min(1),
	})
	.strict();

type McpSkipReason =
	| "name_collision"
	| "policy_invalid"
	| "reconnect_required"
	| "unreachable";

const SKIP_REASON_TEXT: Record<McpSkipReason, string> = {
	name_collision: "tool name collision",
	policy_invalid: "invalid tool policy",
	reconnect_required: "reconnect required",
	unreachable: "connector unreachable",
};

const SKIP_REASON_GUIDANCE: Record<McpSkipReason, string> = {
	name_collision:
		"Tell the user that some connector tools were skipped because their names conflict if they ask for them.",
	policy_invalid:
		"Tell the user that its connector configuration must be fixed by an administrator if they ask for it.",
	reconnect_required:
		"If the user asks for ANYTHING that needs this connector (a generation, a report…), tell them to reconnect it in Settings → Connectors — never announce or pretend to start that work.",
	unreachable:
		"If the user asks for ANYTHING that needs this connector (a generation, a report…), say plainly that it is temporarily unavailable right now and to try again shortly — never announce or pretend to start that work.",
};

export type McpChatToolsResult = {
	approvalMap: McpToolApprovalMap;
	close: () => Promise<void>;
	/** Sorted unique slugs of the connectors that contributed tools. */
	connectedSlugs: string[];
	notices: string[];
	tools: Record<string, Tool>;
};

type ConnectorRuntimeContext = {
	client: MCPClient;
	connectionId: string;
	connector: McpConnectorRow;
};

type ConnectorToolResult = Pick<McpChatToolsResult, "approvalMap" | "tools"> & {
	connector?: McpConnectorRow;
	notice?: string;
	runtime?: ConnectorRuntimeContext;
};

type DiscoveredConnectorTools = {
	client: MCPClient;
	tools: Record<string, Tool>;
};

type CatalogIndexEntry = {
	connector: string;
	description: string;
	hidden: boolean;
	name: string;
};

type RegisteredCloser = () => Promise<void>;

type UnknownToolExecute = (
	input: unknown,
	options: ToolExecutionOptions<unknown>,
) => unknown;

@Injectable()
export class McpChatToolsService {
	private readonly logger = new Logger(McpChatToolsService.name);
	/**
	 * userId:connectorSlug:targetEntityIds(sorted):toolName -> acknowledgement
	 * expiry (ms). Keyed per actor AND per operation, so a different write on
	 * the same entity cannot consume another call's acknowledgement.
	 */
	private readonly adsChangeWindowAcknowledgements = new Map<string, number>();

	constructor(
		@Inject(ConnectorOperationEventsRepository)
		private readonly connectorOperationEventsRepository: ConnectorOperationEventsRepository,
		@Inject(McpConnectionsRepository)
		private readonly connectionsRepository: McpConnectionsRepository,
		@Inject(McpConnectorsRepository)
		private readonly connectorsRepository: McpConnectorsRepository,
		@Inject(McpConnectionsService)
		private readonly connectionsService: McpConnectionsService,
		@Inject(McpRuntimeCacheService)
		private readonly runtimeCache: McpRuntimeCacheService,
		@Inject(ConnectorGenerationsRepository)
		private readonly connectorGenerationsRepository: ConnectorGenerationsRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		@Inject(HiggsfieldPromptRefinerService)
		private readonly promptRefiner: HiggsfieldPromptRefinerService,
	) {}

	async resolveToolsForUser(
		subject: MeteringSubject,
		parentEventId?: string,
		// Requesting chat, when there is one: scopes background-generation
		// request idempotency to (chatId, requestKey).
		chatId?: string,
	): Promise<McpChatToolsResult> {
		// Connections belong to the acting member; the subject's payer (org pool
		// in an org workspace) funds connector generations.
		const userId = subject.actorUserId;
		const connections = (
			await this.connectionsRepository.listByUser(userId)
		).filter(hasStoredToken);

		if (connections.length === 0) {
			return emptyResult();
		}

		const connectors = await this.connectorsRepository.listEnabled();
		const connectorsById = new Map(
			connectors.map((connector) => [connector.id, connector]),
		);
		const closers: RegisteredCloser[] = [];
		const registerCloser = (client: MCPClient): RegisteredCloser => {
			let closePromise: Promise<void> | undefined;
			const close = () => {
				closePromise ??= Promise.resolve()
					.then(() => client.close())
					.catch(() => {});
				return closePromise;
			};

			closers.push(close);
			return close;
		};

		const connectorResults = await Promise.all(
			connections.map(async (connection) => {
				const connector = connectorsById.get(connection.connectorId);

				if (!connector) {
					return emptyConnectorResult();
				}

				try {
					return await this.resolveConnectorTools(
						subject,
						parentEventId,
						chatId ?? null,
						connection,
						connector,
						registerCloser,
					);
				} catch (error) {
					// The chat silently continues without this connector — without a
					// capture the failure is invisible in production.
					Sentry.captureException(error, {
						tags: { connectorId: connector.id, connectorSlug: connector.slug },
					});
					return skippedConnector(connector, "unreachable");
				}
			}),
		);
		const tools: Record<string, Tool> = {};
		const approvalMap: McpToolApprovalMap = {};
		const notices: string[] = [];
		const runtimes: ConnectorRuntimeContext[] = [];
		const connectedSlugs = new Set<string>();

		for (const result of connectorResults) {
			let hasNameCollision = false;

			if (
				result.connector &&
				(result.runtime || Object.keys(result.tools).length > 0)
			) {
				connectedSlugs.add(result.connector.slug);
			}

			for (const [name, tool] of Object.entries(result.tools)) {
				if (Object.hasOwn(tools, name)) {
					hasNameCollision = true;
					continue;
				}

				tools[name] = tool;
				const approval = result.approvalMap[name];
				if (approval !== undefined) {
					approvalMap[name] = approval;
				}
			}

			if (result.runtime) {
				runtimes.push(result.runtime);
			}

			if (result.notice) {
				notices.push(result.notice);
			} else if (hasNameCollision && result.connector) {
				notices.push(connectorNotice(result.connector, "name_collision"));
			}
		}

		if (runtimes.length > 0) {
			Object.assign(
				tools,
				this.createDiscoveryDoors(
					subject,
					parentEventId,
					chatId ?? null,
					runtimes,
				),
			);
			approvalMap.run_platform_tool = classifyPlatformToolApproval;
		}

		return {
			approvalMap: sortRecord(approvalMap),
			close: async () => {
				await Promise.all(closers.map((close) => close()));
			},
			connectedSlugs: [...connectedSlugs].sort(),
			notices,
			tools: sortRecord(tools),
		};
	}

	private async resolveConnectorTools(
		subject: MeteringSubject,
		parentEventId: string | undefined,
		chatId: string | null,
		connection: McpConnectionRow,
		connector: McpConnectorRow,
		registerCloser: (client: MCPClient) => RegisteredCloser,
	): Promise<ConnectorToolResult> {
		let visibleTools: Set<string> | undefined;

		if (connector.toolPolicy !== null) {
			const policy = mcpToolPolicySchema.safeParse(connector.toolPolicy);

			if (!policy.success) {
				this.logger.warn(
					`Invalid MCP tool policy for connector ${connector.slug}; skipping connector`,
				);
				return skippedConnector(connector, "policy_invalid");
			}

			if (policy.data.allowlist && policy.data.allowlist.length > 0) {
				visibleTools = new Set(policy.data.allowlist);
			}
		}

		if (!visibleTools) {
			const defaultVisibleTools = DEFAULT_VISIBLE_TOOLS[connector.slug];
			visibleTools = defaultVisibleTools
				? new Set(defaultVisibleTools)
				: undefined;
		}

		if (!connector.mcpServerUrl) {
			return skippedConnector(connector, "unreachable");
		}

		let accessToken: string;

		try {
			accessToken = await this.connectionsService.getValidAccessToken(
				subject.actorUserId,
				connector.slug,
			);
		} catch (error) {
			// reconnect_required is an expected state (user must re-auth) — only
			// genuine reachability failures go to Sentry.
			if (!(error instanceof ConflictException)) {
				Sentry.captureException(error, {
					tags: { connectorId: connector.id, connectorSlug: connector.slug },
				});
			}
			return skippedConnector(
				connector,
				error instanceof ConflictException
					? "reconnect_required"
					: "unreachable",
			);
		}

		let discovery: DiscoveredConnectorTools;

		try {
			discovery = await this.discoverTools(
				connection.id,
				connector.mcpServerUrl,
				accessToken,
				registerCloser,
			);
		} catch (error) {
			Sentry.captureException(error, {
				tags: { connectorId: connector.id, connectorSlug: connector.slug },
			});
			return skippedConnector(connector, "unreachable");
		}

		const tools: Record<string, Tool> = {};
		const approvalMap: McpToolApprovalMap = {};
		let hasNameCollision = false;

		for (const [toolName, tool] of sortedEntries(discovery.tools)) {
			if (
				connector.slug === "tiktok-ads" &&
				toolName !== "tool_execute" &&
				TIKTOK_GATEWAY_TOOLS.has(toolName)
			) {
				continue;
			}

			if (visibleTools && !visibleTools.has(toolName)) {
				continue;
			}

			const namespacedName = namespaceToolName(connector.slug, toolName);
			if (Object.hasOwn(tools, namespacedName)) {
				hasNameCollision = true;
				continue;
			}

			tools[namespacedName] = isBackgroundGenerationTool(
				connector.slug,
				toolName,
			)
				? this.wrapBackgroundGenerationTool(
						tool,
						subject,
						parentEventId,
						chatId,
						connector.slug,
						toolName,
					)
				: this.wrapConnectorTool(
						tool,
						subject,
						parentEventId,
						connector.slug,
						toolName,
					);

			const normalizedToolName = normalizeToolName(toolName);
			const autoTools =
				CONNECTOR_TOOL_OVERRIDES[connector.slug]?.autoTools ?? [];

			if (autoTools.includes(normalizedToolName)) {
				continue;
			}

			const autoApproveTools =
				CONNECTOR_TOOL_OVERRIDES[connector.slug]?.autoApproveTools ?? [];

			if (autoApproveTools.includes(normalizedToolName)) {
				continue;
			}

			if (GENERIC_WRAPPER_TOOLS.has(normalizedToolName)) {
				const wrapperSlug = connector.slug;
				approvalMap[namespacedName] = isAdsApprovalConnector(wrapperSlug)
					? (input: unknown) =>
							classifyAdsWrappedToolApproval(wrapperSlug, input)
					: classifyWrappedToolApproval;
			} else if (isAdsApprovalConnector(connector.slug)) {
				// Ads tools use the money-based policy: build steps run free,
				// only launch / money / delete moments keep the card. The verdict
				// depends on the ARGUMENTS (paused vs live status), so it is a
				// call-time function, never a static "user-approval" — and it is
				// registered for read-NAMED tools too, so a status-setter whose
				// name reads like a read still gets its arguments inspected.
				const adsSlug = connector.slug;
				approvalMap[namespacedName] = (input: unknown) =>
					classifyAdsToolApproval(adsSlug, toolName, input);
			} else if (classifyToolName(toolName) === "write") {
				approvalMap[namespacedName] = "user-approval";
			}
		}

		return {
			approvalMap,
			connector,
			notice: hasNameCollision
				? connectorNotice(connector, "name_collision")
				: undefined,
			runtime: {
				client: discovery.client,
				connectionId: connection.id,
				connector,
			},
			tools,
		};
	}

	private async discoverTools(
		connectionId: string,
		url: string,
		accessToken: string,
		registerCloser: (client: MCPClient) => RegisteredCloser,
	): Promise<DiscoveredConnectorTools> {
		let abandoned = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const localClosers: RegisteredCloser[] = [];
		const attempt = async (
			session: McpRuntimeSession | undefined,
		): Promise<DiscoveredConnectorTools> => {
			if (abandoned) {
				throw new Error("MCP connector discovery was abandoned");
			}

			const connected = await this.connectClient(
				connectionId,
				url,
				accessToken,
				session,
			);
			const closeClient = registerCloser(connected.client);
			localClosers.push(closeClient);

			try {
				if (abandoned) {
					throw new Error("MCP connector discovery was abandoned");
				}
				if (connected.sessionExpired()) {
					throw expiredSessionError();
				}

				let catalog = this.runtimeCache.getCatalog(connectionId);

				// A resumed transport needs one foreground request so a stale
				// session cannot slip past the SDK's asynchronous GET check.
				if (session || !catalog) {
					const definitions = await withReadRetry(() =>
						connected.client.listTools(),
					);

					if (abandoned) {
						throw new Error("MCP connector discovery was abandoned");
					}
					if (connected.sessionExpired()) {
						throw expiredSessionError();
					}

					if (!catalog) {
						catalog = catalogToolsFromDefinitions(definitions);
						this.runtimeCache.setCatalog(connectionId, catalog);
					}
				}

				const tools = connected.client.toolsFromDefinitions(
					asListToolsResult(catalog),
					{ schemas: "automatic" },
				) as unknown as Record<string, Tool>;

				if (connected.sessionExpired()) {
					throw expiredSessionError();
				}

				return { client: connected.client, tools };
			} catch (error) {
				await closeClient();
				throw connected.sessionExpired() ? expiredSessionError() : error;
			}
		};
		const discoveryPromise = (async () => {
			const session = this.runtimeCache.getSession(connectionId);

			try {
				return await attempt(session);
			} catch (error) {
				if (abandoned || !session || !isDeadSessionError(error)) {
					throw error;
				}

				this.runtimeCache.invalidateSession(connectionId, session.sessionId);
				return attempt(undefined);
			}
		})();
		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeout = setTimeout(
				() => reject(new Error("MCP connector timed out")),
				MCP_CONNECT_TIMEOUT_MS,
			);
		});

		try {
			return await Promise.race([discoveryPromise, timeoutPromise]);
		} catch (error) {
			abandoned = true;
			await Promise.all(localClosers.map((close) => close()));
			throw error;
		} finally {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
	}

	private async connectClient(
		connectionId: string,
		url: string,
		accessToken: string,
		session: McpRuntimeSession | undefined,
	): Promise<{
		client: MCPClient;
		sessionExpired: () => boolean;
	}> {
		let client: MCPClient | undefined;
		let currentSessionId = session?.sessionId;
		let expired = false;
		const connectedClient = await createMCPClient({
			...(session ? { initialInitializeResult: session.initializeResult } : {}),
			transport: {
				headers: { Authorization: `Bearer ${accessToken}` },
				...(session
					? {
							initialProtocolVersion: session.initializeResult.protocolVersion,
							initialSessionId: session.sessionId,
						}
					: {}),
				onSessionExpired: (expiredSessionId) => {
					expired = true;
					if (currentSessionId === expiredSessionId) {
						currentSessionId = undefined;
					}
					this.runtimeCache.invalidateSession(connectionId, expiredSessionId);
				},
				onSessionIdChange: (nextSessionId) => {
					const previousSessionId = currentSessionId;
					currentSessionId = nextSessionId;

					if (!nextSessionId) {
						this.runtimeCache.invalidateSession(
							connectionId,
							previousSessionId,
						);
					} else if (client) {
						this.runtimeCache.setSession(connectionId, {
							initializeResult: client.initializeResult,
							sessionId: nextSessionId,
						});
					}
				},
				terminateSessionOnClose: false,
				type: "http",
				url,
			},
		});
		client = connectedClient;

		if (currentSessionId) {
			this.runtimeCache.setSession(connectionId, {
				initializeResult: connectedClient.initializeResult,
				sessionId: currentSessionId,
			});
		}

		return {
			client: connectedClient,
			sessionExpired: () => expired,
		};
	}

	private async ensureCatalog(
		runtime: ConnectorRuntimeContext,
		options: ToolExecutionOptions<unknown>,
	): Promise<McpCatalogTool[]> {
		const cached = this.runtimeCache.getCatalog(runtime.connectionId);
		if (cached) {
			return cached;
		}

		const definitions = await withReadRetry(() =>
			runtime.client.listTools(
				options.abortSignal
					? { options: { signal: options.abortSignal } }
					: undefined,
			),
		);
		const catalog = catalogToolsFromDefinitions(definitions);
		this.runtimeCache.setCatalog(runtime.connectionId, catalog);
		return catalog;
	}

	private createDiscoveryDoors(
		subject: MeteringSubject,
		parentEventId: string | undefined,
		chatId: string | null,
		runtimes: ConnectorRuntimeContext[],
	): Record<string, Tool> {
		const runtimesBySlug = new Map<string, ConnectorRuntimeContext>();

		for (const runtime of [...runtimes].sort(compareRuntimes)) {
			if (!runtimesBySlug.has(runtime.connector.slug)) {
				runtimesBySlug.set(runtime.connector.slug, runtime);
			}
		}

		return {
			describe_platform_tool: dynamicTool({
				description:
					"Read the full description and input schema for one connected platform tool.",
				execute: async (input, options) => {
					const parsed = describePlatformToolInputSchema.safeParse(input);
					if (!parsed.success) {
						return platformToolError(
							"connector and tool_name must be non-empty strings.",
						);
					}

					return this.describePlatformTool(
						runtimesBySlug,
						parsed.data,
						options,
					);
				},
				inputSchema: describePlatformToolInputSchema,
			}),
			run_platform_tool: dynamicTool({
				description:
					"Run one connected platform operation after its parameters have been described.",
				execute: async (input, options) => {
					const parsed = runPlatformToolInputSchema.safeParse(input);
					if (!parsed.success) {
						return platformToolError(
							"connector, tool_name, and an object params value are required.",
						);
					}

					return this.runPlatformTool(
						subject,
						parentEventId,
						chatId,
						runtimesBySlug,
						parsed.data,
						options,
					);
				},
				inputSchema: runPlatformToolInputSchema,
			}),
			search_platform_tools: dynamicTool({
				description:
					"Search every connected platform's full operation catalog by name and description.",
				execute: async (input, options) => {
					const parsed = searchPlatformToolsInputSchema.safeParse(input);
					if (!parsed.success) {
						return platformToolError(
							"query must be a non-empty string and connector must be a supported slug.",
						);
					}

					return this.searchPlatformTools(runtimesBySlug, parsed.data, options);
				},
				inputSchema: searchPlatformToolsInputSchema,
			}),
		};
	}

	private async searchPlatformTools(
		runtimesBySlug: Map<string, ConnectorRuntimeContext>,
		input: z.infer<typeof searchPlatformToolsInputSchema>,
		options: ToolExecutionOptions<unknown>,
	) {
		const runtimes = input.connector
			? [runtimesBySlug.get(input.connector)].filter(
					(runtime): runtime is ConnectorRuntimeContext => Boolean(runtime),
				)
			: [...runtimesBySlug.values()];
		const catalogs = await Promise.all(
			runtimes.map((runtime) => this.buildCatalogIndex(runtime, options)),
		);
		const ranked = rankCatalogEntries(catalogs.flat(), input.query, false);

		return {
			hint: "Call describe_platform_tool before run_platform_tool whenever the parameters are not obvious.",
			tools: ranked.slice(0, PLATFORM_TOOL_RESULT_LIMIT).map(({ entry }) => ({
				connector: entry.connector,
				requires_approval: requiresApproval(entry.connector, entry.name),
				summary: truncateDescription(entry.description),
				tool_name: entry.name,
			})),
		};
	}

	private async buildCatalogIndex(
		runtime: ConnectorRuntimeContext,
		options: ToolExecutionOptions<unknown>,
		knownHiddenOperations?: TikTokHiddenOperation[],
	): Promise<CatalogIndexEntry[]> {
		const catalog = await this.ensureCatalog(runtime, options);
		const entries = new Map<string, CatalogIndexEntry>();

		for (const tool of catalog) {
			if (
				runtime.connector.slug === "tiktok-ads" &&
				TIKTOK_GATEWAY_TOOLS.has(tool.name)
			) {
				continue;
			}

			entries.set(tool.name, {
				connector: runtime.connector.slug,
				description: tool.description,
				hidden: false,
				name: tool.name,
			});
		}

		if (runtime.connector.slug === "tiktok-ads") {
			const hiddenOperations =
				knownHiddenOperations ??
				(await this.getTikTokHiddenCatalog(runtime, options));

			for (const operation of hiddenOperations) {
				if (!entries.has(operation.name)) {
					entries.set(operation.name, {
						connector: runtime.connector.slug,
						description: operation.description,
						hidden: true,
						name: operation.name,
					});
				}
			}
		}

		return [...entries.values()];
	}

	private async getTikTokHiddenCatalog(
		runtime: ConnectorRuntimeContext,
		options: ToolExecutionOptions<unknown>,
	): Promise<TikTokHiddenOperation[]> {
		const cached = this.runtimeCache.getTikTokHiddenCatalog(
			runtime.connectionId,
		);
		if (cached) {
			return cached;
		}

		try {
			const result = await callMcpTool(
				runtime.client,
				"tool_list",
				{},
				options,
				true,
			);

			if (isMcpErrorResult(result)) {
				this.logger.warn(
					`TikTok hidden tool catalog could not be loaded for connection ${runtime.connectionId}`,
				);
				return [];
			}

			const operations = parseTikTokHiddenOperations(result);
			this.runtimeCache.setTikTokHiddenCatalog(
				runtime.connectionId,
				operations,
			);
			return operations;
		} catch {
			this.logger.warn(
				`TikTok hidden tool catalog could not be loaded for connection ${runtime.connectionId}`,
			);
			return [];
		}
	}

	private async describePlatformTool(
		runtimesBySlug: Map<string, ConnectorRuntimeContext>,
		input: z.infer<typeof describePlatformToolInputSchema>,
		options: ToolExecutionOptions<unknown>,
	) {
		const runtime = runtimesBySlug.get(input.connector);
		if (!runtime) {
			return platformToolError(
				`Connector "${input.connector}" is not connected for this request.`,
			);
		}

		if (
			runtime.connector.slug === "tiktok-ads" &&
			TIKTOK_GATEWAY_TOOLS.has(input.tool_name)
		) {
			return platformToolError(
				`Tool "${input.tool_name}" is internal connector plumbing and cannot be described directly.`,
			);
		}

		const catalog = await this.ensureCatalog(runtime, options);
		const catalogTool = catalog.find((tool) => tool.name === input.tool_name);
		if (catalogTool) {
			return {
				connector: runtime.connector.slug,
				description: catalogTool.description,
				inputSchema: catalogTool.inputSchema,
				tool_name: catalogTool.name,
			};
		}

		let knownHiddenOperations: TikTokHiddenOperation[] | undefined;
		if (runtime.connector.slug === "tiktok-ads") {
			const hiddenOperations = await this.getTikTokHiddenCatalog(
				runtime,
				options,
			);
			knownHiddenOperations = hiddenOperations;
			let hiddenOperation = hiddenOperations.find(
				(operation) => operation.name === input.tool_name,
			);

			if (hiddenOperation) {
				if (hiddenOperation.inputSchema === undefined) {
					const result = await callMcpTool(
						runtime.client,
						"tool_get",
						{ tool_name: hiddenOperation.name },
						options,
						true,
					);

					if (isMcpErrorResult(result)) {
						return platformToolError(
							`TikTok could not describe "${hiddenOperation.name}".`,
						);
					}

					const details = parseTikTokToolDetails(result, hiddenOperation.name);
					this.runtimeCache.updateTikTokHiddenOperation(
						runtime.connectionId,
						hiddenOperation.name,
						{
							description: details.description || hiddenOperation.description,
							inputSchema: details.inputSchema ?? {},
						},
					);
					hiddenOperation =
						this.runtimeCache
							.getTikTokHiddenCatalog(runtime.connectionId)
							?.find((operation) => operation.name === input.tool_name) ??
						hiddenOperation;
				}

				return {
					connector: runtime.connector.slug,
					description: hiddenOperation.description,
					inputSchema: hiddenOperation.inputSchema ?? {},
					tool_name: hiddenOperation.name,
				};
			}
		}

		const closestMatches = rankCatalogEntries(
			await this.buildCatalogIndex(runtime, options, knownHiddenOperations),
			input.tool_name,
			true,
		)
			.slice(0, 5)
			.map(({ entry }) => entry.name);

		return platformToolError(
			closestMatches.length > 0
				? `Tool "${input.tool_name}" was not found on ${runtime.connector.slug}. Closest matches: ${closestMatches.join(", ")}.`
				: `Tool "${input.tool_name}" was not found on ${runtime.connector.slug}.`,
		);
	}

	private async runPlatformTool(
		subject: MeteringSubject,
		parentEventId: string | undefined,
		chatId: string | null,
		runtimesBySlug: Map<string, ConnectorRuntimeContext>,
		input: z.infer<typeof runPlatformToolInputSchema>,
		options: ToolExecutionOptions<unknown>,
	) {
		const runtime = runtimesBySlug.get(input.connector);
		if (!runtime) {
			return platformToolError(
				`Connector "${input.connector}" is not connected for this request.`,
			);
		}

		if (
			runtime.connector.slug === "tiktok-ads" &&
			TIKTOK_GATEWAY_TOOLS.has(input.tool_name)
		) {
			return platformToolError(
				`Tool "${input.tool_name}" is internal connector plumbing and cannot be run directly.`,
			);
		}

		const catalog = await this.ensureCatalog(runtime, options);

		// Batch generations run for minutes inline with no attempt row, no
		// billing plan, and no card — the media then "suddenly appears" with
		// zero progress. Route the model to the supported single-shot tools.
		if (
			runtime.connector.slug === "higgsfield" &&
			HIGGSFIELD_BATCH_TOOLS.has(normalizeToolName(input.tool_name))
		) {
			return platformToolError(
				`Tool "${input.tool_name}" is not supported here. Call ` +
					"generate_image / generate_video instead (once per asset; the " +
					"count parameter covers multiples) — each call gets its own " +
					"live progress card.",
			);
		}

		// Long-running generations never execute inline — same intercept as
		// their namespaced tool, so the door cannot bypass the background path.
		// The CANONICAL catalog name is queued (never the raw model spelling),
		// so a drifted name falls through to the usual not-found guidance.
		if (
			isBackgroundGenerationTool(runtime.connector.slug, input.tool_name) &&
			env.TRIGGER_SECRET_KEY
		) {
			const canonical = catalog.find(
				(tool) =>
					normalizeToolName(tool.name) === normalizeToolName(input.tool_name),
			);

			if (canonical) {
				const briefGateError = videoBriefGateError(
					runtime.connector.slug,
					canonical.name,
					input.params,
				);

				if (briefGateError) {
					return briefGateError;
				}

				// Cost preflight: fast, free, unbilled — never queued.
				if (isCostPreflight(input.params)) {
					return this.executeInlineConnectorTool({
						connectorSlug: runtime.connector.slug,
						input: input.params,
						invoke: (args) =>
							callMcpTool(
								runtime.client,
								canonical.name,
								args as Record<string, unknown>,
								options,
								false,
							),
						options,
						parentEventId,
						retryProviderExecution: true,
						subject,
						toolName: canonical.name,
					});
				}

				return this.queueBackgroundGeneration(
					subject,
					parentEventId,
					chatId,
					runtime.connector.slug,
					canonical.name,
					input.params,
					options.toolCallId,
				);
			}
		}

		const catalogTool = catalog.find((tool) => tool.name === input.tool_name);
		if (catalogTool) {
			return this.executeInlineConnectorTool({
				connectorSlug: runtime.connector.slug,
				input: input.params,
				invoke: (args) =>
					callMcpTool(
						runtime.client,
						catalogTool.name,
						args as Record<string, unknown>,
						options,
						false,
					),
				options,
				parentEventId,
				retryProviderExecution: classifyToolName(catalogTool.name) === "read",
				subject,
				toolName: catalogTool.name,
			});
		}

		if (runtime.connector.slug === "tiktok-ads") {
			const hiddenOperations = await this.getTikTokHiddenCatalog(
				runtime,
				options,
			);
			const hiddenOperation = hiddenOperations.find(
				(operation) => operation.name === input.tool_name,
			);

			if (hiddenOperation) {
				return this.executeInlineConnectorTool({
					connectorSlug: runtime.connector.slug,
					input: input.params,
					invoke: (args) =>
						callMcpTool(
							runtime.client,
							"tool_execute",
							{
								params: args,
								tool_name: hiddenOperation.name,
							},
							options,
							false,
						),
					options,
					parentEventId,
					retryProviderExecution:
						classifyToolName(hiddenOperation.name) === "read",
					subject,
					toolName: hiddenOperation.name,
				});
			}
		}

		return platformToolError(
			`Tool "${input.tool_name}" is not available on ${runtime.connector.slug}. Search the catalog again for the canonical name.`,
		);
	}

	private wrapConnectorTool(
		tool: Tool,
		subject: MeteringSubject,
		parentEventId: string | undefined,
		connectorSlug: string,
		toolName: string,
	): Tool {
		const executable = tool as Tool & { execute?: UnknownToolExecute };
		if (typeof executable.execute !== "function") {
			return tool;
		}

		const execute = executable.execute;
		return {
			...executable,
			execute: async (rawInput, options) => {
				const isGenericWrapper = GENERIC_WRAPPER_TOOLS.has(
					normalizeToolName(toolName),
				);

				// Ads wrapper calls sometimes carry params as a JSON STRING the
				// gateway would happily parse — but the USD guard, the 72 h
				// guard, and the telemetry walk objects, so a string params
				// would blind all of them at once. Normalize it to the parsed
				// object (the provider accepts both); an unparseable string is
				// rejected outright, free and self-correcting in-turn.
				let input = rawInput;

				if (
					isGenericWrapper &&
					isAdsApprovalConnector(connectorSlug) &&
					typeof rawInput === "object" &&
					rawInput !== null &&
					typeof (rawInput as Record<string, unknown>).params === "string"
				) {
					const parsedParams = tryParseJsonRecord(
						(rawInput as Record<string, unknown>).params as string,
					);

					if (!parsedParams) {
						return platformToolError(
							"params must be a JSON OBJECT, not a string. Resend the " +
								"same call with params as an object.",
						);
					}

					input = {
						...(rawInput as Record<string, unknown>),
						params: parsedParams,
					};
				}

				const effectiveToolName = isGenericWrapper
					? (readStringProperty(input, "tool_name") ?? toolName)
					: toolName;
				const shouldRetry = GENERIC_WRAPPER_TOOLS.has(
					normalizeToolName(toolName),
				)
					? classifyNestedToolName(input) === "read"
					: classifyToolName(toolName) === "read";
				const invoke = (args: unknown) =>
					Promise.resolve(execute(args, options));

				return this.executeInlineConnectorTool({
					connectorSlug,
					input,
					invoke,
					options,
					parentEventId,
					retryProviderExecution: shouldRetry,
					subject,
					toolName: effectiveToolName,
				});
			},
		} as Tool;
	}

	// Rewrites the generation prompt AFTER the metering reservation (the
	// refiner's own LLM call is billable inside the parent chat event, so it
	// must not run for a request that cannot hold credits). A refiner failure
	// degrades to the original arguments.
	private async refinePromptedGenerationArgs<TArgs>(
		subject: MeteringSubject,
		parentEventId: string | undefined,
		connectorSlug: string,
		toolName: string,
		args: TArgs,
	): Promise<TArgs> {
		if (!isPromptRefinedTool(connectorSlug, toolName)) {
			return args;
		}

		const refined = await this.promptRefiner.refineGenerationArgs({
			args,
			organizationId: subject.organizationId ?? null,
			parentEventId,
			toolName:
				normalizeToolName(toolName) === "generate_video"
					? "generate_video"
					: "generate_image",
			userId: subject.actorUserId,
		});

		return refined as TArgs;
	}

	private async executeInlineConnectorTool(input: {
		connectorSlug: string;
		input: unknown;
		/** Receives the (possibly prompt-refined) arguments to send. */
		invoke: (args: unknown) => Promise<unknown>;
		options: ToolExecutionOptions<unknown>;
		parentEventId?: string;
		retryProviderExecution?: boolean;
		subject: MeteringSubject;
		toolName: string;
	}): Promise<unknown> {
		// Dead-end upload surfaces are rejected before any provider call or
		// reservation — this shared choke point covers the visible namespaced
		// tools and the run_platform_tool door alike.
		const uploadRedirect = uploadSurfaceRedirectError(
			input.connectorSlug,
			input.toolName,
		);
		if (uploadRedirect) {
			return uploadRedirect;
		}

		// Money-safety backstop BEFORE any reservation or provider call: an ad
		// budget written in dinars must never reach a platform that will spend
		// the number as US dollars. Covers direct tools, run_platform_tool, and
		// TikTok hidden operations alike — this is the one shared choke point.
		assertUsdAdBudgetArgs(input.connectorSlug, input.input);

		// 72-hour change window: a write that targets a campaign / ad set / ad
		// Wandit touched less than 72 h ago is refused ONCE with an instructive
		// error (free, self-correcting in-turn); the same call repeated after
		// the user insists passes — the insistence is the approval (under the
		// money-based policy only money-moving, activating, or destructive
		// writes also show a confirmation card). The extractor runs on the
		// exact args object the provider receives (for TikTok hidden
		// operations that is input.params, already unwrapped by the caller),
		// including plural id arrays of bulk updates.
		const targetEntityIds = extractAdsTargetEntityIds(
			input.connectorSlug,
			input.toolName,
			input.input,
		);
		const guardError =
			targetEntityIds.length === 0
				? null
				: await this.adsChangeWindowError({ ...input, targetEntityIds });
		if (guardError) {
			return guardError;
		}

		const providerInput = {
			...input,
			invoke: () => input.invoke(input.input),
			targetEntityIds,
		};

		// A cost preflight renders nothing — the inline generation tools that
		// accept it (generate_audio, generate_3d) must not pay the connector
		// fee for a free price check, same carve-out as the background paths.
		if (input.connectorSlug === "higgsfield" && isCostPreflight(input.input)) {
			return this.invokeProviderTool(providerInput);
		}

		const plan = connectorGenerationPlan(
			input.toolName,
			input.input,
			input.connectorSlug,
		);
		if (!plan) {
			return this.invokeProviderTool(providerInput);
		}

		const referenceId = connectorGenerationReference({
			connectorSlug: input.connectorSlug,
			parentEventId: input.parentEventId,
			toolCallId: input.options.toolCallId,
			toolName: input.toolName,
			userId: input.subject.actorUserId,
		});
		const billing = this.createGenerationBilling();
		const reservations = await billing.reserve(input.subject, referenceId, {
			...plan,
			parentEventId: input.parentEventId,
		});
		assertFreshInlineConnectorReservations(reservations);

		// Reserve-before-refine: the refiner's own LLM spend lands on the parent
		// chat event only once the user's hold for this generation exists. A
		// refiner failure degrades to the original arguments and keeps the hold.
		const executeInput = await this.refinePromptedGenerationArgs(
			input.subject,
			input.parentEventId,
			input.connectorSlug,
			input.toolName,
			input.input,
		);
		let result: unknown;

		try {
			result = await this.invokeProviderTool({
				...providerInput,
				invoke: () => input.invoke(executeInput),
			});
		} catch (error) {
			const capture = gatewayGenerationCaptureFromError(error);

			if (capture) {
				try {
					await billing.capture(reservations, {
						...capture,
						stepUsage: fixedGenerationStepUsage(capture.stepUsage, 0),
					});
				} catch (captureError) {
					// Preserve the exact provider error while leaving both holds open.
					// Refunding after provider evidence failed to persist could create a
					// free-generation race; the stale sweep remains the backstop.
					Sentry.captureException(captureError, {
						tags: {
							connectorSlug: input.connectorSlug,
							referenceId,
							toolName: input.toolName,
						},
					});
					throw error;
				}
			}

			await this.refundGenerationWithoutMasking(
				billing,
				input.subject,
				referenceId,
				plan.childOperation,
				input.connectorSlug,
				input.toolName,
			);
			throw error;
		}

		if (isMcpErrorResult(result)) {
			// MCP transports return many provider failures as successful protocol
			// responses with isError=true. Capture any Gateway evidence before the
			// terminal-aware refund decides whether provider work occurred.
			await captureConnectorGenerationResult(billing, reservations, result);
			await this.refundGenerationWithoutMasking(
				billing,
				input.subject,
				referenceId,
				plan.childOperation,
				input.connectorSlug,
				input.toolName,
			);
			return result;
		}

		// Provider work has completed, so failures below propagate without a
		// refund. Persist the durable provider receipt and every discovered
		// gateway id before settling and before the result can be delivered.
		await recordConnectorSubmitReceipt(billing, reservations, {
			connectorSlug: input.connectorSlug,
			plan,
			referenceId,
			result,
		});
		const childUnits = deliveredInlineConnectorChildUnits(
			plan.childOperation,
			plan.childUnits,
			result,
		);
		await finalizeConnectorGenerationBilling(
			billing,
			reservations,
			connectorGatewayCaptures(result),
			{ childUnits },
		);

		return result;
	}

	/**
	 * Returns the change-window error for this write, or null when it may
	 * proceed. The first refusal records an acknowledgement key (30-minute
	 * TTL); the next call for the same user + connector + entities + operation
	 * consumes it and passes — that is the "user explicitly insists" path.
	 *
	 * The user's insistence IS the approval: the model relays the rule, the
	 * user says "do it anyway", the model repeats the call, and it runs —
	 * under the money-based policy most window-blocked writes show no card,
	 * so the acknowledged insistence is the only gate; money-moving writes
	 * keep their card. The guard never decides for the user.
	 *
	 * The lookup is scoped to the platform entity (organization, or the
	 * personal space), while the acknowledgement is per actor: the person who
	 * was told the rule is the one whose repeat counts.
	 */
	private async adsChangeWindowError(input: {
		connectorSlug: string;
		input: unknown;
		subject: MeteringSubject;
		targetEntityIds: string[];
		toolName: string;
	}): Promise<unknown> {
		const now = Date.now();
		const evaluate = (lastWriteAt: Date | null, acknowledged: boolean) =>
			evaluateAdsChangeWindow({
				acknowledged,
				args: input.input,
				connectorSlug: input.connectorSlug,
				lastWriteAt,
				now: new Date(now),
				targetEntityIds: input.targetEntityIds,
				toolName: input.toolName,
			});

		// Reads and creates can never be blocked — skip the lookup for them.
		if (!evaluate(new Date(now), false).blocked) {
			return null;
		}

		const key = [
			input.subject.actorUserId,
			input.connectorSlug,
			[...input.targetEntityIds].sort().join(","),
			input.toolName,
		].join(":");
		const acknowledgedUntil = this.adsChangeWindowAcknowledgements.get(key);
		const acknowledged =
			acknowledgedUntil !== undefined && acknowledgedUntil > now;
		// The acknowledgement is consumed synchronously, BEFORE the lookup
		// await, so two parallel copies of the same call cannot both pass on
		// one approval; it is restored below when the verdict turns out to be
		// a refusal anyway (the refusal re-arms the key for the next repeat).
		if (acknowledgedUntil !== undefined) {
			this.adsChangeWindowAcknowledgements.delete(key);
		}

		let lastWriteAt: Date | null = null;
		try {
			lastWriteAt =
				await this.connectorOperationEventsRepository.findLatestWriteAt({
					connectorSlug: input.connectorSlug,
					organizationId: input.subject.organizationId ?? null,
					targetEntityIds: input.targetEntityIds,
					userId: input.subject.actorUserId,
				});
		} catch {
			// The guard is a courtesy, never a gate on the provider call.
			this.logger.warn("Ads change-window lookup failed");
			return null;
		}

		const verdict = evaluate(lastWriteAt, acknowledged);

		if (verdict.blocked) {
			// Drop expired keys so the map cannot grow without bound.
			for (const [entry, expiry] of this.adsChangeWindowAcknowledgements) {
				if (expiry <= now) {
					this.adsChangeWindowAcknowledgements.delete(entry);
				}
			}

			// No await between the verdict and this set: the key is armed
			// before the refusal is returned.
			this.adsChangeWindowAcknowledgements.set(
				key,
				now + ADS_CHANGE_WINDOW_ACK_TTL_MS,
			);
			return platformToolError(verdict.message);
		}

		return null;
	}

	private async invokeProviderTool(input: {
		connectorSlug: string;
		invoke: () => Promise<unknown>;
		// Narrower than executeInlineConnectorTool's invoke: callers bind the
		// arguments first (raw for unbilled paths, refined after a reservation).
		parentEventId?: string;
		retryProviderExecution?: boolean;
		subject: MeteringSubject;
		targetEntityIds?: string[];
		toolName: string;
	}): Promise<unknown> {
		const invokeOnce = async () => {
			const startedAt = performance.now();

			try {
				const result = await input.invoke();

				if (isMcpErrorResult(result)) {
					this.recordConnectorOperation(input, "failed", startedAt, result);
					return result;
				}

				// A platform-level failure travels as a successful transport
				// response (TikTok { code != 0 }, Meta { error }): record it as
				// failed — a failed write never reset learning, so no target ids.
				const platformFailure = adsPlatformFailure(input.connectorSlug, result);
				if (platformFailure) {
					this.recordConnectorOperation(
						input,
						"failed",
						startedAt,
						platformFailure.payload,
						platformFailure.errorCode,
					);
					return result;
				}

				// A create records the CREATED entity's id (read from the
				// provider result — the arguments carry none of its own), never
				// the parent ids its arguments name: creating an ad set inside
				// a campaign resets nothing on the campaign, and a parent id
				// recorded here would falsely arm the 72 h window against later
				// legitimate edits of the parent.
				const isCreate = isAdsCreateToolName(input.toolName);
				const targetEntityIds = isCreate
					? extractAdsCreatedEntityIds(
							input.connectorSlug,
							input.toolName,
							result,
						)
					: (input.targetEntityIds ?? []);
				this.recordConnectorOperation(
					{ ...input, targetEntityIds },
					"succeeded",
					startedAt,
				);
				return result;
			} catch (error) {
				this.recordConnectorOperation(input, "failed", startedAt, error);
				throw error;
			}
		};

		return input.retryProviderExecution
			? withReadRetry(invokeOnce)
			: invokeOnce();
	}

	private recordConnectorOperation(
		input: {
			connectorSlug: string;
			parentEventId?: string;
			subject: MeteringSubject;
			targetEntityIds?: string[];
			toolName: string;
		},
		status: "failed" | "succeeded",
		startedAt: number,
		error?: unknown,
		platformErrorCode?: string | null,
	): void {
		try {
			const sanitizedError =
				status === "failed" ? sanitizeConnectorOperationError(error) : null;
			// Target ids only ride on successful rows: a failed write never
			// reset learning, so it must never arm the change-window guard.
			const targetEntityIds =
				status === "succeeded" &&
				input.targetEntityIds &&
				input.targetEntityIds.length > 0
					? input.targetEntityIds
					: null;
			const insert = this.connectorOperationEventsRepository.insert({
				connectorSlug: input.connectorSlug,
				durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
				errorCode: platformErrorCode ?? sanitizedError?.errorCode ?? null,
				errorMessage: sanitizedError?.errorMessage ?? null,
				feature: connectorOperationFeature(input.connectorSlug, input.toolName),
				organizationId: input.subject.organizationId ?? null,
				parentEventId: input.parentEventId,
				status,
				targetEntityIds,
				toolName: input.toolName,
				userId: input.subject.actorUserId,
			});
			void insert.catch(() => {
				this.logger.warn("Connector operation event insert failed");
			});
		} catch {
			this.logger.warn("Connector operation event insert failed");
		}
	}

	// Same schema and description as the provider tool, but execute queues a
	// durable attempt + Trigger.dev run instead of blocking the chat stream.
	// Without a Trigger key the legacy inline call is kept — degraded but
	// functional, exactly like the other queue-backed tools.
	private wrapBackgroundGenerationTool(
		tool: Tool,
		subject: MeteringSubject,
		parentEventId: string | undefined,
		chatId: string | null,
		connectorSlug: string,
		toolName: string,
	): Tool {
		const executable = tool as Tool & { execute?: UnknownToolExecute };
		const inlineExecute = executable.execute;

		return {
			...executable,
			execute: async (input, options) => {
				// A missing brief costs nothing here: no refine, no reservation,
				// no attempt row — the model corrects itself in the same turn.
				const briefGateError = videoBriefGateError(
					connectorSlug,
					toolName,
					input,
				);

				if (briefGateError) {
					return briefGateError;
				}

				// A cost preflight is fast and free — run it inline, unbilled,
				// with the arguments untouched (no LLM rewrite for a price check).
				if (isCostPreflight(input)) {
					if (typeof inlineExecute !== "function") {
						return platformToolError(
							`Tool "${toolName}" is not executable on this server.`,
						);
					}

					return this.executeInlineConnectorTool({
						connectorSlug,
						input,
						invoke: (args) => Promise.resolve(inlineExecute(args, options)),
						options,
						parentEventId,
						subject,
						toolName,
					});
				}

				if (!env.TRIGGER_SECRET_KEY) {
					if (typeof inlineExecute !== "function") {
						return platformToolError(
							`Tool "${toolName}" is not executable on this server.`,
						);
					}

					return this.executeInlineConnectorTool({
						connectorSlug,
						input,
						invoke: (args) => Promise.resolve(inlineExecute(args, options)),
						options,
						parentEventId,
						subject,
						toolName,
					});
				}

				return this.queueBackgroundGeneration(
					subject,
					parentEventId,
					chatId,
					connectorSlug,
					toolName,
					input,
					options.toolCallId,
				);
			},
		} as Tool;
	}

	private async queueBackgroundGeneration(
		subject: MeteringSubject,
		parentEventId: string | undefined,
		chatId: string | null,
		connectorSlug: string,
		toolName: string,
		args: unknown,
		toolCallId: string,
	): Promise<Record<string, unknown>> {
		// Request idempotency: a duplicated delivery of this exact tool call
		// (same toolCallId) lands on the original attempt — one generation, one
		// reservation, one Trigger handoff. Without a chat the (chatId,
		// requestKey) index never conflicts and the Trigger key is the guard.
		const requestKey = createHash("sha256")
			.update(
				JSON.stringify({ args, connectorSlug, request: toolCallId, toolName }),
			)
			.digest("hex");
		const attempt = await this.connectorGenerationsRepository.insertAttempt({
			args: args !== null && typeof args === "object" ? args : {},
			chatId,
			connectorSlug,
			organizationId: subject.organizationId ?? null,
			requestKey,
			toolName,
			userId: subject.actorUserId,
		});

		if (!attempt.created && attempt.status === "failed") {
			return platformToolError(
				"This exact generation request already failed. Tell the user and " +
					"wait for a new request before retrying.",
			);
		}

		if (!attempt.created) {
			return {
				attemptId: attempt.id,
				connector: connectorSlug,
				kind: CONNECTOR_GENERATION_OUTPUT_KIND,
				note:
					"This generation request was already accepted. Its existing " +
					"progress or result card appears in the conversation — do not " +
					"start a second generation.",
				status: "queued",
				tool: toolName,
			};
		}

		const plan = connectorGenerationPlan(toolName, args, connectorSlug);
		if (!plan) {
			const error = new Error(
				`${connectorSlug}/${toolName} is not a registered connector generation`,
			);
			await this.markAttemptFailedWithoutMasking(attempt.id, error);
			throw error;
		}

		const billing = this.createGenerationBilling();
		let reservations: ConnectorGenerationReservations;

		try {
			reservations = await billing.reserve(subject, attempt.id, {
				...plan,
				parentEventId,
			});
		} catch (error) {
			await this.markAttemptFailedWithoutMasking(attempt.id, error);
			// Typed 402s deliberately escape tool execution unchanged.
			throw error;
		}

		// Reserve-before-refine: the refined arguments travel in the payload and
		// the task's claim persists them on the attempt row (the durable record
		// of what was sent). A refiner failure keeps the original arguments.
		const executeArgs = await this.refinePromptedGenerationArgs(
			subject,
			parentEventId,
			connectorSlug,
			toolName,
			args,
		);

		let handle: { id: string };

		try {
			handle = await triggerConnectorGenerationTask({
				args:
					executeArgs !== null && typeof executeArgs === "object"
						? (executeArgs as Record<string, unknown>)
						: undefined,
				attemptId: attempt.id,
				billing: reservations,
				billingMode: connectorBillingAdmissionMode(reservations),
				connectorSlug,
				userId: subject.actorUserId,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(
				`Trigger.dev did not confirm connector generation ${attempt.id}: ${message}`,
			);

			if (isDefinitiveTriggerRejection(error)) {
				let closed = false;

				try {
					closed = await this.connectorGenerationsRepository.markAttemptFailed(
						attempt.id,
						message,
					);
				} catch (markError) {
					Sentry.captureException(markError, {
						tags: { attemptId: attempt.id },
					});
				}

				if (closed) {
					await this.refundGenerationWithoutMasking(
						billing,
						subject,
						attempt.id,
						plan.childOperation,
						connectorSlug,
						toolName,
					);

					return platformToolError(
						`Starting the background generation was rejected by Trigger.dev: ${message}. Tell the user and offer to retry after the server configuration is fixed.`,
					);
				}
			}

			// The request may have been accepted even when its HTTP response was
			// lost. Preserve both queued row and holds; the global attempt-key makes
			// a same-request handoff retry safe and the stale sweep is the backstop.
			return {
				attemptId: attempt.id,
				connector: connectorSlug,
				kind: CONNECTOR_GENERATION_OUTPUT_KIND,
				note:
					"The generation request is saved, but the background handoff was " +
					"not confirmed. Its card will keep checking; do not start a second " +
					"generation unless the current attempt reaches a failed state.",
				status: "queued",
				tool: toolName,
			};
		}

		try {
			await this.connectorGenerationsRepository.markAttemptTriggered(
				attempt.id,
				handle.id,
			);
		} catch (error) {
			// The Trigger run owns the durable attempt now. Refunding here would
			// race live provider work; its task claim also writes triggerRunId.
			Sentry.captureException(error, {
				tags: {
					attemptId: attempt.id,
					connectorSlug,
					toolName,
				},
			});
			this.logger.warn(
				`Connector generation ${attempt.id} was triggered but its handle was not persisted`,
			);
		}

		return {
			attemptId: attempt.id,
			connector: connectorSlug,
			kind: CONNECTOR_GENERATION_OUTPUT_KIND,
			note:
				"Generation started in the background on the user's connected " +
				"account. Progress and the finished media render automatically " +
				"in the conversation — do NOT poll job_status and do NOT wait. " +
				"Confirm the launch to the user in one short sentence and end " +
				"your turn. In LATER turns the finished asset appears as a " +
				"[Generated image/video …] marker carrying its hosted URL — " +
				"reuse that URL directly (for pages: place it in the HTML); " +
				"never ask the user to attach media that was generated here.",
			realtime: await this.mintRealtimeHandle(handle.id),
			status: "queued",
			tool: toolName,
		};
	}

	private createGenerationBilling(): ConnectorGenerationBilling {
		return createConnectorGenerationBilling({
			isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
			meteringService: this.meteringService,
		});
	}

	private async refundGenerationWithoutMasking(
		billing: ConnectorGenerationBilling,
		subject: MeteringSubject,
		referenceId: string,
		childOperation: "image" | "video" | undefined,
		connectorSlug: string,
		toolName: string,
	): Promise<void> {
		try {
			await billing.refund(subject, referenceId, childOperation);
		} catch (error) {
			Sentry.captureException(error, {
				tags: { connectorSlug, referenceId, toolName },
			});
		}
	}

	private async markAttemptFailedWithoutMasking(
		attemptId: string,
		error: unknown,
	): Promise<void> {
		try {
			await this.connectorGenerationsRepository.markAttemptFailed(
				attemptId,
				error instanceof Error ? error.message : String(error),
			);
		} catch (markError) {
			Sentry.captureException(markError, { tags: { attemptId } });
		}
	}

	// Best-effort: an expired or missing token only costs the card its live
	// progress (it falls back to polling) — never fail the generation for it.
	private async mintRealtimeHandle(
		runId: string,
	): Promise<TriggerRealtimeHandle | undefined> {
		try {
			const publicAccessToken = await auth.createPublicToken({
				expirationTime: "2h",
				scopes: { read: { runs: [runId] } },
			});

			return { publicAccessToken, runId };
		} catch (error) {
			this.logger.warn(
				`Realtime token minting failed for run ${runId} — the chat card ` +
					`will poll instead: ${error instanceof Error ? error.message : String(error)}`,
			);

			return undefined;
		}
	}
}

async function triggerConnectorGenerationTask(input: {
	args?: Record<string, unknown>;
	attemptId: string;
	billing: ConnectorGenerationReservations;
	billingMode: "enforce" | "off";
	connectorSlug: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`connector-generation:${input.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof runConnectorGenerationTask>(
				"run-connector-generation",
				{
					...(input.args ? { args: input.args } : {}),
					attemptId: input.attemptId,
					billing: input.billing,
					billingMode: input.billingMode,
					userId: input.userId,
				},
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`connector-attempt:${input.attemptId}`,
						`connector:${input.connectorSlug}`,
					],
					// A generation that cannot START within 5 minutes expires instead
					// of running later: the repository's 35-minute stale-row janitor
					// can then safely close a stranded card.
					ttl: "5m",
				},
			);
		} catch (error) {
			lastError = error;

			if (isDefinitiveTriggerRejection(error)) {
				break;
			}

			if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
				await delay(100 * 2 ** attempt);
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Trigger.dev connector handoff failed");
}

function isDefinitiveTriggerRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const candidate = error as { name?: unknown; status?: unknown };

	return (
		candidate.name === "TriggerApiError" &&
		(candidate.status === 400 ||
			candidate.status === 401 ||
			candidate.status === 403 ||
			candidate.status === 404 ||
			candidate.status === 422)
	);
}

export async function withReadRetry<T>(fn: () => Promise<T>): Promise<T> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await fn();
		} catch (error) {
			const delay = READ_RETRY_DELAYS_MS[attempt];
			if (delay === undefined || !isTransientTransportError(error)) {
				throw error;
			}
			await wait(delay);
		}
	}
}

function hasStoredToken(
	connection: Pick<McpConnectionRow, "accessToken" | "refreshToken">,
): boolean {
	return Boolean(connection.accessToken || connection.refreshToken);
}

function catalogToolsFromDefinitions(
	definitions: ListToolsResult,
): McpCatalogTool[] {
	return definitions.tools
		.map((definition) => ({
			description: definition.description ?? "",
			inputSchema: definition.inputSchema,
			name: definition.name,
		}))
		.sort((left, right) => compareStrings(left.name, right.name));
}

function asListToolsResult(tools: McpCatalogTool[]): ListToolsResult {
	return {
		tools,
	};
}

function normalizeToolName(toolName: string): string {
	return normalizeConnectorToolName(toolName);
}

function connectorOperationFeature(
	connectorSlug: string,
	toolName: string,
): "ads_analysis" | "ads_launch" | "other" {
	if (connectorSlug !== "meta-ads" && connectorSlug !== "tiktok-ads") {
		return "other";
	}

	return classifyToolName(toolName) === "write" ? "ads_launch" : "ads_analysis";
}

function classifyNestedToolName(input: unknown): "read" | "write" {
	const nestedToolName = readStringProperty(input, "tool_name");
	return nestedToolName ? classifyToolName(nestedToolName) : "write";
}

function classifyWrappedToolApproval(
	input: unknown,
): "not-applicable" | "user-approval" {
	return classifyNestedToolName(input) === "read"
		? "not-applicable"
		: "user-approval";
}

// Generic wrapper (tool_execute) on an ads connector: the nested tool name
// plus its params decide under the money-based policy. A wrapper call whose
// nested name is missing, or whose params are an unparseable string, stays
// on the safe side — a JSON-string params the gateway would happily parse
// must not blind the status/budget walk.
function classifyAdsWrappedToolApproval(
	connectorSlug: string,
	input: unknown,
): "not-applicable" | "user-approval" {
	const nestedToolName = readStringProperty(input, "tool_name");

	if (!nestedToolName) {
		return "user-approval";
	}

	const args = wrappedToolArgs(input);

	if (args === null) {
		return "user-approval";
	}

	return classifyAdsToolApproval(connectorSlug, nestedToolName, args);
}

// tool_execute nests the provider arguments under `params` (object or JSON
// string); scanning the unwrapped object keeps the status/budget walk at
// the same depth as a direct catalog call. Returns null for a string params
// that does not parse — the caller fails closed.
function wrappedToolArgs(input: unknown): unknown {
	if (typeof input !== "object" || input === null) {
		return input;
	}

	const record = input as Record<string, unknown>;

	if (typeof record.params === "object" && record.params !== null) {
		return record.params;
	}

	if (typeof record.params === "string") {
		return tryParseJsonRecord(record.params);
	}

	return input;
}

function classifyPlatformToolApproval(
	input: unknown,
): "not-applicable" | "user-approval" {
	const parsed = runPlatformToolInputSchema.safeParse(input);
	if (!parsed.success) {
		return "user-approval";
	}

	const { connector, tool_name: nestedToolName } = parsed.data;
	const autoTools = CONNECTOR_TOOL_OVERRIDES[connector]?.autoTools ?? [];
	if (autoTools.includes(normalizeToolName(nestedToolName))) {
		return "not-applicable";
	}

	const autoApproveTools =
		CONNECTOR_TOOL_OVERRIDES[connector]?.autoApproveTools ?? [];
	if (autoApproveTools.includes(normalizeToolName(nestedToolName))) {
		return "not-applicable";
	}

	if (isAdsApprovalConnector(connector)) {
		return classifyAdsToolApproval(
			connector,
			nestedToolName,
			parsed.data.params,
		);
	}

	return classifyToolName(nestedToolName) === "read"
		? "not-applicable"
		: "user-approval";
}

function requiresApproval(connector: string, toolName: string): boolean {
	const autoTools = CONNECTOR_TOOL_OVERRIDES[connector]?.autoTools ?? [];
	const autoApproveTools =
		CONNECTOR_TOOL_OVERRIDES[connector]?.autoApproveTools ?? [];
	const normalizedToolName = normalizeToolName(toolName);

	if (
		autoTools.includes(normalizedToolName) ||
		autoApproveTools.includes(normalizedToolName)
	) {
		return false;
	}

	// Catalog hint only (no arguments yet): under the money-based ads policy
	// a create shown as approval-needed still runs free when called with an
	// explicit paused status — the call-time classifier has the final word.
	if (isAdsApprovalConnector(connector)) {
		return (
			classifyAdsToolApproval(connector, toolName, undefined) ===
			"user-approval"
		);
	}

	return classifyToolName(toolName) === "write";
}

async function callMcpTool(
	client: MCPClient,
	name: string,
	argumentsValue: Record<string, unknown>,
	options: ToolExecutionOptions<unknown>,
	retry: boolean,
) {
	const invoke = () =>
		client.callTool({
			arguments: argumentsValue,
			name,
			...(options.abortSignal
				? { options: { signal: options.abortSignal } }
				: {}),
		});

	return retry ? withReadRetry(invoke) : invoke();
}

function isTransientTransportError(error: unknown): boolean {
	let current: unknown = error;

	for (let depth = 0; depth < 4 && current; depth += 1) {
		if (typeof current !== "object") {
			return false;
		}

		const record = current as Record<string, unknown>;
		const status =
			typeof record.statusCode === "number"
				? record.statusCode
				: typeof record.status === "number"
					? record.status
					: undefined;
		if (status !== undefined && status >= 500 && status <= 599) {
			return true;
		}

		if (
			typeof record.code === "string" &&
			["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(record.code)
		) {
			return true;
		}

		if (
			typeof record.message === "string" &&
			record.message.toLowerCase().includes("fetch failed")
		) {
			return true;
		}

		current = record.cause;
	}

	return false;
}

function isDeadSessionError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"statusCode" in error &&
		error.statusCode === 404
	);
}

function expiredSessionError(): Error & { statusCode: number } {
	return Object.assign(new Error("MCP session expired"), { statusCode: 404 });
}

function wait(delayMs: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, delayMs);
	});
}

/**
 * Platform-level failure inside a successful transport response, for Meta /
 * TikTok only: the first payload (content text JSON or the plain object) that
 * carries a TikTok non-zero code or a Meta error object.
 */
function adsPlatformFailure(
	connectorSlug: string,
	result: unknown,
): { errorCode: string | null; payload: unknown } | null {
	if (connectorSlug !== "meta-ads" && connectorSlug !== "tiktok-ads") {
		return null;
	}

	for (const payload of resultPayloads(result)) {
		const failure = adsPlatformError(connectorSlug, payload);
		if (failure) {
			return { errorCode: failure.errorCode, payload };
		}
	}

	return null;
}

function isMcpErrorResult(result: unknown): boolean {
	try {
		return (
			typeof result === "object" &&
			result !== null &&
			"isError" in result &&
			result.isError === true
		);
	} catch {
		return false;
	}
}

function assertFreshInlineConnectorReservations(
	reservations: ConnectorGenerationReservations,
): void {
	for (const reservation of [reservations.connector, reservations.child]) {
		if (!reservation || reservation.replay === "none") {
			continue;
		}

		throw new MeteringStateConflictError(
			reservation.eventId ?? reservation.referenceId,
			reservation.replay,
			"replay inline connector provider execution for",
		);
	}
}

function deliveredInlineConnectorChildUnits(
	childOperation: "image" | "video" | undefined,
	reservedUnits: number | undefined,
	result: unknown,
): number | undefined {
	if (childOperation === undefined) {
		return undefined;
	}

	if (childOperation === "video") {
		return 1;
	}

	const imageCount = extractMediaUrls(result).filter(
		(media) => media.kind === "image",
	).length;
	return Math.min(reservedUnits ?? 1, imageCount);
}

function platformToolError(message: string) {
	return {
		content: [{ text: message, type: "text" as const }],
		isError: true,
	};
}

function parseTikTokHiddenOperations(value: unknown): TikTokHiddenOperation[] {
	const operations = new Map<string, TikTokHiddenOperation>();

	walkJsonObjects(value, (record) => {
		const description =
			readStringProperty(record, "description") ??
			readStringProperty(record, "desc") ??
			readStringProperty(record, "summary") ??
			"";
		const explicitName = readStringProperty(record, "tool_name");
		const fallbackName = description && readStringProperty(record, "name");
		const name = explicitName || fallbackName;

		if (!name || TIKTOK_GATEWAY_TOOLS.has(name)) {
			return;
		}

		const existing = operations.get(name);
		if (!existing || description.length > existing.description.length) {
			operations.set(name, { description, name });
		}
	});

	return [...operations.values()].sort((left, right) =>
		compareStrings(left.name, right.name),
	);
}

function parseTikTokToolDetails(
	value: unknown,
	expectedName: string,
): { description: string; inputSchema?: unknown } {
	let fallbackDescription = "";
	let fallbackInputSchema: unknown;
	let matchedDescription = "";
	let matchedInputSchema: unknown;

	walkJsonObjects(value, (record) => {
		const recordName =
			readStringProperty(record, "tool_name") ??
			readStringProperty(record, "name");
		const description =
			readStringProperty(record, "description") ??
			readStringProperty(record, "desc") ??
			readStringProperty(record, "summary") ??
			"";
		const inputSchema =
			record.inputSchema ?? record.input_schema ?? record.parameters;

		if (!fallbackDescription && description) {
			fallbackDescription = description;
		}
		if (fallbackInputSchema === undefined && inputSchema !== undefined) {
			fallbackInputSchema = inputSchema;
		}

		if (recordName === expectedName) {
			if (description) {
				matchedDescription = description;
			}
			if (inputSchema !== undefined) {
				matchedInputSchema = inputSchema;
			}
		}
	});

	return {
		description: matchedDescription || fallbackDescription,
		...((matchedInputSchema ?? fallbackInputSchema) === undefined
			? {}
			: { inputSchema: matchedInputSchema ?? fallbackInputSchema }),
	};
}

function walkJsonObjects(
	value: unknown,
	visit: (record: Record<string, unknown>) => void,
	seen = new WeakSet<object>(),
): void {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				walkJsonObjects(JSON.parse(trimmed), visit, seen);
			} catch {
				// Non-JSON connector text is not part of the catalog.
			}
		}
		return;
	}

	if (!value || typeof value !== "object" || seen.has(value)) {
		return;
	}
	seen.add(value);

	if (Array.isArray(value)) {
		for (const item of value) {
			walkJsonObjects(item, visit, seen);
		}
		return;
	}

	const record = value as Record<string, unknown>;
	visit(record);
	for (const nestedValue of Object.values(record)) {
		walkJsonObjects(nestedValue, visit, seen);
	}
}

function rankCatalogEntries(
	entries: CatalogIndexEntry[],
	query: string,
	includeZeroScores: boolean,
): Array<{ entry: CatalogIndexEntry; score: number }> {
	const queryTokens = new Set(tokenize(query));

	return entries
		.map((entry) => {
			const nameTokens = new Set(tokenize(entry.name));
			const descriptionTokens = new Set(tokenize(entry.description));
			let score = 0;

			for (const token of queryTokens) {
				if (nameTokens.has(token)) {
					score += 3;
				}
				if (descriptionTokens.has(token)) {
					score += 1;
				}
			}

			return { entry, score };
		})
		.filter(({ score }) => includeZeroScores || score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				compareStrings(left.entry.connector, right.entry.connector) ||
				compareStrings(left.entry.name, right.entry.name),
		);
}

function tokenize(value: string): string[] {
	const normalized = normalizeToolName(value);
	return normalized ? normalized.split("_") : [];
}

function truncateDescription(description: string): string {
	return description.length <= PLATFORM_TOOL_SUMMARY_LENGTH
		? description
		: `${description.slice(0, PLATFORM_TOOL_SUMMARY_LENGTH - 3)}...`;
}

function readStringProperty(
	value: unknown,
	property: string,
): string | undefined {
	if (typeof value !== "object" || value === null || !(property in value)) {
		return undefined;
	}

	const candidate = (value as Record<string, unknown>)[property];
	return typeof candidate === "string" && candidate.trim()
		? candidate.trim()
		: undefined;
}

function namespaceToolName(slug: string, toolName: string): string {
	const namespacedName = `mcp_${slug}_${toolName}`
		.replace(/[^A-Za-z0-9_-]/g, "_")
		.slice(0, 128);

	if (!VALID_TOOL_NAME_PATTERN.test(namespacedName)) {
		throw new Error("MCP tool name could not be sanitized");
	}

	return namespacedName;
}

function compareRuntimes(
	left: ConnectorRuntimeContext,
	right: ConnectorRuntimeContext,
): number {
	return (
		compareStrings(left.connector.slug, right.connector.slug) ||
		compareStrings(left.connectionId, right.connectionId)
	);
}

function compareStrings(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sortedEntries<T>(record: Record<string, T>): Array<[string, T]> {
	return Object.entries(record).sort(([left], [right]) =>
		compareStrings(left, right),
	);
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
	return Object.fromEntries(sortedEntries(record));
}

function connectorNotice(
	connector: McpConnectorRow,
	reason: McpSkipReason,
): string {
	return `The user's ${connector.name} connection could not be used (${SKIP_REASON_TEXT[reason]}). ${SKIP_REASON_GUIDANCE[reason]}`;
}

function skippedConnector(
	connector: McpConnectorRow,
	reason: McpSkipReason,
): ConnectorToolResult {
	return {
		...emptyConnectorResult(),
		connector,
		notice: connectorNotice(connector, reason),
	};
}

function emptyConnectorResult(): ConnectorToolResult {
	return { approvalMap: {}, tools: {} };
}

function emptyResult(): McpChatToolsResult {
	return {
		approvalMap: {},
		close: async () => {},
		connectedSlugs: [],
		notices: [],
		tools: {},
	};
}
