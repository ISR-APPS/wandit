import {
	createMCPClient,
	type ListToolsResult,
	type MCPClient,
} from "@ai-sdk/mcp";
import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import { auth, tasks } from "@trigger.dev/sdk";
import {
	CONNECTOR_GENERATION_OUTPUT_KIND,
	type TriggerRealtimeHandle,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { dynamicTool, type Tool, type ToolExecutionOptions } from "ai";
import { z } from "zod";

// Type-only import: pulling the task VALUE here would drag the Trigger task
// (and its DB pool) into the Nest process.
import type { runConnectorGenerationTask } from "../../../../trigger/run-connector-generation.task";
import { ConnectorGenerationsRepository } from "../../../connector-generations/infrastructure/persistence/connector-generations.repository";
import {
	type McpToolApprovalMap,
	mcpToolPolicySchema,
} from "../../domain/mcp-tool-policy";
import type { McpConnectionRow } from "../../infrastructure/persistence/mcp-connections.repository";
import { McpConnectionsRepository } from "../../infrastructure/persistence/mcp-connections.repository";
import type { McpConnectorRow } from "../../infrastructure/persistence/mcp-connectors.repository";
import { McpConnectorsRepository } from "../../infrastructure/persistence/mcp-connectors.repository";
import { McpConnectionsService } from "./mcp-connections.service";
import {
	type McpCatalogTool,
	McpRuntimeCacheService,
	type McpRuntimeSession,
	type TikTokHiddenOperation,
} from "./mcp-runtime-cache.service";

const MCP_CONNECT_TIMEOUT_MS = 10_000;
const READ_RETRY_DELAYS_MS = [250, 1_000] as const;
const VALID_TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PLATFORM_TOOL_RESULT_LIMIT = 12;
const PLATFORM_TOOL_SUMMARY_LENGTH = 160;
const TIKTOK_GATEWAY_TOOLS = new Set(["tool_execute", "tool_get", "tool_list"]);
const WRITE_VERBS = new Set([
	"create",
	"update",
	"delete",
	"remove",
	"add",
	"set",
	"activate",
	"deactivate",
	"pause",
	"resume",
	"enable",
	"disable",
	"publish",
	"deploy",
	"boost",
	"schedule",
	"send",
	"upload",
	"buy",
	"purchase",
	"confirm",
	"cancel",
	"subscribe",
	"launch",
	"connect",
	"disconnect",
	"sync",
	"rename",
	"import",
	"invoke",
	"exec",
	"execute",
	"participate",
]);
const READ_VERBS = new Set([
	"get",
	"list",
	"search",
	"read",
	"fetch",
	"query",
	"describe",
	"show",
	"check",
	"count",
	"view",
	"retrieve",
	"download",
	"export",
	"report",
	"preview",
	"status",
	"health",
	"explore",
	"insights",
	"balance",
	"transactions",
	"reveal",
	"display",
]);
const GENERIC_WRAPPER_TOOLS = new Set(["tool_execute"]);

// Connector tools whose provider call runs for MINUTES (video generation…):
// executing them inline would block the chat stream and die on the API
// process's 5-minute undici ceiling. They are intercepted and replayed by
// the run-connector-generation Trigger.dev task instead; the chat card
// follows the run over Realtime. Names are normalized (normalizeToolName).
const BACKGROUND_GENERATION_TOOLS: Record<string, Set<string>> = {
	higgsfield: new Set(["generate_video"]),
};

function isBackgroundGenerationTool(slug: string, toolName: string): boolean {
	return (
		BACKGROUND_GENERATION_TOOLS[slug]?.has(normalizeToolName(toolName)) ?? false
	);
}
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
const CONNECTOR_TOOL_OVERRIDES: Record<
	string,
	{ autoTools: readonly string[] }
> = {
	higgsfield: {
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
		"Tell the user to reconnect it in Settings → Connectors if they ask for it.",
	unreachable:
		"Tell the user it is temporarily unavailable and to try again later if they ask for it.",
};

export type McpChatToolsResult = {
	approvalMap: McpToolApprovalMap;
	close: () => Promise<void>;
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

	constructor(
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
	) {}

	async resolveToolsForUser(userId: string): Promise<McpChatToolsResult> {
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
						userId,
						connection,
						connector,
						registerCloser,
					);
				} catch {
					return skippedConnector(connector, "unreachable");
				}
			}),
		);
		const tools: Record<string, Tool> = {};
		const approvalMap: McpToolApprovalMap = {};
		const notices: string[] = [];
		const runtimes: ConnectorRuntimeContext[] = [];

		for (const result of connectorResults) {
			let hasNameCollision = false;

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
			Object.assign(tools, this.createDiscoveryDoors(userId, runtimes));
			approvalMap.run_platform_tool = classifyPlatformToolApproval;
		}

		return {
			approvalMap: sortRecord(approvalMap),
			close: async () => {
				await Promise.all(closers.map((close) => close()));
			},
			notices,
			tools: sortRecord(tools),
		};
	}

	private async resolveConnectorTools(
		userId: string,
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
				userId,
				connector.slug,
			);
		} catch (error) {
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
		} catch {
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
						userId,
						connector.slug,
						toolName,
					)
				: wrapToolWithReadRetry(tool, toolName);

			const normalizedToolName = normalizeToolName(toolName);
			const autoTools =
				CONNECTOR_TOOL_OVERRIDES[connector.slug]?.autoTools ?? [];

			if (autoTools.includes(normalizedToolName)) {
				continue;
			}

			if (GENERIC_WRAPPER_TOOLS.has(normalizedToolName)) {
				approvalMap[namespacedName] = classifyWrappedToolApproval;
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
		userId: string,
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
						userId,
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
		userId: string,
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
				return this.queueBackgroundGeneration(
					userId,
					runtime.connector.slug,
					canonical.name,
					input.params,
				);
			}
		}

		const catalogTool = catalog.find((tool) => tool.name === input.tool_name);
		if (catalogTool) {
			return callMcpTool(
				runtime.client,
				catalogTool.name,
				input.params,
				options,
				classifyToolName(catalogTool.name) === "read",
			);
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
				return callMcpTool(
					runtime.client,
					"tool_execute",
					{
						params: input.params,
						tool_name: hiddenOperation.name,
					},
					options,
					classifyToolName(hiddenOperation.name) === "read",
				);
			}
		}

		return platformToolError(
			`Tool "${input.tool_name}" is not available on ${runtime.connector.slug}. Search the catalog again for the canonical name.`,
		);
	}

	// Same schema and description as the provider tool, but execute queues a
	// durable attempt + Trigger.dev run instead of blocking the chat stream.
	// Without a Trigger key the legacy inline call is kept — degraded but
	// functional, exactly like the other queue-backed tools.
	private wrapBackgroundGenerationTool(
		tool: Tool,
		userId: string,
		connectorSlug: string,
		toolName: string,
	): Tool {
		const executable = tool as Tool & { execute?: UnknownToolExecute };
		const inlineExecute = executable.execute;

		return {
			...executable,
			execute: async (input, options) => {
				if (!env.TRIGGER_SECRET_KEY) {
					return typeof inlineExecute === "function"
						? inlineExecute(input, options)
						: platformToolError(
								`Tool "${toolName}" is not executable on this server.`,
							);
				}

				return this.queueBackgroundGeneration(
					userId,
					connectorSlug,
					toolName,
					input,
				);
			},
		} as Tool;
	}

	private async queueBackgroundGeneration(
		userId: string,
		connectorSlug: string,
		toolName: string,
		args: unknown,
	): Promise<Record<string, unknown>> {
		const attempt = await this.connectorGenerationsRepository.insertAttempt({
			args: args !== null && typeof args === "object" ? args : {},
			connectorSlug,
			toolName,
			userId,
		});

		try {
			const handle = await tasks.trigger<typeof runConnectorGenerationTask>(
				"run-connector-generation",
				{ attemptId: attempt.id },
				// A generation that cannot START within 5 minutes expires instead
				// of running later: the repository's stale-row janitor assumes
				// "created 35 min ago and still not settled" cannot be live.
				{ ttl: "5m" },
			);
			await this.connectorGenerationsRepository.markAttemptTriggered(
				attempt.id,
				handle.id,
			);

			return {
				attemptId: attempt.id,
				connector: connectorSlug,
				kind: CONNECTOR_GENERATION_OUTPUT_KIND,
				note:
					"Generation started in the background on the user's connected " +
					"account. Progress and the finished media render automatically " +
					"in the conversation — do NOT poll job_status and do NOT wait. " +
					"Confirm the launch to the user in one short sentence and end " +
					"your turn.",
				realtime: await this.mintRealtimeHandle(handle.id),
				status: "queued",
				tool: toolName,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.connectorGenerationsRepository.markAttemptFailed(
				attempt.id,
				message,
			);

			return platformToolError(
				`Starting the background generation failed on the server: ${message}. Tell the user and offer to retry.`,
			);
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

function wrapToolWithReadRetry(tool: Tool, toolName: string): Tool {
	const executable = tool as Tool & { execute?: UnknownToolExecute };
	if (typeof executable.execute !== "function") {
		return tool;
	}

	const execute = executable.execute;
	return {
		...executable,
		execute: (input, options) => {
			const shouldRetry = GENERIC_WRAPPER_TOOLS.has(normalizeToolName(toolName))
				? classifyNestedToolName(input) === "read"
				: classifyToolName(toolName) === "read";
			const invoke = () => Promise.resolve(execute(input, options));

			return shouldRetry ? withReadRetry(invoke) : invoke();
		},
	} as Tool;
}

function normalizeToolName(toolName: string): string {
	return toolName
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
}

function classifyToolName(toolName: string): "read" | "write" {
	const normalizedName = normalizeToolName(toolName);
	const tokens = normalizedName ? normalizedName.split("_") : [];

	if (tokens.some((token) => WRITE_VERBS.has(token))) {
		return "write";
	}

	return tokens.some((token) => READ_VERBS.has(token)) ? "read" : "write";
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

	return classifyToolName(nestedToolName) === "read"
		? "not-applicable"
		: "user-approval";
}

function requiresApproval(connector: string, toolName: string): boolean {
	const autoTools = CONNECTOR_TOOL_OVERRIDES[connector]?.autoTools ?? [];
	return (
		!autoTools.includes(normalizeToolName(toolName)) &&
		classifyToolName(toolName) === "write"
	);
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

function isMcpErrorResult(result: unknown): boolean {
	return (
		typeof result === "object" &&
		result !== null &&
		"isError" in result &&
		result.isError === true
	);
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
		notices: [],
		tools: {},
	};
}
