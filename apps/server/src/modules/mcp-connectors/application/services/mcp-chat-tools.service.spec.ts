import {
	createMCPClient,
	type InitializeResult,
	type ListToolsResult,
	type MCPClient,
} from "@ai-sdk/mcp";
import { ConflictException, Logger } from "@nestjs/common";
import type { Tool, ToolExecutionOptions } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/mcp", () => ({
	createMCPClient: vi.fn(),
}));

import type { ConnectorGenerationsRepository } from "../../../connector-generations/infrastructure/persistence/connector-generations.repository";
import type {
	McpConnectionRow,
	McpConnectionsRepository,
} from "../../infrastructure/persistence/mcp-connections.repository";
import type {
	McpConnectorRow,
	McpConnectorsRepository,
} from "../../infrastructure/persistence/mcp-connectors.repository";
import { McpChatToolsService } from "./mcp-chat-tools.service";
import type { McpConnectionsService } from "./mcp-connections.service";
import { McpRuntimeCacheService } from "./mcp-runtime-cache.service";

const NOW = new Date("2026-07-29T12:00:00.000Z");
const USER_ID = "user-1";
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTOR_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_CONNECTION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_CONNECTOR_ID = "44444444-4444-4444-8444-444444444444";
const GENERATION_ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const INITIALIZE_RESULT: InitializeResult = {
	capabilities: {},
	protocolVersion: "2025-11-25",
	serverInfo: {
		name: "test-mcp-server",
		version: "1.0.0",
	},
};
const TOOL_EXECUTION_OPTIONS = {} as ToolExecutionOptions<unknown>;
const DISCOVERY_DOORS = [
	"describe_platform_tool",
	"run_platform_tool",
	"search_platform_tools",
] as const;

type CapturedCreateOptions = {
	initialInitializeResult?: InitializeResult;
	maxRetries?: number;
	transport: {
		headers?: Record<string, string>;
		initialProtocolVersion?: string;
		initialSessionId?: string;
		onSessionExpired?: (sessionId: string) => void;
		onSessionIdChange?: (sessionId: string | undefined) => void;
		terminateSessionOnClose?: boolean;
		type: string;
		url: string;
	};
};

type MockMcpClient = {
	callTool: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	initializeResult: InitializeResult;
	listTools: ReturnType<typeof vi.fn>;
	toolsFromDefinitions: ReturnType<typeof vi.fn>;
};

type SearchResult = {
	connector: string;
	requires_approval: boolean;
	summary: string;
	tool_name: string;
};

function connection(
	overrides: Partial<McpConnectionRow> = {},
): McpConnectionRow {
	return {
		accessToken: "encrypted-access-token",
		accessTokenExpiresAt: new Date(NOW.getTime() + 3_600_000),
		clientInfo: null,
		codeVerifier: null,
		connectedAt: NOW,
		connectorId: CONNECTOR_ID,
		createdAt: NOW,
		id: CONNECTION_ID,
		oauthState: null,
		refreshToken: null,
		returnUrl: null,
		scope: null,
		updatedAt: NOW,
		userId: USER_ID,
		...overrides,
	};
}

function connector(overrides: Partial<McpConnectorRow> = {}): McpConnectorRow {
	return {
		authorizationUrl: null,
		authKind: "mcp_dcr",
		createdAt: NOW,
		description: "Meta advertising tools",
		enabled: true,
		iconUrl: null,
		id: CONNECTOR_ID,
		mcpServerUrl: "https://mcp.example.com/mcp",
		name: "Meta Ads",
		scopes: null,
		slug: "meta-ads",
		sortOrder: 0,
		tokenUrl: null,
		toolPolicy: null,
		updatedAt: NOW,
		...overrides,
	};
}

function definition(
	name: string,
	overrides: Partial<ListToolsResult["tools"][number]> = {},
): ListToolsResult["tools"][number] {
	return {
		description: `Description for ${name}`,
		inputSchema: {
			properties: {},
			type: "object",
		},
		name,
		...overrides,
	};
}

function staticTool(marker = "tool"): Tool {
	return {
		type: "dynamic",
		marker,
	} as unknown as Tool;
}

function executableTool(
	execute: (input: unknown) => unknown = () => ({ ok: true }),
): Tool {
	return {
		execute: vi.fn(execute),
		type: "dynamic",
	} as unknown as Tool;
}

function mockClient({
	callTool,
	definitions = [],
	initializeResult = INITIALIZE_RESULT,
	toolImplementations = {},
}: {
	callTool?: (input: unknown) => unknown;
	definitions?: ListToolsResult["tools"];
	initializeResult?: InitializeResult;
	toolImplementations?: Record<string, Tool>;
} = {}): MockMcpClient {
	const client: MockMcpClient = {
		callTool: vi.fn(
			callTool ??
				(() => ({
					content: [{ text: "ok", type: "text" }],
				})),
		),
		close: vi.fn().mockResolvedValue(undefined),
		initializeResult,
		listTools: vi.fn().mockResolvedValue({ tools: definitions }),
		toolsFromDefinitions: vi.fn((result: ListToolsResult) =>
			Object.fromEntries(
				result.tools.map((toolDefinition) => [
					toolDefinition.name,
					toolImplementations[toolDefinition.name] ??
						staticTool(toolDefinition.name),
				]),
			),
		),
	};

	return client;
}

function queueClient(
	client: MockMcpClient,
	{
		onCreate,
		sessionId,
	}: {
		onCreate?: (options: CapturedCreateOptions) => void;
		sessionId?: string;
	} = {},
): void {
	vi.mocked(createMCPClient).mockImplementationOnce(async (rawOptions) => {
		const options = rawOptions as unknown as CapturedCreateOptions;
		onCreate?.(options);
		if (sessionId !== undefined) {
			options.transport.onSessionIdChange?.(sessionId);
		}
		return client as unknown as MCPClient;
	});
}

function buildService({
	connections = [connection()],
	connectors = [connector()],
	runtimeCache = new McpRuntimeCacheService(),
}: {
	connections?: McpConnectionRow[];
	connectors?: McpConnectorRow[];
	runtimeCache?: McpRuntimeCacheService;
} = {}) {
	const connectionsRepository = {
		listByUser: vi.fn().mockResolvedValue(connections),
	};
	const connectorsRepository = {
		listEnabled: vi.fn().mockResolvedValue(connectors),
	};
	const connectionsService = {
		getValidAccessToken: vi.fn().mockResolvedValue("plain-access-token"),
	};
	const connectorGenerationsRepository = {
		insertAttempt: vi.fn().mockResolvedValue({ id: GENERATION_ATTEMPT_ID }),
		markAttemptFailed: vi.fn().mockResolvedValue(undefined),
		markAttemptTriggered: vi.fn().mockResolvedValue(undefined),
	};
	const service = new McpChatToolsService(
		connectionsRepository as unknown as McpConnectionsRepository,
		connectorsRepository as unknown as McpConnectorsRepository,
		connectionsService as unknown as McpConnectionsService,
		runtimeCache,
		connectorGenerationsRepository as unknown as ConnectorGenerationsRepository,
	);

	return {
		connectionsRepository,
		connectionsService,
		connectorGenerationsRepository,
		connectorsRepository,
		runtimeCache,
		service,
	};
}

async function executeTool(tool: Tool, input: unknown): Promise<unknown> {
	const execute = (
		tool as Tool & {
			execute?: (
				input: unknown,
				options: ToolExecutionOptions<unknown>,
			) => unknown;
		}
	).execute;

	if (!execute) {
		throw new Error("Expected an executable tool");
	}

	return execute(input, TOOL_EXECUTION_OPTIONS);
}

function requiredTool(tools: Record<string, Tool>, name: string): Tool {
	const tool = tools[name];
	if (!tool) {
		throw new Error(`Expected tool "${name}" to be registered`);
	}

	return tool;
}

function searchResults(value: unknown): SearchResult[] {
	if (
		typeof value !== "object" ||
		value === null ||
		!("tools" in value) ||
		!Array.isArray(value.tools)
	) {
		throw new Error("Expected a platform tool search response");
	}

	return value.tools as SearchResult[];
}

function transientError(
	overrides: Record<string, unknown> = {},
): Error & Record<string, unknown> {
	return Object.assign(new Error("fetch failed"), overrides);
}

function tiktokToolListResult() {
	return {
		content: [
			{
				text: JSON.stringify({
					data: {
						groups: [
							{
								operations: [
									{
										description:
											"Create a TikTok advertising campaign with budget settings",
										tool_name: "campaign_create",
									},
									{
										description: "List campaign targeting options",
										name: "campaign_targeting_list",
									},
									{
										description: "Internal gateway plumbing",
										tool_name: "tool_execute",
									},
								],
							},
						],
					},
				}),
				type: "text",
			},
		],
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});

	return { promise, reject, resolve };
}

describe("McpChatToolsService.resolveToolsForUser", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("connection setup and existing behavior", () => {
		it("short-circuits with no tools or discovery doors when the user has no connections", async () => {
			const {
				connectionsRepository,
				connectionsService,
				connectorsRepository,
				service,
			} = buildService({ connections: [] });

			const result = await service.resolveToolsForUser(USER_ID);

			expect(connectionsRepository.listByUser).toHaveBeenCalledWith(USER_ID);
			expect(connectorsRepository.listEnabled).not.toHaveBeenCalled();
			expect(connectionsService.getValidAccessToken).not.toHaveBeenCalled();
			expect(createMCPClient).not.toHaveBeenCalled();
			expect(result).toMatchObject({
				approvalMap: {},
				notices: [],
				tools: {},
			});
			await expect(result.close()).resolves.toBeUndefined();
		});

		it("reports token transport failures without exposing secret error text", async () => {
			const { connectionsService, service } = buildService();
			connectionsService.getValidAccessToken.mockRejectedValue(
				new Error("invalid bearer secret-provider-token"),
			);

			const result = await service.resolveToolsForUser(USER_ID);

			expect(createMCPClient).not.toHaveBeenCalled();
			expect(result.tools).toEqual({});
			expect(result.approvalMap).toEqual({});
			expect(result.notices).toEqual([
				"The user's Meta Ads connection could not be used (connector unreachable). Tell the user it is temporarily unavailable and to try again later if they ask for it.",
			]);
			expect(result.notices.join(" ")).not.toContain("secret-provider-token");
		});

		it("requires reconnect only for a rejected token refresh", async () => {
			const { connectionsService, service } = buildService();
			connectionsService.getValidAccessToken.mockRejectedValue(
				new ConflictException("refresh rejected"),
			);

			const result = await service.resolveToolsForUser(USER_ID);

			expect(createMCPClient).not.toHaveBeenCalled();
			expect(result.notices).toEqual([
				"The user's Meta Ads connection could not be used (reconnect required). Tell the user to reconnect it in Settings → Connectors if they ask for it.",
			]);
		});

		it("fails closed when a non-null tool policy is malformed", async () => {
			const loggerWarn = vi
				.spyOn(Logger.prototype, "warn")
				.mockImplementation(() => undefined);
			const { connectionsService, service } = buildService({
				connectors: [
					connector({
						toolPolicy: {
							allowList: ["ads_get_ad_accounts"],
							secret: "raw-policy-value",
						},
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(connectionsService.getValidAccessToken).not.toHaveBeenCalled();
			expect(createMCPClient).not.toHaveBeenCalled();
			expect(result.tools).toEqual({});
			expect(result.approvalMap).toEqual({});
			expect(result.notices).toEqual([
				"The user's Meta Ads connection could not be used (invalid tool policy). Tell the user that its connector configuration must be fixed by an administrator if they ask for it.",
			]);
			expect(loggerWarn).toHaveBeenCalledWith(
				"Invalid MCP tool policy for connector meta-ads; skipping connector",
			);
			expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(
				"raw-policy-value",
			);
		});

		it("keeps the first tool when sanitized names collide within a connector", async () => {
			const firstTool = staticTool("first");
			const laterTool = staticTool("later");
			const client = mockClient({
				definitions: [definition("get.campaigns"), definition("get_campaigns")],
				toolImplementations: {
					"get.campaigns": firstTool,
					get_campaigns: laterTool,
				},
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ name: "Future", slug: "future-connector" })],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools["mcp_future-connector_get_campaigns"]).toBe(
				firstTool,
			);
			expect(result.tools["mcp_future-connector_get_campaigns"]).not.toBe(
				laterTool,
			);
			expect(result.notices).toEqual([
				"The user's Future connection could not be used (tool name collision). Tell the user that some connector tools were skipped because their names conflict if they ask for them.",
			]);
		});

		it("keeps the first tool when names collide across connector namespaces", async () => {
			const firstTool = staticTool("first");
			const laterTool = staticTool("later");
			queueClient(
				mockClient({
					definitions: [definition("get_campaigns")],
					toolImplementations: { get_campaigns: firstTool },
				}),
			);
			queueClient(
				mockClient({
					definitions: [definition("get_campaigns")],
					toolImplementations: { get_campaigns: laterTool },
				}),
			);
			const { service } = buildService({
				connections: [
					connection(),
					connection({
						connectorId: OTHER_CONNECTOR_ID,
						id: OTHER_CONNECTION_ID,
					}),
				],
				connectors: [
					connector({ name: "First", slug: "future.ads" }),
					connector({
						id: OTHER_CONNECTOR_ID,
						name: "Later",
						slug: "future_ads",
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools.mcp_future_ads_get_campaigns).toBe(firstTool);
			expect(result.tools.mcp_future_ads_get_campaigns).not.toBe(laterTool);
			expect(result.notices).toEqual([
				"The user's Later connection could not be used (tool name collision). Tell the user that some connector tools were skipped because their names conflict if they ask for them.",
			]);
		});

		it("preserves fail-closed approval classification and Higgsfield autoTools", async () => {
			const names = [
				"ads_get_ad_accounts",
				"get_and_delete_campaign",
				"frobnicate_widget",
			];
			queueClient(
				mockClient({ definitions: names.map((name) => definition(name)) }),
			);
			const meta = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: names },
					}),
				],
			});

			const metaResult = await meta.service.resolveToolsForUser(USER_ID);

			expect(metaResult.approvalMap).toMatchObject({
				"mcp_meta-ads_frobnicate_widget": "user-approval",
				"mcp_meta-ads_get_and_delete_campaign": "user-approval",
			});
			expect(metaResult.approvalMap).not.toHaveProperty(
				"mcp_meta-ads_ads_get_ad_accounts",
			);

			queueClient(
				mockClient({
					definitions: [
						definition("generate_video"),
						definition("publish_website"),
					],
				}),
			);
			const higgsfield = buildService({
				connectors: [
					connector({
						slug: "higgsfield",
						toolPolicy: {
							allowlist: ["generate_video", "publish_website"],
						},
					}),
				],
			});

			const higgsfieldResult =
				await higgsfield.service.resolveToolsForUser(USER_ID);

			expect(higgsfieldResult.approvalMap).toMatchObject({
				mcp_higgsfield_publish_website: "user-approval",
			});
			expect(higgsfieldResult.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_generate_video",
			);
		});
	});

	describe("visibility and registration", () => {
		it("uses the connector's default visible set without dropping the full catalog", async () => {
			const visible = staticTool("visible");
			const nonVisible = staticTool("non-visible");
			queueClient(
				mockClient({
					definitions: [
						definition("ads_campaign_create"),
						definition("ads_get_ad_accounts"),
					],
					toolImplementations: {
						ads_campaign_create: nonVisible,
						ads_get_ad_accounts: visible,
					},
				}),
			);
			const { service } = buildService();

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools["mcp_meta-ads_ads_get_ad_accounts"]).toBe(visible);
			expect(result.tools).not.toHaveProperty(
				"mcp_meta-ads_ads_campaign_create",
			);
			expect(Object.keys(result.tools)).toEqual([
				"describe_platform_tool",
				"mcp_meta-ads_ads_get_ad_accounts",
				"run_platform_tool",
				"search_platform_tools",
			]);
		});

		it("lets a non-empty DB allowlist override defaults while keeping other tools searchable", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("ads_get_ad_accounts"),
						definition("campaign_budget_update", {
							description: "Update a campaign advertising budget",
						}),
					],
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: ["campaign_budget_update"] },
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools).toHaveProperty(
				"mcp_meta-ads_campaign_budget_update",
			);
			expect(result.tools).not.toHaveProperty(
				"mcp_meta-ads_ads_get_ad_accounts",
			);

			const search = await executeTool(
				requiredTool(result.tools, "search_platform_tools"),
				{
					connector: "meta-ads",
					query: "ad accounts",
				},
			);

			expect(searchResults(search)).toContainEqual(
				expect.objectContaining({
					connector: "meta-ads",
					tool_name: "ads_get_ad_accounts",
				}),
			);
		});

		it("treats an empty DB allowlist as the default visible set", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("ads_campaign_create"),
						definition("ads_get_ad_accounts"),
					],
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: [] },
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools).toHaveProperty("mcp_meta-ads_ads_get_ad_accounts");
			expect(result.tools).not.toHaveProperty(
				"mcp_meta-ads_ads_campaign_create",
			);
		});

		it("keeps TikTok list/get plumbing internal under an explicit allowlist", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("tool_execute"),
						definition("tool_get"),
						definition("tool_list"),
					],
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						slug: "tiktok-ads",
						toolPolicy: {
							allowlist: ["tool_execute", "tool_get", "tool_list"],
						},
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools).toHaveProperty("mcp_tiktok-ads_tool_execute");
			expect(result.tools).not.toHaveProperty("mcp_tiktok-ads_tool_get");
			expect(result.tools).not.toHaveProperty("mcp_tiktok-ads_tool_list");
		});

		it("exposes every tool for an unknown connector slug", async () => {
			queueClient(
				mockClient({
					definitions: [definition("alpha_get"), definition("omega_create")],
				}),
			);
			const { service } = buildService({
				connectors: [connector({ name: "Future", slug: "future-connector" })],
			});

			const result = await service.resolveToolsForUser(USER_ID);

			expect(result.tools).toHaveProperty("mcp_future-connector_alpha_get");
			expect(result.tools).toHaveProperty("mcp_future-connector_omega_create");
		});

		it("registers the three discovery doors exactly once with multiple connectors", async () => {
			queueClient(mockClient({ definitions: [definition("alpha_get")] }));
			queueClient(mockClient({ definitions: [definition("beta_get")] }));
			const { service } = buildService({
				connections: [
					connection(),
					connection({
						connectorId: OTHER_CONNECTOR_ID,
						id: OTHER_CONNECTION_ID,
					}),
				],
				connectors: [
					connector({ slug: "future-one" }),
					connector({
						id: OTHER_CONNECTOR_ID,
						name: "Future Two",
						slug: "future-two",
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);
			const names = Object.keys(result.tools);

			for (const door of DISCOVERY_DOORS) {
				expect(names.filter((name) => name === door)).toHaveLength(1);
			}
			expect(result.approvalMap.run_platform_tool).toBeTypeOf("function");
		});

		it("sorts every registered name deterministically after sanitizing and truncating", async () => {
			const longName = "x".repeat(180);
			queueClient(
				mockClient({
					definitions: [
						definition("zebra_get"),
						definition("alpha.get/summary"),
						definition(longName),
					],
				}),
			);
			const { service } = buildService({
				connectors: [connector({ slug: "future-connector" })],
			});

			const result = await service.resolveToolsForUser(USER_ID);
			const names = Object.keys(result.tools);

			expect(names).toEqual([...names].sort());
			expect(names).toContain("mcp_future-connector_alpha_get_summary");
			expect(names).toContain(`mcp_future-connector_${longName}`.slice(0, 128));
			for (const name of names) {
				expect(name).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
			}
		});
	});

	describe("platform discovery doors", () => {
		it("searches the full direct catalog, ranks name matches, truncates summaries, and returns approval metadata", async () => {
			const longDescription = "x".repeat(220);
			queueClient(
				mockClient({
					definitions: [
						definition("campaign_create", {
							description: longDescription,
						}),
						definition("campaign_list", {
							description: "List all advertising campaigns",
						}),
						definition("unrelated_get", {
							description: "Campaign creation troubleshooting information",
						}),
					],
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: ["campaign_list"] },
					}),
				],
			});

			const result = await service.resolveToolsForUser(USER_ID);
			expect(result.tools).not.toHaveProperty("mcp_tiktok-ads_tool_execute");
			expect(result.tools).not.toHaveProperty("mcp_tiktok-ads_tool_get");
			expect(result.tools).not.toHaveProperty("mcp_tiktok-ads_tool_list");
			const search = await executeTool(
				requiredTool(result.tools, "search_platform_tools"),
				{
					query: "create campaign",
				},
			);
			const matches = searchResults(search);

			expect(matches[0]).toMatchObject({
				connector: "meta-ads",
				requires_approval: true,
				tool_name: "campaign_create",
			});
			expect(matches[0]?.summary).toHaveLength(160);
			expect(matches[0]?.summary.endsWith("...")).toBe(true);
			expect(matches.map((match) => match.tool_name)).toContain(
				"unrelated_get",
			);
			expect(search).toMatchObject({
				hint: expect.stringContaining("describe_platform_tool"),
			});
		});

		it("parses TikTok's hidden catalog lazily, scores campaign creation first, and excludes native gateway tools", async () => {
			const client = mockClient({
				callTool: (input) => {
					const call = input as { name: string };
					if (call.name === "tool_list") {
						return tiktokToolListResult();
					}
					throw new Error(`Unexpected tool call: ${call.name}`);
				},
				definitions: [
					definition("advertiser_info_get"),
					definition("tool_execute"),
					definition("tool_get"),
					definition("tool_list"),
				],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});

			const result = await service.resolveToolsForUser(USER_ID);
			const search = await executeTool(
				requiredTool(result.tools, "search_platform_tools"),
				{
					connector: "tiktok-ads",
					query: "create campaign tiktok",
				},
			);
			const matches = searchResults(search);

			expect(matches[0]).toMatchObject({
				connector: "tiktok-ads",
				requires_approval: true,
				tool_name: "campaign_create",
			});
			expect(matches.map((match) => match.tool_name)).not.toEqual(
				expect.arrayContaining(["tool_execute", "tool_get", "tool_list"]),
			);
			expect(client.callTool).toHaveBeenCalledWith({
				arguments: {},
				name: "tool_list",
			});

			await executeTool(requiredTool(result.tools, "search_platform_tools"), {
				connector: "tiktok-ads",
				query: "targeting list",
			});
			expect(client.callTool).toHaveBeenCalledTimes(1);
		});

		it("describes visible and non-visible direct tools from the full catalog", async () => {
			const visibleSchema = {
				properties: { account_id: { type: "string" } },
				required: ["account_id"],
				type: "object" as const,
			};
			const nonVisibleSchema = {
				properties: { name: { type: "string" } },
				required: ["name"],
				type: "object" as const,
			};
			queueClient(
				mockClient({
					definitions: [
						definition("ads_campaign_create", {
							description: "Create an ad campaign",
							inputSchema: nonVisibleSchema,
						}),
						definition("ads_get_ad_accounts", {
							description: "Get ad accounts",
							inputSchema: visibleSchema,
						}),
					],
				}),
			);
			const { service } = buildService();

			const result = await service.resolveToolsForUser(USER_ID);
			const visible = await executeTool(
				requiredTool(result.tools, "describe_platform_tool"),
				{
					connector: "meta-ads",
					tool_name: "ads_get_ad_accounts",
				},
			);
			const nonVisible = await executeTool(
				requiredTool(result.tools, "describe_platform_tool"),
				{
					connector: "meta-ads",
					tool_name: "ads_campaign_create",
				},
			);

			expect(visible).toEqual({
				connector: "meta-ads",
				description: "Get ad accounts",
				inputSchema: visibleSchema,
				tool_name: "ads_get_ad_accounts",
			});
			expect(nonVisible).toEqual({
				connector: "meta-ads",
				description: "Create an ad campaign",
				inputSchema: nonVisibleSchema,
				tool_name: "ads_campaign_create",
			});
		});

		it("describes a TikTok hidden operation through native tool_get and caches its schema", async () => {
			const hiddenSchema = {
				properties: {
					campaign_name: { type: "string" },
				},
				required: ["campaign_name"],
				type: "object",
			};
			const client = mockClient({
				callTool: (input) => {
					const call = input as {
						arguments: Record<string, unknown>;
						name: string;
					};
					if (call.name === "tool_list") {
						return tiktokToolListResult();
					}
					if (call.name === "tool_get") {
						return {
							content: [
								{
									text: JSON.stringify({
										description: "Create a fully configured TikTok campaign",
										parameters: hiddenSchema,
										tool_name: "campaign_create",
									}),
									type: "text",
								},
							],
						};
					}
					throw new Error(`Unexpected tool call: ${call.name}`);
				},
				definitions: [
					definition("advertiser_info_get"),
					definition("tool_execute"),
					definition("tool_get"),
					definition("tool_list"),
				],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});

			const result = await service.resolveToolsForUser(USER_ID);
			const described = await executeTool(
				requiredTool(result.tools, "describe_platform_tool"),
				{
					connector: "tiktok-ads",
					tool_name: "campaign_create",
				},
			);

			expect(described).toEqual({
				connector: "tiktok-ads",
				description: "Create a fully configured TikTok campaign",
				inputSchema: hiddenSchema,
				tool_name: "campaign_create",
			});
			expect(client.callTool).toHaveBeenNthCalledWith(2, {
				arguments: { tool_name: "campaign_create" },
				name: "tool_get",
			});

			await executeTool(requiredTool(result.tools, "describe_platform_tool"), {
				connector: "tiktok-ads",
				tool_name: "campaign_create",
			});
			expect(client.callTool).toHaveBeenCalledTimes(2);
		});

		it("returns closest matches for an unknown tool instead of throwing", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("ads_campaign_create"),
						definition("ads_campaign_list"),
					],
				}),
			);
			const { service } = buildService();

			const result = await service.resolveToolsForUser(USER_ID);
			const described = await executeTool(
				requiredTool(result.tools, "describe_platform_tool"),
				{
					connector: "meta-ads",
					tool_name: "campaign_creat",
				},
			);

			expect(described).toMatchObject({
				content: [
					{
						text: expect.stringContaining("Closest matches"),
						type: "text",
					},
				],
				isError: true,
			});
		});

		it("logs and returns direct matches when TikTok hidden discovery fails", async () => {
			const loggerWarn = vi
				.spyOn(Logger.prototype, "warn")
				.mockImplementation(() => undefined);
			const client = mockClient({
				callTool: () => ({
					content: [{ text: "gateway unavailable", type: "text" }],
					isError: true,
				}),
				definitions: [
					definition("advertiser_info_get"),
					definition("tool_execute"),
					definition("tool_get"),
					definition("tool_list"),
				],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});
			const result = await service.resolveToolsForUser(USER_ID);

			const described = await executeTool(
				requiredTool(result.tools, "describe_platform_tool"),
				{
					connector: "tiktok-ads",
					tool_name: "missing_campaign_get",
				},
			);

			expect(described).toMatchObject({ isError: true });
			expect(client.callTool).toHaveBeenCalledTimes(1);
			expect(loggerWarn).toHaveBeenCalledTimes(1);
		});

		it("runs direct MCP tools directly and hidden TikTok operations through tool_execute", async () => {
			const client = mockClient({
				callTool: (input) => {
					const call = input as { name: string };
					if (call.name === "tool_list") {
						return tiktokToolListResult();
					}
					return {
						content: [{ text: call.name, type: "text" }],
					};
				},
				definitions: [
					definition("report_integrated_get"),
					definition("tool_execute"),
					definition("tool_get"),
					definition("tool_list"),
				],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});

			const result = await service.resolveToolsForUser(USER_ID);
			await executeTool(requiredTool(result.tools, "run_platform_tool"), {
				connector: "tiktok-ads",
				params: { advertiser_id: "adv-1" },
				tool_name: "report_integrated_get",
			});
			await executeTool(requiredTool(result.tools, "run_platform_tool"), {
				connector: "tiktok-ads",
				params: { campaign_name: "Launch" },
				tool_name: "campaign_create",
			});

			expect(client.callTool).toHaveBeenNthCalledWith(1, {
				arguments: { advertiser_id: "adv-1" },
				name: "report_integrated_get",
			});
			expect(client.callTool).toHaveBeenNthCalledWith(2, {
				arguments: {},
				name: "tool_list",
			});
			expect(client.callTool).toHaveBeenNthCalledWith(3, {
				arguments: {
					params: { campaign_name: "Launch" },
					tool_name: "campaign_create",
				},
				name: "tool_execute",
			});
		});

		it("classifies run_platform_tool approval at call time for auto, read, write, and malformed inputs", async () => {
			queueClient(
				mockClient({ definitions: [definition("ads_get_ad_accounts")] }),
			);
			const { service } = buildService();
			const result = await service.resolveToolsForUser(USER_ID);
			const approval = result.approvalMap.run_platform_tool;

			expect(approval).toBeTypeOf("function");
			if (typeof approval !== "function") {
				throw new Error("Expected a call-time approval function");
			}

			expect(
				approval({
					connector: "higgsfield",
					params: {},
					tool_name: "generate_video",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "meta-ads",
					params: {},
					tool_name: "ads_get_ad_accounts",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "tiktok-ads",
					params: {},
					tool_name: "campaign_create",
				}),
			).toBe("user-approval");
			expect(
				approval({
					connector: "meta-ads",
					tool_name: "ads_get_ad_accounts",
				}),
			).toBe("user-approval");
			expect(approval({ connector: 42, tool_name: null })).toBe(
				"user-approval",
			);
			expect(approval("garbage")).toBe("user-approval");
		});
	});

	describe("read-only retry boundaries", () => {
		it("retries tools/list transport failures twice with 250ms and 1000ms backoff", async () => {
			vi.useFakeTimers();
			const client = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			client.listTools
				.mockRejectedValueOnce(transientError())
				.mockRejectedValueOnce(
					transientError({ cause: { code: "ECONNRESET" } }),
				)
				.mockResolvedValueOnce({
					tools: [definition("ads_get_ad_accounts")],
				});
			queueClient(client);
			const { service } = buildService();

			const resultPromise = service.resolveToolsForUser(USER_ID);
			await vi.advanceTimersByTimeAsync(249);
			expect(client.listTools).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(client.listTools).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(999);
			expect(client.listTools).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(1);
			const result = await resultPromise;

			expect(client.listTools).toHaveBeenCalledTimes(3);
			expect(result.tools).toHaveProperty("mcp_meta-ads_ads_get_ad_accounts");
		});

		it("retries a directly registered read tool but never retries a write", async () => {
			const readExecute = vi
				.fn()
				.mockRejectedValueOnce(transientError({ statusCode: 503 }))
				.mockRejectedValueOnce(transientError({ code: "ETIMEDOUT" }))
				.mockResolvedValue({ ok: true });
			const writeExecute = vi
				.fn()
				.mockRejectedValue(transientError({ statusCode: 503 }));
			queueClient(
				mockClient({
					definitions: [
						definition("campaign_create"),
						definition("campaign_get"),
					],
					toolImplementations: {
						campaign_create: executableTool(writeExecute),
						campaign_get: executableTool(readExecute),
					},
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: {
							allowlist: ["campaign_create", "campaign_get"],
						},
					}),
				],
			});
			const result = await service.resolveToolsForUser(USER_ID);
			vi.useFakeTimers();

			const readPromise = executeTool(
				requiredTool(result.tools, "mcp_meta-ads_campaign_get"),
				{},
			);
			await vi.advanceTimersByTimeAsync(1_250);

			await expect(readPromise).resolves.toEqual({ ok: true });
			expect(readExecute).toHaveBeenCalledTimes(3);
			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_create"),
					{},
				),
			).rejects.toMatchObject({ statusCode: 503 });
			expect(writeExecute).toHaveBeenCalledTimes(1);
		});

		it("does not retry a returned MCP isError result", async () => {
			const semanticError = {
				content: [{ text: "invalid request", type: "text" }],
				isError: true,
			};
			const execute = vi.fn().mockResolvedValue(semanticError);
			queueClient(
				mockClient({
					definitions: [definition("campaign_get")],
					toolImplementations: {
						campaign_get: executableTool(execute),
					},
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: ["campaign_get"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser(USER_ID);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_get"),
					{},
				),
			).resolves.toEqual(semanticError);
			expect(execute).toHaveBeenCalledTimes(1);
		});

		it("does not retry non-transport exceptions from a read tool", async () => {
			const applicationFailure = new Error("invalid report parameters");
			const execute = vi.fn().mockRejectedValue(applicationFailure);
			queueClient(
				mockClient({
					definitions: [definition("campaign_get")],
					toolImplementations: {
						campaign_get: executableTool(execute),
					},
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: ["campaign_get"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser(USER_ID);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_get"),
					{},
				),
			).rejects.toBe(applicationFailure);
			expect(execute).toHaveBeenCalledTimes(1);
		});

		it("classifies tool_execute retry eligibility from the inner operation on every call", async () => {
			const execute = vi
				.fn()
				.mockRejectedValueOnce(transientError({ code: "ECONNRESET" }))
				.mockResolvedValueOnce({ ok: "read" })
				.mockRejectedValueOnce(transientError({ statusCode: 503 }));
			queueClient(
				mockClient({
					definitions: [definition("tool_execute")],
					toolImplementations: {
						tool_execute: executableTool(execute),
					},
				}),
			);
			const { service } = buildService({
				connectors: [
					connector({
						slug: "tiktok-ads",
						toolPolicy: { allowlist: ["tool_execute"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser(USER_ID);
			const approval = result.approvalMap["mcp_tiktok-ads_tool_execute"];

			expect(approval).toBeTypeOf("function");
			if (typeof approval !== "function") {
				throw new Error("Expected a call-time approval function");
			}
			expect(approval({ tool_name: "campaign_get" })).toBe("not-applicable");
			expect(approval({ tool_name: "campaign_create" })).toBe("user-approval");
			expect(approval({})).toBe("user-approval");

			vi.useFakeTimers();
			const readPromise = executeTool(
				requiredTool(result.tools, "mcp_tiktok-ads_tool_execute"),
				{ tool_name: "campaign_get" },
			);
			await vi.advanceTimersByTimeAsync(250);
			await expect(readPromise).resolves.toEqual({ ok: "read" });
			expect(execute).toHaveBeenCalledTimes(2);

			await expect(
				executeTool(requiredTool(result.tools, "mcp_tiktok-ads_tool_execute"), {
					tool_name: "campaign_create",
				}),
			).rejects.toMatchObject({ statusCode: 503 });
			expect(execute).toHaveBeenCalledTimes(3);
		});

		it("retries run_platform_tool only when its inner direct operation is read", async () => {
			const client = mockClient({
				definitions: [
					definition("campaign_create"),
					definition("campaign_get"),
				],
			});
			client.callTool
				.mockRejectedValueOnce(transientError({ statusCode: 502 }))
				.mockResolvedValueOnce({ content: [], isError: false })
				.mockRejectedValueOnce(transientError({ statusCode: 502 }));
			queueClient(client);
			const { service } = buildService({
				connectors: [
					connector({
						toolPolicy: {
							allowlist: ["campaign_create", "campaign_get"],
						},
					}),
				],
			});
			const result = await service.resolveToolsForUser(USER_ID);
			vi.useFakeTimers();

			const readPromise = executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "meta-ads",
					params: {},
					tool_name: "campaign_get",
				},
			);
			await vi.advanceTimersByTimeAsync(250);
			await expect(readPromise).resolves.toMatchObject({ isError: false });

			await expect(
				executeTool(requiredTool(result.tools, "run_platform_tool"), {
					connector: "meta-ads",
					params: {},
					tool_name: "campaign_create",
				}),
			).rejects.toMatchObject({ statusCode: 502 });
			expect(client.callTool).toHaveBeenCalledTimes(3);
		});

		it("retries hidden read operations through run_platform_tool but not hidden writes", async () => {
			const readFailure = transientError({ code: "ECONNREFUSED" });
			const writeFailure = transientError({ statusCode: 503 });
			const client = mockClient({
				callTool: (input) => {
					const call = input as {
						arguments: { tool_name?: string };
						name: string;
					};
					if (call.name === "tool_list") {
						return {
							content: [
								{
									text: JSON.stringify([
										{
											description: "Get campaign details",
											tool_name: "campaign_get",
										},
										{
											description: "Create a campaign",
											tool_name: "campaign_create",
										},
									]),
									type: "text",
								},
							],
						};
					}
					if (
						call.name === "tool_execute" &&
						call.arguments.tool_name === "campaign_get"
					) {
						const priorReadCalls = client.callTool.mock.calls.filter(
							([candidate]) =>
								(candidate as { arguments?: { tool_name?: string } }).arguments
									?.tool_name === "campaign_get",
						).length;
						if (priorReadCalls === 1) {
							throw readFailure;
						}
						return { content: [], isError: false };
					}
					throw writeFailure;
				},
				definitions: [
					definition("tool_execute"),
					definition("tool_get"),
					definition("tool_list"),
				],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});
			const result = await service.resolveToolsForUser(USER_ID);
			vi.useFakeTimers();

			const readPromise = executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "tiktok-ads",
					params: {},
					tool_name: "campaign_get",
				},
			);
			await vi.advanceTimersByTimeAsync(250);
			await expect(readPromise).resolves.toMatchObject({ isError: false });

			await expect(
				executeTool(requiredTool(result.tools, "run_platform_tool"), {
					connector: "tiktok-ads",
					params: {},
					tool_name: "campaign_create",
				}),
			).rejects.toBe(writeFailure);
			const writeCalls = client.callTool.mock.calls.filter(
				([candidate]) =>
					(candidate as { arguments?: { tool_name?: string } }).arguments
						?.tool_name === "campaign_create",
			);
			expect(writeCalls).toHaveLength(1);
		});
	});

	describe("session reuse and request lifetime", () => {
		it("uses fresh-session options on first connection, captures the session, and preserves it on close", async () => {
			const client = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			let options: CapturedCreateOptions | undefined;
			queueClient(client, {
				onCreate: (captured) => {
					options = captured;
				},
				sessionId: "session-first",
			});
			const { runtimeCache, service } = buildService();

			const result = await service.resolveToolsForUser(USER_ID);

			expect(options).toBeDefined();
			expect(options).not.toHaveProperty("initialInitializeResult");
			expect(options).not.toHaveProperty("maxRetries");
			expect(options?.transport).toMatchObject({
				headers: { Authorization: "Bearer plain-access-token" },
				terminateSessionOnClose: false,
				type: "http",
				url: "https://mcp.example.com/mcp",
			});
			expect(options?.transport).not.toHaveProperty("initialSessionId");
			expect(options?.transport).not.toHaveProperty("initialProtocolVersion");
			expect(runtimeCache.getSession(CONNECTION_ID)).toMatchObject({
				initializeResult: INITIALIZE_RESULT,
				sessionId: "session-first",
			});

			options?.transport.onSessionIdChange?.("session-rotated");
			expect(runtimeCache.getSession(CONNECTION_ID)?.sessionId).toBe(
				"session-rotated",
			);

			await result.close();
			await result.close();
			expect(client.close).toHaveBeenCalledTimes(1);
			expect(runtimeCache.getSession(CONNECTION_ID)?.sessionId).toBe(
				"session-rotated",
			);
		});

		it("passes the complete saved initialize result, session id, and protocol version when resuming", async () => {
			const runtimeCache = new McpRuntimeCacheService();
			runtimeCache.setSession(CONNECTION_ID, {
				initializeResult: INITIALIZE_RESULT,
				sessionId: "session-saved",
			});
			const client = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			let options: CapturedCreateOptions | undefined;
			queueClient(client, {
				onCreate: (captured) => {
					options = captured;
				},
			});
			const { service } = buildService({ runtimeCache });

			await service.resolveToolsForUser(USER_ID);

			expect(options?.initialInitializeResult).toBe(INITIALIZE_RESULT);
			expect(options?.transport).toMatchObject({
				initialProtocolVersion: INITIALIZE_RESULT.protocolVersion,
				initialSessionId: "session-saved",
				terminateSessionOnClose: false,
			});
			expect(options).not.toHaveProperty("maxRetries");
		});

		it("detects a structural 404 from resumed discovery, invalidates it, and reconnects fresh once", async () => {
			const runtimeCache = new McpRuntimeCacheService();
			runtimeCache.setSession(CONNECTION_ID, {
				initializeResult: INITIALIZE_RESULT,
				sessionId: "session-stale",
			});
			const staleClient = mockClient();
			staleClient.listTools.mockRejectedValue(
				Object.assign(new Error("expired"), { statusCode: 404 }),
			);
			const freshClient = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			const options: CapturedCreateOptions[] = [];
			queueClient(staleClient, {
				onCreate: (captured) => {
					options.push(captured);
				},
			});
			queueClient(freshClient, {
				onCreate: (captured) => {
					options.push(captured);
				},
			});
			const { service } = buildService({ runtimeCache });

			const result = await service.resolveToolsForUser(USER_ID);

			expect(createMCPClient).toHaveBeenCalledTimes(2);
			expect(options[0]?.transport.initialSessionId).toBe("session-stale");
			expect(options[1]).not.toHaveProperty("initialInitializeResult");
			expect(options[1]?.transport).not.toHaveProperty("initialSessionId");
			expect(runtimeCache.getSession(CONNECTION_ID)).toBeUndefined();
			expect(staleClient.close).toHaveBeenCalledTimes(1);
			expect(result.tools).toHaveProperty("mcp_meta-ads_ads_get_ad_accounts");
		});

		it("validates a resumed session even with a fresh catalog before falling back to a fresh client", async () => {
			const runtimeCache = new McpRuntimeCacheService();
			runtimeCache.setSession(CONNECTION_ID, {
				initializeResult: INITIALIZE_RESULT,
				sessionId: "session-stale",
			});
			runtimeCache.setCatalog(CONNECTION_ID, [
				{
					description: "Get ad accounts",
					inputSchema: { properties: {}, type: "object" },
					name: "ads_get_ad_accounts",
				},
			]);
			const staleClient = mockClient();
			staleClient.listTools.mockRejectedValue(
				Object.assign(new Error("expired"), { statusCode: 404 }),
			);
			const freshClient = mockClient();
			queueClient(staleClient);
			queueClient(freshClient);
			const { service } = buildService({ runtimeCache });

			const result = await service.resolveToolsForUser(USER_ID);

			expect(staleClient.listTools).toHaveBeenCalledTimes(1);
			expect(freshClient.listTools).not.toHaveBeenCalled();
			expect(freshClient.toolsFromDefinitions).toHaveBeenCalledWith(
				{
					tools: [
						{
							description: "Get ad accounts",
							inputSchema: { properties: {}, type: "object" },
							name: "ads_get_ad_accounts",
						},
					],
				},
				{ schemas: "automatic" },
			);
			expect(runtimeCache.getSession(CONNECTION_ID)).toBeUndefined();
			expect(result.tools).toHaveProperty("mcp_meta-ads_ads_get_ad_accounts");
		});

		it("invalidates an expired session reported by the transport callback", async () => {
			const runtimeCache = new McpRuntimeCacheService();
			runtimeCache.setSession(CONNECTION_ID, {
				initializeResult: INITIALIZE_RESULT,
				sessionId: "session-stale",
			});
			const staleClient = mockClient();
			queueClient(staleClient, {
				onCreate: (options) => {
					options.transport.onSessionExpired?.("session-stale");
				},
			});
			const freshClient = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			queueClient(freshClient, { sessionId: "session-fresh" });
			const { service } = buildService({ runtimeCache });

			const result = await service.resolveToolsForUser(USER_ID);

			expect(createMCPClient).toHaveBeenCalledTimes(2);
			expect(staleClient.listTools).not.toHaveBeenCalled();
			expect(runtimeCache.getSession(CONNECTION_ID)?.sessionId).toBe(
				"session-fresh",
			);
			expect(result.tools).toHaveProperty("mcp_meta-ads_ads_get_ad_accounts");
		});

		it("rebinds discovery-door execution to the current request's client", async () => {
			const runtimeCache = new McpRuntimeCacheService();
			const firstClient = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			const secondClient = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			queueClient(firstClient, { sessionId: "session-shared" });
			queueClient(secondClient);
			const { service } = buildService({ runtimeCache });

			const firstResult = await service.resolveToolsForUser(USER_ID);
			await firstResult.close();
			const currentResult = await service.resolveToolsForUser(USER_ID);
			await executeTool(
				requiredTool(currentResult.tools, "run_platform_tool"),
				{
					connector: "meta-ads",
					params: { account_id: "act-1" },
					tool_name: "ads_get_ad_accounts",
				},
			);

			expect(firstClient.callTool).not.toHaveBeenCalled();
			expect(secondClient.callTool).toHaveBeenCalledWith({
				arguments: { account_id: "act-1" },
				name: "ads_get_ad_accounts",
			});
			expect(secondClient.listTools).toHaveBeenCalledTimes(1);
			expect(firstClient.close).toHaveBeenCalledTimes(1);
		});

		it("reuses a fresh catalog without another tools/list call in a later request", async () => {
			const runtimeCache = new McpRuntimeCacheService();
			const firstClient = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			const secondClient = mockClient();
			queueClient(firstClient);
			queueClient(secondClient);
			const { service } = buildService({ runtimeCache });

			await service.resolveToolsForUser(USER_ID);
			const secondResult = await service.resolveToolsForUser(USER_ID);

			expect(firstClient.listTools).toHaveBeenCalledTimes(1);
			expect(secondClient.listTools).not.toHaveBeenCalled();
			expect(secondClient.toolsFromDefinitions).toHaveBeenCalledWith(
				{
					tools: [definition("ads_get_ad_accounts")],
				},
				{ schemas: "automatic" },
			);
			expect(secondResult.tools).toHaveProperty(
				"mcp_meta-ads_ads_get_ad_accounts",
			);
		});

		it("closes a client that resolves after the ten-second discovery timeout", async () => {
			vi.useFakeTimers();
			const pendingClient = deferred<MCPClient>();
			vi.mocked(createMCPClient).mockReturnValueOnce(pendingClient.promise);
			const { service } = buildService();
			const resultPromise = service.resolveToolsForUser(USER_ID);

			await vi.advanceTimersByTimeAsync(10_000);
			const result = await resultPromise;
			const client = mockClient({
				definitions: [definition("ads_get_ad_accounts")],
			});
			pendingClient.resolve(client as unknown as MCPClient);
			await vi.advanceTimersByTimeAsync(0);
			await Promise.resolve();

			expect(result.tools).toEqual({});
			expect(result.notices).toEqual([
				"The user's Meta Ads connection could not be used (connector unreachable). Tell the user it is temporarily unavailable and to try again later if they ask for it.",
			]);
			expect(client.close).toHaveBeenCalledTimes(1);
			expect(client.listTools).not.toHaveBeenCalled();
			expect(client.toolsFromDefinitions).not.toHaveBeenCalled();
		});
	});
});
