import {
	createMCPClient,
	type InitializeResult,
	type ListToolsResult,
	type MCPClient,
} from "@ai-sdk/mcp";
import { ConflictException, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import type { Tool, ToolExecutionOptions } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/mcp", () => ({
	createMCPClient: vi.fn(),
}));

const triggerMocks = vi.hoisted(() => ({
	createPublicToken: vi.fn(),
	createTriggerIdempotencyKey: vi.fn(),
	trigger: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
	auth: { createPublicToken: triggerMocks.createPublicToken },
	idempotencyKeys: { create: triggerMocks.createTriggerIdempotencyKey },
	tasks: { trigger: triggerMocks.trigger },
}));

import type { ConnectorGenerationsRepository } from "../../../connector-generations/infrastructure/persistence/connector-generations.repository";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { HIGGSFIELD_MULTISHOT_AUDIO_MODEL } from "../../domain/higgsfield-models";
import type { ConnectorOperationEventsRepository } from "../../infrastructure/persistence/connector-operation-events.repository";
import type {
	McpConnectionRow,
	McpConnectionsRepository,
} from "../../infrastructure/persistence/mcp-connections.repository";
import type {
	McpConnectorRow,
	McpConnectorsRepository,
} from "../../infrastructure/persistence/mcp-connectors.repository";
import type { HiggsfieldPromptRefinerService } from "./higgsfield-prompt-refiner.service";
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
const CHAT_ID = "66666666-6666-4666-8666-666666666666";
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
const INITIAL_BILLING_MODE = env.GENERATION_BILLING_MODE;
const INITIAL_TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY;

function toolExecutionOptions(
	toolCallId: string,
): ToolExecutionOptions<unknown> {
	return { context: undefined, messages: [], toolCallId };
}

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
	const connectorOperationEventsRepository = {
		findLatestWriteAt: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue(undefined),
	};
	const connectorsRepository = {
		listEnabled: vi.fn().mockResolvedValue(connectors),
	};
	const connectionsService = {
		getValidAccessToken: vi.fn().mockResolvedValue("plain-access-token"),
	};
	const connectorGenerationsRepository = {
		insertAttempt: vi.fn().mockResolvedValue({
			created: true,
			id: GENERATION_ATTEMPT_ID,
			status: "queued",
		}),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn().mockResolvedValue(undefined),
	};
	const meteringEvents = new Map<
		string,
		Awaited<ReturnType<MeteringService["reserve"]>>
	>();
	let meteringEventIndex = 0;
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "generation-ref" }),
		captureProviderCallEvidence: vi.fn(
			async (eventId: string, evidence: { idempotencyKey: string }) => ({
				id: `evidence:${evidence.idempotencyKey}`,
				usageEventId: eventId,
			}),
		),
		findByIdempotencyKey: vi.fn(
			async (idempotencyKey: string) =>
				meteringEvents.get(idempotencyKey) ?? null,
		),
		refund: vi.fn(async (eventId: string) => ({ id: eventId })),
		reserveWithReplay: vi.fn(
			async (
				_operation: string,
				_subject: MeteringSubject,
				input: { credits?: number; idempotencyKey: string },
			): Promise<Awaited<ReturnType<MeteringService["reserveWithReplay"]>>> => {
				meteringEventIndex += 1;
				const event = {
					id: `usage-event-${meteringEventIndex}`,
					reservedCredits: input.credits ?? 1,
				} as Awaited<ReturnType<MeteringService["reserve"]>>;
				meteringEvents.set(input.idempotencyKey, event);
				return { event, replay: "none", replayed: false } as const;
			},
		),
		settle: vi.fn(async (eventId: string) => ({ id: eventId })),
		settleDirectPairWithFixedEvidence: vi.fn(
			async (
				parent: { eventId: string },
				child?: { eventId: string },
				_evidence?: { completedUnits: number; eventId: string },
			) => ({
				child: child ? { id: child.eventId } : null,
				parent: { id: parent.eventId },
			}),
		),
		upgradeFixedGenerationUnits: vi.fn(async () => undefined),
	};
	const promptRefiner = {
		refineGenerationArgs: vi.fn(
			async (input: { args: unknown }): Promise<unknown> => input.args,
		),
	};
	const service = new McpChatToolsService(
		connectorOperationEventsRepository as unknown as ConnectorOperationEventsRepository,
		connectionsRepository as unknown as McpConnectionsRepository,
		connectorsRepository as unknown as McpConnectorsRepository,
		connectionsService as unknown as McpConnectionsService,
		runtimeCache,
		connectorGenerationsRepository as unknown as ConnectorGenerationsRepository,
		meteringService as unknown as MeteringService,
		promptRefiner as unknown as HiggsfieldPromptRefinerService,
	);

	return {
		connectionsRepository,
		connectionsService,
		connectorOperationEventsRepository,
		connectorGenerationsRepository,
		connectorsRepository,
		meteringEvents,
		meteringService,
		promptRefiner,
		runtimeCache,
		service,
	};
}

async function executeTool(
	tool: Tool,
	input: unknown,
	options: ToolExecutionOptions<unknown> = TOOL_EXECUTION_OPTIONS,
): Promise<unknown> {
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

	return execute(input, options);
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
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = "enforce";
		// The test env object can be process.env itself (skipValidation), where
		// `= undefined` coerces to the TRUTHY string "undefined" — delete is the
		// only reliable way to model a missing key.
		Reflect.deleteProperty(
			env as unknown as Record<string, unknown>,
			"TRIGGER_SECRET_KEY",
		);
		triggerMocks.createPublicToken.mockResolvedValue("public-token");
		triggerMocks.createTriggerIdempotencyKey.mockResolvedValue(
			"connector-idempotency-key",
		);
		triggerMocks.trigger.mockResolvedValue({ id: "trigger-run-1" });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		(
			env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
		).GENERATION_BILLING_MODE = INITIAL_BILLING_MODE;
		if (INITIAL_TRIGGER_SECRET_KEY === undefined) {
			Reflect.deleteProperty(
				env as unknown as Record<string, unknown>,
				"TRIGGER_SECRET_KEY",
			);
		} else {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				INITIAL_TRIGGER_SECRET_KEY;
		}
	});

	describe("connection setup and existing behavior", () => {
		it("short-circuits with no tools or discovery doors when the user has no connections", async () => {
			const {
				connectionsRepository,
				connectionsService,
				connectorsRepository,
				service,
			} = buildService({ connections: [] });

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			expect(createMCPClient).not.toHaveBeenCalled();
			expect(result.tools).toEqual({});
			expect(result.approvalMap).toEqual({});
			expect(result.notices).toEqual([
				"The user's Meta Ads connection could not be used (connector unreachable). If the user asks for ANYTHING that needs this connector (a generation, a report…), say plainly that it is temporarily unavailable right now and to try again shortly — never announce or pretend to start that work. You may offer to make the whole video with Wandit's own generator instead, but only as an explicit user-approved switch.",
			]);
			expect(result.notices.join(" ")).not.toContain("secret-provider-token");
		});

		it("requires reconnect only for a rejected token refresh", async () => {
			const {
				connectionsService,
				connectorOperationEventsRepository,
				service,
			} = buildService();
			connectionsService.getValidAccessToken.mockRejectedValue(
				new ConflictException("refresh rejected"),
			);

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			expect(createMCPClient).not.toHaveBeenCalled();
			expect(result.notices).toEqual([
				"The user's Meta Ads connection could not be used (reconnect required). If the user asks for ANYTHING that needs this connector (a generation, a report…), tell them to reconnect it in Settings → Connectors — never announce or pretend to start that work. You may offer to make the whole video with Wandit's own generator instead, but only as an explicit user-approved switch.",
			]);
			expect(connectorOperationEventsRepository.insert).not.toHaveBeenCalled();
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const metaResult = await meta.service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			// Ads writes get call-time classifiers (money-based policy), never
			// the static "user-approval": the verdict depends on the arguments.
			const frobnicate =
				metaResult.approvalMap["mcp_meta-ads_frobnicate_widget"];
			const getAndDelete =
				metaResult.approvalMap["mcp_meta-ads_get_and_delete_campaign"];

			expect(frobnicate).toBeTypeOf("function");
			expect(getAndDelete).toBeTypeOf("function");
			if (
				typeof frobnicate !== "function" ||
				typeof getAndDelete !== "function"
			) {
				throw new Error("Expected call-time approval functions");
			}

			// Unknown verb, no money, no status: cannot start spend — free.
			expect(frobnicate({})).toBe("not-applicable");
			// Deletes destroy work — always carded.
			expect(getAndDelete({ id: "1" })).toBe("user-approval");
			// Reads are registered too (so a status-setter with a read-looking
			// name still gets its arguments inspected) and resolve to no card.
			const getAccounts =
				metaResult.approvalMap["mcp_meta-ads_ads_get_ad_accounts"];
			expect(getAccounts).toBeTypeOf("function");
			if (typeof getAccounts !== "function") {
				throw new Error("Expected a call-time approval function");
			}
			expect(getAccounts({})).toBe("not-applicable");

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

			const higgsfieldResult = await higgsfield.service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			expect(higgsfieldResult.approvalMap).toMatchObject({
				mcp_higgsfield_publish_website: "user-approval",
			});
			expect(higgsfieldResult.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_generate_video",
			);
		});

		it("keeps the namespaced TikTok publish gated while its supporting steps run automatically", async () => {
			const names = [
				"tiktok_accounts",
				"tiktok_prepare_publish",
				"tiktok_publish",
				"tiktok_publish_status",
			];
			queueClient(
				mockClient({ definitions: names.map((name) => definition(name)) }),
			);
			const { service } = buildService({
				connectors: [
					connector({
						slug: "higgsfield",
						toolPolicy: { allowlist: names },
					}),
				],
			});

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			expect(result.approvalMap).toMatchObject({
				mcp_higgsfield_tiktok_publish: "user-approval",
			});
			expect(result.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_tiktok_prepare_publish",
			);
			expect(result.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_tiktok_accounts",
			);
			expect(result.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_tiktok_publish_status",
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			expect(result.tools).toHaveProperty("mcp_meta-ads_ads_get_ad_accounts");
			expect(result.tools).not.toHaveProperty(
				"mcp_meta-ads_ads_campaign_create",
			);
		});

		it("exposes only the enrolled default Higgsfield capabilities", async () => {
			const enrolled = [
				"generate_image",
				"generate_video",
				"generate_audio",
				"upscale_video",
				"reframe",
				"motion_control",
				"show_marketing_studio",
				"video_analysis_create",
				"video_analysis_status",
				"video_analysis_jobs",
				"media_import_url",
				"list_voices",
				"models_explore",
				"job_status",
				"job_display",
				"show_generations",
			];
			queueClient(
				mockClient({
					definitions: [
						...enrolled.map((name) => definition(name)),
						definition("voice_change"),
						definition("media_confirm"),
						definition("select_workspace"),
					],
				}),
			);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			for (const name of enrolled) {
				expect(result.tools).toHaveProperty(`mcp_higgsfield_${name}`);
			}
			expect(result.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_list_voices",
			);
			expect(result.tools).not.toHaveProperty("mcp_higgsfield_voice_change");
			expect(result.tools).not.toHaveProperty("mcp_higgsfield_media_confirm");
			expect(result.tools).not.toHaveProperty(
				"mcp_higgsfield_select_workspace",
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

		it("reports approval only for the final TikTok publish in search results", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("tiktok_prepare_publish"),
						definition("tiktok_publish"),
					],
				}),
			);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			const search = await executeTool(
				requiredTool(result.tools, "search_platform_tools"),
				{
					connector: "higgsfield",
					query: "tiktok publish",
				},
			);
			const matches = searchResults(search);

			expect(matches).toContainEqual(
				expect.objectContaining({
					connector: "higgsfield",
					requires_approval: false,
					tool_name: "tiktok_prepare_publish",
				}),
			);
			expect(matches).toContainEqual(
				expect.objectContaining({
					connector: "higgsfield",
					requires_approval: true,
					tool_name: "tiktok_publish",
				}),
			);
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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
			expect(connectorOperationEventsRepository.insert).not.toHaveBeenCalled();
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

		it("refuses off-whitelist Higgsfield execution while keeping discovery honest", async () => {
			const client = mockClient({
				definitions: [definition("generate_audio"), definition("voice_change")],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await expect(
				executeTool(requiredTool(result.tools, "describe_platform_tool"), {
					connector: "higgsfield",
					tool_name: "voice_change",
				}),
			).resolves.toMatchObject({ tool_name: "voice_change" });

			const input = {
				connector: "higgsfield" as const,
				params: { voice: "narrator" },
				tool_name: "voice_change",
			};
			const approval = result.approvalMap.run_platform_tool;
			expect(approval).toBeTypeOf("function");
			if (typeof approval !== "function") {
				throw new Error("Expected a call-time approval function");
			}
			expect(approval(input)).toBe("not-applicable");

			const refused = (await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				input,
			)) as { content: Array<{ text: string }>; isError: boolean };

			expect(refused.isError).toBe(true);
			expect(refused.content[0]?.text).toContain(
				'Tool "voice_change" is not enrolled for Higgsfield',
			);
			expect(refused.content[0]?.text).toContain(
				"Available Higgsfield tools: generate_audio",
			);
			expect(client.callTool).not.toHaveBeenCalled();
		});

		it("does not restrict another connector's generic execution door", async () => {
			const client = mockClient({
				definitions: [definition("select_workspace")],
			});
			queueClient(client);
			const { service } = buildService();
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			const approval = result.approvalMap.run_platform_tool;
			expect(approval).toBeTypeOf("function");
			if (typeof approval !== "function") {
				throw new Error("Expected a call-time approval function");
			}
			expect(
				approval({
					connector: "meta-ads",
					params: { workspace_id: "workspace-1" },
					tool_name: "select_workspace",
				}),
			).toBe("not-applicable");

			await executeTool(requiredTool(result.tools, "run_platform_tool"), {
				connector: "meta-ads",
				params: { workspace_id: "workspace-1" },
				tool_name: "select_workspace",
			});

			expect(client.callTool).toHaveBeenCalledWith({
				arguments: { workspace_id: "workspace-1" },
				name: "select_workspace",
			});
		});

		it("classifies run_platform_tool approval at call time for auto, read, write, and malformed inputs", async () => {
			queueClient(
				mockClient({ definitions: [definition("ads_get_ad_accounts")] }),
			);
			const { service } = buildService();
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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
			for (const toolName of [
				"show_marketing_studio",
				"video_analysis_create",
				"video_analysis_status",
				"video_analysis_jobs",
			]) {
				expect(
					approval({
						connector: "higgsfield",
						params: {},
						tool_name: toolName,
					}),
				).toBe("not-applicable");
			}
			expect(
				approval({
					connector: "higgsfield",
					params: {},
					tool_name: "voice_change",
				}),
			).toBe("user-approval");
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
					connector: "tiktok-ads",
					params: { budget: 40, operation_status: "DISABLE" },
					tool_name: "campaign_create",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "meta-ads",
					params: { status: "PAUSED" },
					tool_name: "ads_create_adset",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "tiktok-ads",
					params: { adgroup_ids: ["9"], operation_status: "ENABLE" },
					tool_name: "adgroup_status_update",
				}),
			).toBe("user-approval");
			expect(
				approval({
					connector: "tiktok-ads",
					params: { adgroup_ids: ["9"], operation_status: "DISABLE" },
					tool_name: "adgroup_status_update",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "meta-ads",
					params: { daily_budget: "5000", id: "120210000" },
					tool_name: "ads_update_adset",
				}),
			).toBe("user-approval");
			expect(
				approval({
					connector: "higgsfield",
					params: {},
					tool_name: "tiktok_prepare_publish",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "higgsfield",
					params: {},
					tool_name: "tiktok_accounts",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					connector: "higgsfield",
					params: {},
					tool_name: "tiktok_publish",
				}),
			).toBe("user-approval");
			expect(
				approval({
					connector: "higgsfield",
					params: {},
					tool_name: "tiktok_delete_account",
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

	describe("connector generation metering", () => {
		it("runs Marketing Studio and video analysis inline, auto-approved, and unbilled", async () => {
			const toolNames = [
				"show_marketing_studio",
				"video_analysis_create",
				"video_analysis_status",
				"video_analysis_jobs",
			] as const;
			const providerExecute = vi.fn((name: string) => ({ name, ok: true }));
			queueClient(
				mockClient({
					definitions: toolNames.map((name) => definition(name)),
					toolImplementations: Object.fromEntries(
						toolNames.map((name) => [
							name,
							executableTool(() => providerExecute(name)),
						]),
					),
				}),
			);
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			for (const name of toolNames) {
				await expect(
					executeTool(
						requiredTool(result.tools, `mcp_higgsfield_${name}`),
						{},
						toolExecutionOptions(`call-${name}`),
					),
				).resolves.toEqual({ name, ok: true });
				expect(result.approvalMap).not.toHaveProperty(`mcp_higgsfield_${name}`);
				expect(providerExecute).toHaveBeenCalledWith(name);
			}

			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(triggerMocks.trigger).not.toHaveBeenCalled();
		});

		it("meters an inline image generation as connector plus per-image child and captures gateway ids", async () => {
			const providerResult = {
				content: [
					{
						text: JSON.stringify({
							imageUrl: "https://cdn.example.com/generated-image.webp",
							providerMetadata: {
								gateway: { generationId: "gateway-generation-1" },
							},
						}),
						type: "text",
					},
				],
			};
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(() => providerResult),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ count: 2, prompt: "A product photo" },
					toolExecutionOptions("call-image-1"),
				),
			).resolves.toBe(providerResult);

			const referenceId =
				"mcp:user-1:chat-event:higgsfield:generate_image:call-image-1";
			expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
				1,
				"connector",
				{ actorUserId: USER_ID },
				// The MCP render runs on the user's own subscription: 1 cc holds.
				{
					attemptRef: referenceId,
					credits: 1,
					estimatedCostUsdMicros: null,
					idempotencyKey: `connector:${referenceId}`,
					measuredTerms: { estimatedUnitUsdMicros: null, units: 1 },
					parentEventId: "chat-event",
				},
			);
			expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
				2,
				"image",
				{ actorUserId: USER_ID },
				{
					attemptRef: referenceId,
					credits: 1,
					estimatedCostUsdMicros: 0,
					idempotencyKey: `image:${referenceId}`,
					measuredTerms: { estimatedUnitUsdMicros: 0, units: 2 },
					parentEventId: "usage-event-1",
				},
			);
			expect(meteringService.settle).not.toHaveBeenCalled();
			expect(
				meteringService.settleDirectPairWithFixedEvidence,
			).toHaveBeenCalledWith(
				{
					eventId: "usage-event-1",
					settlement: expect.objectContaining({
						costUsdMicros: 0,
						finalCredits: 0,
						pricing: "direct",
						pricingSnapshot: expect.objectContaining({
							operation: "connector",
							units: 1,
						}),
					}),
				},
				{
					eventId: "usage-event-2",
					settlement: expect.objectContaining({
						costUsdMicros: 0,
						finalCredits: 0,
						pricing: "direct",
						pricingSnapshot: expect.objectContaining({
							operation: "image",
							units: 1,
						}),
					}),
				},
				{ completedUnits: 1, eventId: "usage-event-2" },
			);
			expect(meteringService.captureGeneration).toHaveBeenCalledWith(
				"usage-event-2",
				{
					providerMetadata: {
						gateway: { generationId: "gateway-generation-1" },
					},
					stepUsage: {
						metering: { fixedUnits: 0 },
						providerUsage: null,
					},
				},
			);
			const captureOrder =
				meteringService.captureGeneration.mock.invocationCallOrder[0];
			const settleOrder =
				meteringService.settleDirectPairWithFixedEvidence.mock
					.invocationCallOrder[0];
			expect(captureOrder).toBeDefined();
			expect(settleOrder).toBeDefined();
			expect(captureOrder as number).toBeLessThan(settleOrder as number);
		});

		it("captures a thrown Gateway generation before refunding inline holds", async () => {
			const providerError = Object.assign(new Error("gateway failed"), {
				generationId: "gateway-generation-error",
			});
			const providerExecute = vi.fn().mockRejectedValue(providerError);
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ prompt: "Fail after gateway admission" },
					toolExecutionOptions("call-image-gateway-error"),
				),
			).rejects.toBe(providerError);
			expect(meteringService.captureGeneration).toHaveBeenCalledWith(
				"usage-event-2",
				{
					providerMetadata: {
						gateway: { generationId: "gateway-generation-error" },
					},
					stepUsage: {
						metering: { fixedUnits: 0 },
						providerUsage: null,
					},
				},
			);
			expect(meteringService.refund).toHaveBeenCalledTimes(2);
			expect(
				meteringService.captureGeneration.mock.invocationCallOrder[0],
			).toBeLessThan(
				meteringService.refund.mock.invocationCallOrder[0] ??
					Number.MAX_SAFE_INTEGER,
			);
		});

		it("captures Gateway evidence from an MCP error result before refunding", async () => {
			const providerResult = {
				content: [
					{
						text: JSON.stringify({
							providerMetadata: {
								gateway: { generationId: "gateway-mcp-error" },
							},
						}),
						type: "text",
					},
				],
				isError: true,
			};
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(() => providerResult),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ prompt: "Provider rejects" },
					toolExecutionOptions("call-image-mcp-error"),
				),
			).resolves.toBe(providerResult);
			expect(meteringService.captureGeneration).toHaveBeenCalledWith(
				"usage-event-2",
				expect.objectContaining({
					stepUsage: {
						metering: { fixedUnits: 0 },
						providerUsage: null,
					},
				}),
			);
			expect(
				meteringService.captureGeneration.mock.invocationCallOrder[0],
			).toBeLessThan(
				meteringService.refund.mock.invocationCallOrder[0] ??
					Number.MAX_SAFE_INTEGER,
			);
		});

		it("retries mandatory inline generation-ref capture without repeating provider work", async () => {
			const providerResult = {
				providerMetadata: {
					gateway: { generationId: "gateway-generation-retry" },
				},
			};
			const providerExecute = vi.fn().mockResolvedValue(providerResult);
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			meteringService.captureGeneration
				.mockRejectedValueOnce(new Error("capture unavailable 1"))
				.mockRejectedValueOnce(new Error("capture unavailable 2"))
				.mockResolvedValue({ id: "generation-ref" });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ prompt: "Retry capture" },
					toolExecutionOptions("call-image-capture-retry"),
				),
			).resolves.toBe(providerResult);
			expect(providerExecute).toHaveBeenCalledTimes(1);
			expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
			expect(meteringService.settle).not.toHaveBeenCalled();
			expect(
				meteringService.settleDirectPairWithFixedEvidence,
			).toHaveBeenCalledTimes(1);
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("does not deliver, settle, or refund after terminal inline generation-ref failure", async () => {
			const providerResult = {
				providerMetadata: {
					gateway: { generationId: "gateway-generation-failed" },
				},
			};
			const providerExecute = vi.fn().mockResolvedValue(providerResult);
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const persistenceError = new Error("generation ref unavailable");
			meteringService.captureGeneration.mockRejectedValue(persistenceError);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ prompt: "Do not deliver" },
					toolExecutionOptions("call-image-capture-failed"),
				),
			).rejects.toBe(persistenceError);
			expect(providerExecute).toHaveBeenCalledTimes(1);
			expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
			expect(meteringService.settle).not.toHaveBeenCalled();
			expect(
				meteringService.settleDirectPairWithFixedEvidence,
			).not.toHaveBeenCalled();
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("does not invoke an inline provider for a terminal metering replay", async () => {
			const providerExecute = vi.fn();
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			meteringService.reserveWithReplay.mockResolvedValueOnce({
				event: { id: "settled-connector" } as Awaited<
					ReturnType<MeteringService["reserve"]>
				>,
				replay: "settled",
				replayed: true,
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ prompt: "Do not repeat" },
					toolExecutionOptions("call-image-terminal"),
				),
			).rejects.toMatchObject({
				name: "MeteringStateConflictError",
				status: "settled",
			});
			expect(providerExecute).not.toHaveBeenCalled();
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("does not invoke an inline provider for a reserved metering replay", async () => {
			const providerExecute = vi.fn();
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			meteringService.reserveWithReplay.mockResolvedValueOnce({
				event: { id: "reserved-connector" } as Awaited<
					ReturnType<MeteringService["reserve"]>
				>,
				replay: "reserved",
				replayed: true,
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{ prompt: "Do not repeat an ambiguous call" },
					toolExecutionOptions("call-image-reserved"),
				),
			).rejects.toMatchObject({
				name: "MeteringStateConflictError",
				status: "reserved",
			});
			expect(providerExecute).not.toHaveBeenCalled();
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("meters connector-only generation but leaves ordinary connector calls unmetered", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("generate_audio"),
						definition("models_explore"),
					],
					toolImplementations: {
						generate_audio: executableTool(),
						models_explore: executableTool(),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_models_explore"),
				{},
				toolExecutionOptions("call-read"),
			);
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_audio"),
				{},
				toolExecutionOptions("call-audio"),
			);
			expect(meteringService.reserveWithReplay).toHaveBeenCalledTimes(1);
			expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
				"connector",
				{ actorUserId: USER_ID },
				expect.objectContaining({ credits: 1, parentEventId: "chat-event" }),
			);
		});

		it("propagates a typed 402 without calling an inline provider", async () => {
			const execute = vi.fn();
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(execute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const paymentRequired = new InsufficientCreditsError(5, 0);
			meteringService.reserveWithReplay.mockRejectedValueOnce(paymentRequired);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{},
					toolExecutionOptions("call-no-credits"),
				),
			).rejects.toBe(paymentRequired);
			expect(execute).not.toHaveBeenCalled();
		});

		it("reserves stable connector and video events before background enqueue", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					{
						prompt:
							"SUBJECT: PulseBuds earbuds. KEY MOMENT: the case snaps open in morning light.",
					},
					toolExecutionOptions("call-background"),
				),
			).resolves.toMatchObject({
				attemptId: GENERATION_ATTEMPT_ID,
				status: "queued",
			});

			expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
				1,
				"connector",
				{ actorUserId: USER_ID },
				expect.objectContaining({
					credits: 1,
					idempotencyKey: `connector:${GENERATION_ATTEMPT_ID}`,
					parentEventId: "chat-event",
				}),
			);
			expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
				2,
				"video",
				{ actorUserId: USER_ID },
				expect.objectContaining({
					credits: 1,
					idempotencyKey: `video:${GENERATION_ATTEMPT_ID}`,
					parentEventId: "usage-event-1",
				}),
			);
			expect(triggerMocks.trigger).toHaveBeenCalledWith(
				"run-connector-generation",
				{
					args: {
						prompt:
							"SUBJECT: PulseBuds earbuds. KEY MOMENT: the case snaps open in morning light.",
						use_unlim: false,
					},
					attemptId: GENERATION_ATTEMPT_ID,
					billing: {
						child: {
							credits: 1,
							eventId: "usage-event-2",
							operation: "video",
							referenceId: GENERATION_ATTEMPT_ID,
							replay: "none",
							terms: {
								estimatedUnitUsdMicros: null,
								mode: "measured",
								unit: "video",
								usdMicrosPerCredit: 40_000,
							},
							units: 1,
						},
						connector: {
							credits: 1,
							eventId: "usage-event-1",
							operation: "connector",
							referenceId: GENERATION_ATTEMPT_ID,
							replay: "none",
							terms: {
								estimatedUnitUsdMicros: null,
								mode: "measured",
								unit: "operation",
								usdMicrosPerCredit: 40_000,
							},
							units: 1,
						},
					},
					billingMode: "enforce",
					userId: USER_ID,
				},
				{
					idempotencyKey: "connector-idempotency-key",
					idempotencyKeyTTL: "14d",
					tags: [
						`connector-attempt:${GENERATION_ATTEMPT_ID}`,
						"connector:higgsfield",
					],
					ttl: "5m",
				},
			);
			expect(triggerMocks.createTriggerIdempotencyKey).toHaveBeenCalledWith(
				`connector-generation:${GENERATION_ATTEMPT_ID}`,
				{ scope: "global" },
			);
			expect(
				connectorGenerationsRepository.markAttemptTriggered,
			).toHaveBeenCalledWith(GENERATION_ATTEMPT_ID, "trigger-run-1");
			expect(meteringService.settle).not.toHaveBeenCalled();
		});

		it("pins omitted Higgsfield use_unlim false before storing a queued call", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_video"),
				{
					params: {
						prompt:
							"SUBJECT: a watch on slate. KEY MOMENT: the second hand catches a clean rim light.",
					},
				},
				toolExecutionOptions("call-unlim-omitted"),
			);

			expect(connectorGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
				expect.objectContaining({
					args: {
						params: {
							prompt:
								"SUBJECT: a watch on slate. KEY MOMENT: the second hand catches a clean rim light.",
							use_unlim: false,
						},
					},
				}),
			);
		});

		it("preserves an explicit Higgsfield use_unlim choice in queued args", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			const args = {
				params: {
					prompt:
						"SUBJECT: a watch on slate. KEY MOMENT: the second hand catches a clean rim light.",
					use_unlim: true,
				},
			};

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_video"),
				args,
				toolExecutionOptions("call-unlim-explicit"),
			);

			expect(connectorGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
				expect.objectContaining({ args }),
			);
		});

		it("dispatches enforced reservations after the runtime switch turns off", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			triggerMocks.createTriggerIdempotencyKey.mockImplementationOnce(
				async () => {
					(
						env as typeof env & {
							GENERATION_BILLING_MODE: "enforce" | "off";
						}
					).GENERATION_BILLING_MODE = "off";
					return "connector-idempotency-key";
				},
			);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_video"),
				{
					prompt:
						"SUBJECT: PulseBuds earbuds. KEY MOMENT: the case snaps open in morning light.",
				},
				toolExecutionOptions("call-switch"),
			);

			expect(triggerMocks.trigger).toHaveBeenCalledWith(
				"run-connector-generation",
				expect.objectContaining({ billingMode: "enforce" }),
				expect.any(Object),
			);
		});

		it("does not enqueue a background provider for a terminal metering replay", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			meteringService.reserveWithReplay.mockResolvedValueOnce({
				event: { id: "reconciled-connector" } as Awaited<
					ReturnType<MeteringService["reserve"]>
				>,
				replay: "reconciled",
				replayed: true,
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					{
						prompt:
							"SUBJECT: a replayed request that must not enqueue provider work again.",
					},
					toolExecutionOptions("call-video-terminal"),
				),
			).rejects.toMatchObject({
				name: "MeteringStateConflictError",
				status: "reconciled",
			});
			expect(triggerMocks.trigger).not.toHaveBeenCalled();
			expect(
				connectorGenerationsRepository.markAttemptFailed,
			).toHaveBeenCalledTimes(1);
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("preserves reservations when an ambiguous Trigger handoff is not confirmed", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			triggerMocks.trigger.mockRejectedValue(new Error("Trigger unavailable"));
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					{},
					toolExecutionOptions("call-background-failed"),
				),
			).resolves.toMatchObject({
				attemptId: GENERATION_ATTEMPT_ID,
				status: "queued",
			});
			expect(triggerMocks.trigger).toHaveBeenCalledTimes(3);
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("retries an ambiguous Trigger handoff with the same idempotency key", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			triggerMocks.trigger
				.mockRejectedValueOnce(new Error("response lost"))
				.mockResolvedValueOnce({ id: "trigger-run-recovered" });
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					{},
					toolExecutionOptions("call-background-retry"),
				),
			).resolves.toMatchObject({ status: "queued" });
			expect(triggerMocks.trigger).toHaveBeenCalledTimes(2);
			expect(
				triggerMocks.trigger.mock.calls.map((call) => call[2]?.idempotencyKey),
			).toEqual(["connector-idempotency-key", "connector-idempotency-key"]);
			expect(meteringService.refund).not.toHaveBeenCalled();
		});

		it("refunds both holds only after a definitive Trigger rejection", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			triggerMocks.trigger.mockRejectedValueOnce(
				Object.assign(new Error("Invalid task"), {
					name: "TriggerApiError",
					status: 422,
				}),
			);
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					{},
					toolExecutionOptions("call-background-rejected"),
				),
			).resolves.toMatchObject({ isError: true });
			expect(triggerMocks.trigger).toHaveBeenCalledTimes(1);
			expect(
				connectorGenerationsRepository.markAttemptFailed,
			).toHaveBeenCalledWith(GENERATION_ATTEMPT_ID, "Invalid task");
			expect(meteringService.refund.mock.calls).toEqual([
				["usage-event-2", "connector_generation_failed"],
				["usage-event-1", "connector_generation_failed"],
			]);
		});

		it("keeps generation execution unmetered when billing is off", async () => {
			(
				env as typeof env & { GENERATION_BILLING_MODE: "enforce" | "off" }
			).GENERATION_BILLING_MODE = "off";
			queueClient(
				mockClient({
					definitions: [definition("generate_audio")],
					toolImplementations: {
						generate_audio: executableTool(),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_audio"),
				{},
				toolExecutionOptions("call-billing-off"),
			);
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(meteringService.settle).not.toHaveBeenCalled();
		});

		it("refunds inline fallback holds when Higgsfield returns an unlim_choice question", async () => {
			const providerResult = {
				content: [
					{
						text: JSON.stringify({
							question: "Use unlimited allowance or paid balance?",
							type: "unlim_choice",
						}),
						type: "text",
					},
				],
				isError: false,
			};
			const providerExecute = vi.fn(() => providerResult);
			queueClient(
				mockClient({
					definitions: [definition("generate_video")],
					toolImplementations: {
						generate_video: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			const args = {
				params: {
					model: "seedance_2_5",
					prompt:
						"SUBJECT: a watch on slate. KEY MOMENT: the second hand catches a clean rim light.",
				},
			};

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					args,
					toolExecutionOptions("call-inline-unlim-choice"),
				),
			).resolves.toBe(providerResult);
			expect(providerExecute).toHaveBeenCalledWith(
				{
					params: { ...args.params, use_unlim: false },
				},
				expect.any(Object),
			);
			expect(meteringService.refund.mock.calls).toEqual([
				["usage-event-2", "connector_generation_failed"],
				["usage-event-1", "connector_generation_failed"],
			]);
			expect(
				meteringService.settleDirectPairWithFixedEvidence,
			).not.toHaveBeenCalled();
			expect(meteringService.settle).not.toHaveBeenCalled();
		});

		it("pins omitted use_unlim on inline generate_audio through namespaced and door paths", async () => {
			const providerExecute = vi.fn(() => ({ ok: true }));
			const client = mockClient({
				definitions: [definition("generate_audio")],
				toolImplementations: {
					generate_audio: executableTool(providerExecute),
				},
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			const args = {
				params: { model: "seed_audio", prompt: "Read this exact line." },
			};

			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_audio"),
				args,
				toolExecutionOptions("call-inline-audio"),
			);
			expect(providerExecute).toHaveBeenCalledWith(
				{
					params: { ...args.params, use_unlim: false },
				},
				expect.any(Object),
			);

			await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: args,
					tool_name: "generate_audio",
				},
				toolExecutionOptions("call-door-audio"),
			);
			expect(client.callTool).toHaveBeenCalledWith({
				arguments: {
					params: { ...args.params, use_unlim: false },
				},
				name: "generate_audio",
			});
		});
	});

	describe("creative-director gate, cost preflight, and batch guard", () => {
		it("queues generate_image in the background when the Trigger key is set", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_image")] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_image"),
					{
						params: { count: 2, model: "seedream", prompt: "A product photo" },
					},
					toolExecutionOptions("call-image-queued"),
				),
			).resolves.toMatchObject({
				attemptId: GENERATION_ATTEMPT_ID,
				kind: "wandit_background_generation",
				status: "queued",
				tool: "generate_image",
			});
			expect(
				connectorGenerationsRepository.insertAttempt,
			).toHaveBeenCalledTimes(1);
			expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
				2,
				"image",
				{ actorUserId: USER_ID },
				expect.objectContaining({
					idempotencyKey: `image:${GENERATION_ATTEMPT_ID}`,
				}),
			);
			expect(triggerMocks.trigger).toHaveBeenCalledTimes(1);
		});

		it("dedupes a duplicated queue request onto one attempt and one reservation", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_image")] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
				CHAT_ID,
			);
			const tool = requiredTool(result.tools, "mcp_higgsfield_generate_image");
			const input = {
				params: { count: 2, model: "seedream", prompt: "A product photo" },
			};

			await executeTool(tool, input, toolExecutionOptions("call-image-dup"));
			// Second delivery of the SAME tool call: the repository reports the
			// existing row; nothing is reserved or triggered again.
			connectorGenerationsRepository.insertAttempt.mockResolvedValueOnce({
				created: false,
				id: GENERATION_ATTEMPT_ID,
				status: "running",
			});
			const replay = await executeTool(
				tool,
				input,
				toolExecutionOptions("call-image-dup"),
			);

			expect(replay).toMatchObject({
				attemptId: GENERATION_ATTEMPT_ID,
				kind: "wandit_background_generation",
				status: "queued",
			});
			const [first, second] =
				connectorGenerationsRepository.insertAttempt.mock.calls;

			expect(first?.[0]).toMatchObject({
				chatId: CHAT_ID,
				requestKey: expect.stringMatching(/^[0-9a-f]{64}$/),
			});
			expect(second?.[0].requestKey).toBe(first?.[0].requestKey);
			expect(meteringService.reserveWithReplay).toHaveBeenCalledTimes(2);
			expect(triggerMocks.trigger).toHaveBeenCalledTimes(1);

			// A different tool call id is a different request.
			await executeTool(tool, input, toolExecutionOptions("call-image-other"));
			expect(
				connectorGenerationsRepository.insertAttempt.mock.calls[2]?.[0]
					.requestKey,
			).not.toBe(first?.[0].requestKey);
		});

		it("answers a replay of a failed request without re-reserving", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_image")] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			connectorGenerationsRepository.insertAttempt.mockResolvedValueOnce({
				created: false,
				id: GENERATION_ATTEMPT_ID,
				status: "failed",
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
				CHAT_ID,
			);

			const replay = (await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_image"),
				{ params: { count: 1, model: "seedream", prompt: "A product photo" } },
				toolExecutionOptions("call-image-failed"),
			)) as { isError: boolean };

			expect(replay.isError).toBe(true);
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(triggerMocks.trigger).not.toHaveBeenCalled();
		});

		it.each([
			"upscale_video",
			"reframe",
			"motion_control",
		])("queues enrolled video transform %s with video metering", async (toolName) => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition(toolName)] }));
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, `mcp_higgsfield_${toolName}`),
					{ params: { media_id: "media-1" } },
					toolExecutionOptions(`call-${toolName}`),
				),
			).resolves.toMatchObject({
				kind: "wandit_background_generation",
				status: "queued",
				tool: toolName,
			});
			expect(connectorGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
				expect.objectContaining({
					args: { params: { media_id: "media-1" } },
					toolName,
				}),
			);
			expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
				2,
				"video",
				{ actorUserId: USER_ID },
				expect.any(Object),
			);
			expect(triggerMocks.trigger).toHaveBeenCalledTimes(1);
		});

		it("rejects a one-line video prompt with intake guidance before any cost", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const {
				connectorGenerationsRepository,
				meteringService,
				promptRefiner,
				service,
			} = buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			const gateResult = (await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_video"),
				{ params: { prompt: "a serum ad" } },
				toolExecutionOptions("call-video-gated"),
			)) as { content: Array<{ text: string }>; isError: boolean };

			expect(gateResult.isError).toBe(true);
			expect(gateResult.content[0]?.text).toContain("creative-director intake");
			expect(promptRefiner.refineGenerationArgs).not.toHaveBeenCalled();
			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(triggerMocks.trigger).not.toHaveBeenCalled();
		});

		it("gates the video door the same way through run_platform_tool", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			const client = mockClient({
				definitions: [definition("generate_video")],
			});
			queueClient(client);
			const { connectorGenerationsRepository, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			const gateResult = (await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: { params: { prompt: "a serum ad" } },
					tool_name: "generate_video",
				},
				toolExecutionOptions("call-door-gated"),
			)) as { isError: boolean };

			expect(gateResult.isError).toBe(true);
			expect(client.callTool).not.toHaveBeenCalled();
			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
		});

		it("runs a get_cost preflight inline, unbilled, and unrefined", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			const costResult = { content: [{ text: '{"cost": 25}', type: "text" }] };
			const providerExecute = vi.fn(() => costResult);
			queueClient(
				mockClient({
					definitions: [definition("generate_video")],
					toolImplementations: {
						generate_video: executableTool(providerExecute),
					},
				}),
			);
			const {
				connectorGenerationsRepository,
				meteringService,
				promptRefiner,
				service,
			} = buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			const args = { params: { get_cost: true, prompt: "a serum ad" } };

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					args,
					toolExecutionOptions("call-cost-preflight"),
				),
			).resolves.toBe(costResult);
			expect(providerExecute).toHaveBeenCalledWith(args, expect.anything());
			expect(promptRefiner.refineGenerationArgs).not.toHaveBeenCalled();
			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(triggerMocks.trigger).not.toHaveBeenCalled();
		});

		it("runs a get_cost preflight through run_platform_tool without queueing", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			const client = mockClient({
				definitions: [definition("generate_video")],
			});
			queueClient(client);
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: { params: { get_cost: true, prompt: "a serum ad" } },
					tool_name: "generate_video",
				},
				toolExecutionOptions("call-door-cost"),
			);

			expect(client.callTool).toHaveBeenCalledWith({
				arguments: { params: { get_cost: true, prompt: "a serum ad" } },
				name: "generate_video",
			});
			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(triggerMocks.trigger).not.toHaveBeenCalled();
		});

		it("never gates an image-to-video call carrying reference media", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			// A short motion hint next to a start_image is animate-an-asset
			// territory — the creative-director gate must not demand a brief.
			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_video"),
					{
						params: {
							medias: [{ role: "start_image", value: "media-1" }],
							model: HIGGSFIELD_MULTISHOT_AUDIO_MODEL,
							prompt: "slow dolly push-in",
						},
					},
					toolExecutionOptions("call-video-medias"),
				),
			).resolves.toMatchObject({
				kind: "wandit_background_generation",
				status: "queued",
				tool: "generate_video",
			});
			expect(
				connectorGenerationsRepository.insertAttempt,
			).toHaveBeenCalledTimes(1);
		});

		it("skips billing for a get_cost preflight on an inline connector-only generation", async () => {
			const costResult = { content: [{ text: '{"cost": 9}', type: "text" }] };
			const providerExecute = vi.fn(() => costResult);
			queueClient(
				mockClient({
					definitions: [definition("generate_audio")],
					toolImplementations: {
						generate_audio: executableTool(providerExecute),
					},
				}),
			);
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			const args = { params: { get_cost: true, prompt: "an upbeat jingle" } };

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_generate_audio"),
					args,
					toolExecutionOptions("call-audio-cost"),
				),
			).resolves.toBe(costResult);
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
		});

		it("routes batch tools to the single-shot generations instead of running inline", async () => {
			const client = mockClient({
				definitions: [definition("generate_video")],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			const batchResult = (await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: { params: { prompts: ["a", "b"] } },
					tool_name: "generate_video_batch",
				},
				toolExecutionOptions("call-door-batch"),
			)) as { content: Array<{ text: string }>; isError: boolean };

			expect(batchResult.isError).toBe(true);
			expect(batchResult.content[0]?.text).toContain("generate_video");
			expect(client.callTool).not.toHaveBeenCalled();
		});

		it("passes the provider descriptions of intercepted higgsfield generations through unchanged", async () => {
			// DEMO-SAFE: Higgsfield's own descriptions carry the valid model
			// ids — a Wandit rewrite that drops them makes the chat model
			// invent ids and fail paid generations.
			queueClient(
				mockClient({
					definitions: [
						definition("generate_image"),
						definition("generate_video"),
					],
					toolImplementations: {
						generate_image: {
							...staticTool("generate_image"),
							description: "Provider description for generate_image",
						} as Tool,
						generate_video: {
							...staticTool("generate_video"),
							description: "Provider description for generate_video",
						} as Tool,
					},
				}),
			);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});

			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			const videoTool = requiredTool(
				result.tools,
				"mcp_higgsfield_generate_video",
			) as Tool & { description?: string };
			const imageTool = requiredTool(
				result.tools,
				"mcp_higgsfield_generate_image",
			) as Tool & { description?: string };

			expect(videoTool.description).toBe(
				"Provider description for generate_video",
			);
			expect(imageTool.description).toBe(
				"Provider description for generate_image",
			);
		});
	});

	describe("higgsfield upload surface redirect", () => {
		it("rejects media_upload_widget with media_import_url guidance, free", async () => {
			const providerExecute = vi.fn(() => ({
				content: [{ text: "widget", type: "text" }],
			}));
			queueClient(
				mockClient({
					definitions: [definition("media_upload_widget")],
					toolImplementations: {
						media_upload_widget: executableTool(providerExecute),
					},
				}),
			);
			const { connectorGenerationsRepository, meteringService, service } =
				buildService({
					connectors: [
						connector({
							slug: "higgsfield",
							toolPolicy: { allowlist: ["media_upload_widget"] },
						}),
					],
				});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			const redirect = (await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_media_upload_widget"),
				{ type: "image" },
				toolExecutionOptions("call-widget-redirect"),
			)) as { content: Array<{ text: string }>; isError: boolean };

			expect(redirect.isError).toBe(true);
			expect(redirect.content[0]?.text).toContain("media_import_url");
			expect(result.approvalMap).not.toHaveProperty(
				"mcp_higgsfield_media_upload_widget",
			);
			expect(providerExecute).not.toHaveBeenCalled();
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
			expect(
				connectorGenerationsRepository.insertAttempt,
			).not.toHaveBeenCalled();
		});

		it("rejects media_upload the same way through run_platform_tool", async () => {
			const client = mockClient({
				definitions: [definition("media_upload")],
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [
					connector({
						slug: "higgsfield",
						toolPolicy: { allowlist: ["media_upload"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);

			const redirect = (await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: { filename: "product.png" },
					tool_name: "media_upload",
				},
				toolExecutionOptions("call-door-upload"),
			)) as { content: Array<{ text: string }>; isError: boolean };

			expect(redirect.isError).toBe(true);
			expect(redirect.content[0]?.text).toContain("media_import_url");
			expect(client.callTool).not.toHaveBeenCalled();
		});

		it("still runs media_import_url inline against the provider", async () => {
			const importResult = {
				content: [{ text: '{"media_id": "media-9"}', type: "text" }],
			};
			const providerExecute = vi.fn(() => importResult);
			queueClient(
				mockClient({
					definitions: [definition("media_import_url")],
					toolImplementations: {
						media_import_url: executableTool(providerExecute),
					},
				}),
			);
			const { meteringService, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			const args = { type: "image", url: "https://pub.r2.dev/uploads/a.png" };

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_media_import_url"),
					args,
					toolExecutionOptions("call-import-url"),
				),
			).resolves.toBe(importResult);
			expect(providerExecute).toHaveBeenCalledWith(args, expect.anything());
			expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		});
	});

	describe("higgsfield prompt refinement", () => {
		it("sends the refined arguments to the provider for an inline image generation", async () => {
			const providerExecute = vi.fn((_input: unknown) => ({
				content: [{ text: "ok", type: "text" }],
			}));
			queueClient(
				mockClient({
					definitions: [definition("generate_image")],
					toolImplementations: {
						generate_image: executableTool(providerExecute),
					},
				}),
			);
			const { promptRefiner, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			promptRefiner.refineGenerationArgs.mockResolvedValue({
				params: { model: "seedream", prompt: "refined prompt" },
			});

			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_image"),
				{ params: { model: "seedream", prompt: "a vase" } },
				toolExecutionOptions("call-refined-image"),
			);

			expect(promptRefiner.refineGenerationArgs).toHaveBeenCalledWith({
				args: { params: { model: "seedream", prompt: "a vase" } },
				organizationId: null,
				parentEventId: "chat-event",
				toolName: "generate_image",
				userId: USER_ID,
			});
			expect(providerExecute.mock.calls[0]?.[0]).toEqual({
				params: {
					model: "seedream",
					prompt: "refined prompt",
					use_unlim: false,
				},
			});
		});

		it("persists the refined arguments when a video generation is queued", async () => {
			(env as typeof env & { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
				"tr_test";
			queueClient(mockClient({ definitions: [definition("generate_video")] }));
			const { connectorGenerationsRepository, promptRefiner, service } =
				buildService({ connectors: [connector({ slug: "higgsfield" })] });
			promptRefiner.refineGenerationArgs.mockResolvedValue({
				params: { prompt: "refined film" },
			});

			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_video"),
				{
					params: {
						prompt:
							"SUBJECT: a serum bottle on marble. KEY MOMENT: one drop lands and settles.",
					},
				},
				toolExecutionOptions("call-refined-video"),
			);

			expect(promptRefiner.refineGenerationArgs).toHaveBeenCalledWith(
				expect.objectContaining({ toolName: "generate_video" }),
			);
			// Reserve-before-refine: the attempt row is inserted with the original
			// arguments and the refined ones travel in the Trigger payload (the
			// task's claim persists them on the row).
			expect(connectorGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
				expect.objectContaining({
					args: {
						params: {
							prompt:
								"SUBJECT: a serum bottle on marble. KEY MOMENT: one drop lands and settles.",
							use_unlim: false,
						},
					},
				}),
			);
			expect(triggerMocks.trigger).toHaveBeenCalledWith(
				"run-connector-generation",
				expect.objectContaining({
					args: { params: { prompt: "refined film", use_unlim: false } },
				}),
				expect.anything(),
			);
		});

		it("refines a generation reached through run_platform_tool", async () => {
			const client = mockClient({
				definitions: [definition("generate_image")],
			});
			queueClient(client);
			const { promptRefiner, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			promptRefiner.refineGenerationArgs.mockResolvedValue({
				params: { model: "seedream", prompt: "refined prompt" },
			});

			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: { params: { model: "seedream", prompt: "a vase" } },
					tool_name: "generate_image",
				},
				toolExecutionOptions("call-door-image"),
			);

			expect(promptRefiner.refineGenerationArgs).toHaveBeenCalledWith({
				args: { params: { model: "seedream", prompt: "a vase" } },
				organizationId: null,
				parentEventId: "chat-event",
				toolName: "generate_image",
				userId: USER_ID,
			});
			expect(client.callTool).toHaveBeenCalledWith({
				arguments: {
					params: {
						model: "seedream",
						prompt: "refined prompt",
						use_unlim: false,
					},
				},
				name: "generate_image",
			});
		});

		it("leaves other connectors' generations unrefined through the door", async () => {
			queueClient(mockClient({ definitions: [definition("generate_image")] }));
			queueClient(mockClient({ definitions: [definition("generate_image")] }));
			const { promptRefiner, service } = buildService({
				connections: [
					connection(),
					connection({
						connectorId: OTHER_CONNECTOR_ID,
						id: OTHER_CONNECTION_ID,
					}),
				],
				connectors: [
					connector({ slug: "tiktok-ads" }),
					connector({
						id: OTHER_CONNECTOR_ID,
						name: "Meta Ads",
						slug: "meta-ads",
					}),
				],
			});

			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "tiktok-ads",
					params: { params: { prompt: "a vase" } },
					tool_name: "generate_image",
				},
				toolExecutionOptions("call-door-tiktok"),
			);
			await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "meta-ads",
					params: { params: { prompt: "a vase" } },
					tool_name: "generate_image",
				},
				toolExecutionOptions("call-door-meta"),
			);

			expect(promptRefiner.refineGenerationArgs).not.toHaveBeenCalled();
		});

		it("leaves other Higgsfield tools unrefined", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("generate_audio"),
						definition("models_explore"),
					],
					toolImplementations: {
						generate_audio: executableTool(),
						models_explore: executableTool(),
					},
				}),
			);
			const { promptRefiner, service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});

			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID },
				"chat-event",
			);
			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_models_explore"),
				{ query: "video models" },
				toolExecutionOptions("call-models-explore"),
			);
			await executeTool(
				requiredTool(result.tools, "mcp_higgsfield_generate_audio"),
				{ params: { prompt: "a jingle" } },
				toolExecutionOptions("call-audio"),
			);

			expect(promptRefiner.refineGenerationArgs).not.toHaveBeenCalled();
		});
	});

	describe("connector operation events", () => {
		it("records successful ads reads and writes with canonical names and correlation", async () => {
			queueClient(
				mockClient({
					definitions: [
						definition("ads_get_ad_accounts"),
						definition("campaign_create"),
					],
					toolImplementations: {
						ads_get_ad_accounts: executableTool(() => ({ accounts: [] })),
						campaign_create: executableTool(() => ({ id: "campaign-1" })),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({
						toolPolicy: {
							allowlist: ["ads_get_ad_accounts", "campaign_create"],
						},
					}),
				],
			});
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID, organizationId: "organization-1" },
				"usage-event-1",
			);

			await executeTool(
				requiredTool(result.tools, "mcp_meta-ads_ads_get_ad_accounts"),
				{},
			);
			await executeTool(
				requiredTool(result.tools, "mcp_meta-ads_campaign_create"),
				{},
			);

			expect(connectorOperationEventsRepository.insert).toHaveBeenNthCalledWith(
				1,
				{
					connectorSlug: "meta-ads",
					durationMs: expect.any(Number),
					errorCode: null,
					errorMessage: null,
					feature: "ads_analysis",
					organizationId: "organization-1",
					parentEventId: "usage-event-1",
					status: "succeeded",
					targetEntityIds: null,
					toolName: "ads_get_ad_accounts",
					userId: USER_ID,
				},
			);
			expect(connectorOperationEventsRepository.insert).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					connectorSlug: "meta-ads",
					feature: "ads_launch",
					status: "succeeded",
					toolName: "campaign_create",
				}),
			);
		});

		it("classifies non-ads connector executions as other", async () => {
			queueClient(
				mockClient({
					definitions: [definition("customer_get")],
					toolImplementations: {
						customer_get: executableTool(() => ({ customer: null })),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({ name: "CRM", slug: "future-crm", toolPolicy: null }),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_future-crm_customer_get"),
				{},
			);

			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					feature: "other",
					toolName: "customer_get",
				}),
			);
		});

		it("records returned MCP errors and thrown provider failures without changing their outcome", async () => {
			const thrown = Object.assign(
				new Error("Bearer provider-token owner@example.com"),
				{ code: "UPSTREAM_FAILURE" },
			);
			const returned = {
				content: [{ text: "access_token=provider-token", type: "text" }],
				isError: true,
			};
			queueClient(
				mockClient({
					definitions: [
						definition("campaign_get"),
						definition("campaign_create"),
					],
					toolImplementations: {
						campaign_create: executableTool(() => {
							throw thrown;
						}),
						campaign_get: executableTool(() => returned),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({
						toolPolicy: {
							allowlist: ["campaign_get", "campaign_create"],
						},
					}),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_get"),
					{},
				),
			).resolves.toBe(returned);
			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_create"),
					{},
				),
			).rejects.toBe(thrown);

			expect(connectorOperationEventsRepository.insert).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					errorCode: null,
					errorMessage: "Provider tool execution failed",
					feature: "ads_analysis",
					status: "failed",
				}),
			);
			expect(connectorOperationEventsRepository.insert).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					errorCode: "UPSTREAM_FAILURE",
					errorMessage: "Provider tool execution failed",
					feature: "ads_launch",
					status: "failed",
				}),
			);
		});

		it("records every retried provider attempt with its own duration and outcome", async () => {
			const readExecute = vi
				.fn()
				.mockRejectedValueOnce(transientError({ statusCode: 503 }))
				.mockRejectedValueOnce(transientError({ code: "ETIMEDOUT" }))
				.mockResolvedValueOnce({ ok: true });
			queueClient(
				mockClient({
					definitions: [definition("campaign_get")],
					toolImplementations: {
						campaign_get: executableTool(readExecute),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({ toolPolicy: { allowlist: ["campaign_get"] } }),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			vi.useFakeTimers();

			const execution = executeTool(
				requiredTool(result.tools, "mcp_meta-ads_campaign_get"),
				{},
			);
			await vi.advanceTimersByTimeAsync(1_250);

			await expect(execution).resolves.toEqual({ ok: true });
			expect(readExecute).toHaveBeenCalledTimes(3);
			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledTimes(
				3,
			);
			expect(
				connectorOperationEventsRepository.insert.mock.calls.map(
					([event]) => event.status,
				),
			).toEqual(["failed", "failed", "succeeded"]);
			for (const [event] of connectorOperationEventsRepository.insert.mock
				.calls) {
				expect(event.durationMs).toBeLessThan(250);
			}
		});

		it("preserves the provider failure when error fields have hostile getters", async () => {
			const providerFailure = Object.defineProperty({}, "code", {
				get() {
					throw new Error("hostile getter");
				},
			});
			queueClient(
				mockClient({
					definitions: [definition("campaign_create")],
					toolImplementations: {
						campaign_create: executableTool(() => {
							throw providerFailure;
						}),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({ toolPolicy: { allowlist: ["campaign_create"] } }),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_create"),
					{},
				),
			).rejects.toBe(providerFailure);
			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					errorCode: null,
					errorMessage: "Provider tool execution failed",
					status: "failed",
				}),
			);
		});

		it("does not await or surface an analytics insert failure", async () => {
			const pendingInsert = deferred<void>();
			queueClient(
				mockClient({
					definitions: [definition("ads_get_ad_accounts")],
					toolImplementations: {
						ads_get_ad_accounts: executableTool(() => ({ accounts: [] })),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService();
			connectorOperationEventsRepository.insert.mockReturnValueOnce(
				pendingInsert.promise,
			);
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_ads_get_ad_accounts"),
					{},
				),
			).resolves.toEqual({ accounts: [] });
			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledOnce();

			pendingInsert.reject(new Error("analytics database unavailable"));
			await vi.waitFor(() => {
				expect(
					connectorOperationEventsRepository.insert,
				).toHaveBeenCalledOnce();
			});
		});

		it("does not record when provider execution never starts", async () => {
			const providerExecute = vi.fn();
			queueClient(
				mockClient({
					definitions: [definition("campaign_create")],
					toolImplementations: {
						campaign_create: executableTool(providerExecute),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: ["campaign_create"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			const campaignCreateApproval =
				result.approvalMap["mcp_meta-ads_campaign_create"];

			expect(campaignCreateApproval).toBeTypeOf("function");
			if (typeof campaignCreateApproval !== "function") {
				throw new Error("Expected a call-time approval function");
			}
			// Status-less create may go live on the platform default — carded;
			// an explicitly paused create is a free build step.
			expect(campaignCreateApproval({})).toBe("user-approval");
			expect(campaignCreateApproval({ status: "PAUSED" })).toBe(
				"not-applicable",
			);
			await expect(
				executeTool(requiredTool(result.tools, "run_platform_tool"), {
					connector: "meta-ads",
					params: {},
					tool_name: "missing_tool",
				}),
			).resolves.toMatchObject({ isError: true });
			expect(providerExecute).not.toHaveBeenCalled();
			expect(connectorOperationEventsRepository.insert).not.toHaveBeenCalled();
		});

		it("does not record an argument rejection before the provider call", async () => {
			const providerExecute = vi.fn();
			queueClient(
				mockClient({
					definitions: [definition("campaign_create")],
					toolImplementations: {
						campaign_create: executableTool(providerExecute),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({
						toolPolicy: { allowlist: ["campaign_create"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_create"),
					{ params: { budget: "3000 DZD" } },
				),
			).rejects.toThrow(/must be in USD/);
			expect(providerExecute).not.toHaveBeenCalled();
			expect(connectorOperationEventsRepository.insert).not.toHaveBeenCalled();
		});
	});

	describe("ads change window", () => {
		function adsWriteSetup(lastWriteAt: Date | null) {
			queueClient(
				mockClient({
					definitions: [
						definition("update_adset"),
						definition("create_campaign"),
						definition("get_adset"),
					],
					toolImplementations: {
						create_campaign: executableTool(() => ({ id: "campaign-1" })),
						get_adset: executableTool(() => ({ id: "adset-1" })),
						update_adset: executableTool(() => ({ success: true })),
					},
				}),
			);
			const built = buildService({
				connectors: [
					connector({
						toolPolicy: {
							allowlist: ["update_adset", "create_campaign", "get_adset"],
						},
					}),
				],
			});
			built.connectorOperationEventsRepository.findLatestWriteAt.mockResolvedValue(
				lastWriteAt,
			);
			return built;
		}

		it("blocks a write on a recently changed entity once, then lets the insisted retry through", async () => {
			const lastWriteAt = new Date(Date.now() - 10 * 3_600_000);
			const { connectorOperationEventsRepository, service } =
				adsWriteSetup(lastWriteAt);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID, organizationId: "organization-1" },
				"usage-event-1",
			);
			const tool = requiredTool(result.tools, "mcp_meta-ads_update_adset");

			const blocked = await executeTool(tool, {
				adset_id: "adset-1",
				status: "PAUSED",
			});

			expect(blocked).toMatchObject({ isError: true });
			expect(JSON.stringify(blocked)).toContain("Wandit change window");
			expect(JSON.stringify(blocked)).toContain("this ad set was created");
			expect(
				connectorOperationEventsRepository.findLatestWriteAt,
			).toHaveBeenCalledWith({
				connectorSlug: "meta-ads",
				organizationId: "organization-1",
				targetEntityIds: ["adset-1"],
				userId: USER_ID,
			});
			expect(connectorOperationEventsRepository.insert).not.toHaveBeenCalled();

			const allowed = await executeTool(tool, {
				adset_id: "adset-1",
				status: "PAUSED",
			});

			expect(allowed).toEqual({ success: true });
			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					connectorSlug: "meta-ads",
					feature: "ads_launch",
					status: "succeeded",
					targetEntityIds: ["adset-1"],
					toolName: "update_adset",
				}),
			);

			// The acknowledgement is consumed: a third call is blocked again.
			// (A pure ACTIVATION would be exempt from the window — this stays a
			// pause, the guarded direction.)
			const blockedAgain = await executeTool(tool, {
				adset_id: "adset-1",
				status: "PAUSED",
			});
			expect(blockedAgain).toMatchObject({ isError: true });
		});

		it("never blocks creates or reads and skips the lookup for them", async () => {
			const { connectorOperationEventsRepository, service } = adsWriteSetup(
				new Date(Date.now() - 3_600_000),
			);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID, organizationId: "organization-1" },
				"usage-event-1",
			);

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_create_campaign"),
					{
						campaign_id: "campaign-1",
					},
				),
			).resolves.toEqual({ id: "campaign-1" });
			await expect(
				executeTool(requiredTool(result.tools, "mcp_meta-ads_get_adset"), {
					adset_id: "adset-1",
				}),
			).resolves.toEqual({ id: "adset-1" });
			expect(
				connectorOperationEventsRepository.findLatestWriteAt,
			).not.toHaveBeenCalled();
			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					targetEntityIds: ["campaign-1"],
					toolName: "create_campaign",
				}),
			);
		});

		it("records the created entity id from the provider result when the create args carry none", async () => {
			queueClient(
				mockClient({
					definitions: [definition("ads_create_campaign")],
					toolImplementations: {
						ads_create_campaign: executableTool(() => ({
							content: [
								{ text: JSON.stringify({ id: "new-1" }), type: "text" },
							],
						})),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({ toolPolicy: { allowlist: ["ads_create_campaign"] } }),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_meta-ads_ads_create_campaign"),
				{ name: "Launch", objective: "OUTCOME_SALES" },
			);

			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					feature: "ads_launch",
					status: "succeeded",
					targetEntityIds: ["new-1"],
					toolName: "ads_create_campaign",
				}),
			);
		});

		it("records the created child id, never the parent id from the create args", async () => {
			// A child create resets nothing on its parent: recording the parent
			// would falsely arm the 72 h window against later legitimate edits.
			queueClient(
				mockClient({
					definitions: [definition("adgroup_create")],
					toolImplementations: {
						adgroup_create: executableTool(() => ({
							content: [
								{
									text: JSON.stringify({
										code: 0,
										data: { adgroup_id: "adgroup-9" },
									}),
									type: "text",
								},
							],
						})),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({
						slug: "tiktok-ads",
						toolPolicy: { allowlist: ["adgroup_create"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_tiktok-ads_adgroup_create"),
				{ campaign_id: "campaign-C", operation_status: "DISABLE" },
			);

			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "succeeded",
					targetEntityIds: ["adgroup-9"],
					toolName: "adgroup_create",
				}),
			);
		});

		it("scopes the lookup to the personal space when the actor has no organization", async () => {
			const { connectorOperationEventsRepository, service } =
				adsWriteSetup(null);
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_meta-ads_update_adset"),
				{
					adset_id: "adset-1",
				},
			);

			expect(
				connectorOperationEventsRepository.findLatestWriteAt,
			).toHaveBeenCalledWith({
				connectorSlug: "meta-ads",
				organizationId: null,
				targetEntityIds: ["adset-1"],
				userId: USER_ID,
			});
		});

		it("does not let a different operation consume the acknowledgement", async () => {
			const { service } = adsWriteSetup(new Date(Date.now() - 3_600_000));
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			const tool = requiredTool(result.tools, "mcp_meta-ads_update_adset");

			await expect(
				executeTool(tool, { adset_id: "adset-1", status: "PAUSED" }),
			).resolves.toMatchObject({ isError: true });
			// Same entity, same operation name, other payload: the acknowledgement
			// is keyed on entity + operation, so this repeat passes.
			await expect(
				executeTool(tool, { adset_id: "adset-1", status: "ACTIVE" }),
			).resolves.toEqual({ success: true });
			// A different entity set is a different key: blocked afresh.
			await expect(
				executeTool(tool, { adset_ids: ["adset-1", "adset-2"] }),
			).resolves.toMatchObject({ isError: true });
		});

		it("guards and records TikTok hidden bulk operations on the params the provider sees", async () => {
			const client = mockClient({
				callTool: (input) => {
					const call = input as { name: string };
					if (call.name === "tool_list") {
						return {
							content: [
								{
									text: JSON.stringify([
										{
											description: "Enable or disable ad groups",
											tool_name: "adgroup/status/update/",
										},
									]),
									type: "text",
								},
							],
						};
					}
					return {
						content: [
							{ text: JSON.stringify({ code: 0, data: {} }), type: "text" },
						],
					};
				},
				definitions: [
					definition("tool_execute"),
					definition("tool_get"),
					definition("tool_list"),
				],
			});
			queueClient(client);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [connector({ slug: "tiktok-ads" })],
			});
			connectorOperationEventsRepository.findLatestWriteAt.mockResolvedValue(
				new Date(Date.now() - 3_600_000),
			);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID, organizationId: "organization-1" },
				"usage-event-1",
			);
			const params = {
				adgroup_ids: ["777", "778"],
				advertiser_id: "adv-1",
				operation_status: "DISABLE",
			};

			const blocked = await executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "tiktok-ads",
					params,
					tool_name: "adgroup/status/update/",
				},
			);

			expect(blocked).toMatchObject({ isError: true });
			expect(JSON.stringify(blocked)).toContain("777, 778");
			expect(
				connectorOperationEventsRepository.findLatestWriteAt,
			).toHaveBeenCalledWith({
				connectorSlug: "tiktok-ads",
				organizationId: "organization-1",
				targetEntityIds: ["777", "778"],
				userId: USER_ID,
			});

			await executeTool(requiredTool(result.tools, "run_platform_tool"), {
				connector: "tiktok-ads",
				params,
				tool_name: "adgroup/status/update/",
			});

			expect(client.callTool).toHaveBeenLastCalledWith({
				arguments: { params, tool_name: "adgroup/status/update/" },
				name: "tool_execute",
			});
			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					connectorSlug: "tiktok-ads",
					feature: "ads_launch",
					status: "succeeded",
					targetEntityIds: ["777", "778"],
					toolName: "adgroup/status/update/",
				}),
			);
		});

		it("records a Meta platform error as failed without target ids", async () => {
			queueClient(
				mockClient({
					definitions: [definition("ads_update_campaign")],
					toolImplementations: {
						ads_update_campaign: executableTool(() => ({
							content: [
								{
									text: JSON.stringify({
										error: { code: 100, message: "Invalid parameter" },
									}),
									type: "text",
								},
							],
						})),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({ toolPolicy: { allowlist: ["ads_update_campaign"] } }),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_meta-ads_ads_update_campaign"),
				{ campaign_id: "c-1", status: "PAUSED" },
			);

			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					connectorSlug: "meta-ads",
					errorCode: "100",
					errorMessage: "Provider tool execution failed",
					status: "failed",
					targetEntityIds: null,
					toolName: "ads_update_campaign",
				}),
			);
		});

		it("records a TikTok non-zero code as failed without target ids", async () => {
			queueClient(
				mockClient({
					definitions: [definition("tool_execute")],
					toolImplementations: {
						tool_execute: executableTool(() => ({
							content: [
								{
									text: JSON.stringify({ code: 40002, message: "Bad budget" }),
									type: "text",
								},
							],
						})),
					},
				}),
			);
			const { connectorOperationEventsRepository, service } = buildService({
				connectors: [
					connector({
						slug: "tiktok-ads",
						toolPolicy: { allowlist: ["tool_execute"] },
					}),
				],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await executeTool(
				requiredTool(result.tools, "mcp_tiktok-ads_tool_execute"),
				{
					params: { adgroup_id: "777", budget: 20 },
					tool_name: "adgroup/budget/update/",
				},
			);

			expect(connectorOperationEventsRepository.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					connectorSlug: "tiktok-ads",
					errorCode: "40002",
					feature: "ads_launch",
					status: "failed",
					targetEntityIds: null,
					toolName: "adgroup/budget/update/",
				}),
			);
		});

		it("lets a write through when Wandit never touched the entity or the window elapsed", async () => {
			const { connectorOperationEventsRepository, service } =
				adsWriteSetup(null);
			const result = await service.resolveToolsForUser(
				{ actorUserId: USER_ID, organizationId: "organization-1" },
				"usage-event-1",
			);
			const tool = requiredTool(result.tools, "mcp_meta-ads_update_adset");

			await expect(executeTool(tool, { adset_id: "adset-1" })).resolves.toEqual(
				{ success: true },
			);

			connectorOperationEventsRepository.findLatestWriteAt.mockResolvedValue(
				new Date(Date.now() - 80 * 3_600_000),
			);
			await expect(executeTool(tool, { adset_id: "adset-1" })).resolves.toEqual(
				{ success: true },
			);
		});

		it("reports connected slugs on the result", async () => {
			const { service } = adsWriteSetup(null);
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			expect(result.connectedSlugs).toEqual(["meta-ads"]);
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

			const resultPromise = service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

		it("retries only read Marketing Studio actions through namespaced and door paths", async () => {
			let directListAttempts = 0;
			const directExecute = vi.fn((input: unknown) => {
				const action = (input as { action?: string }).action;
				if (action === "create") {
					throw transientError({ statusCode: 503 });
				}
				if (action === "list" && directListAttempts++ === 0) {
					throw transientError({ code: "ECONNRESET" });
				}
				return { ok: "direct-list" };
			});
			let doorListAttempts = 0;
			const client = mockClient({
				callTool: (rawInput) => {
					const action = (rawInput as { arguments: { action?: string } })
						.arguments.action;
					if (action === "create") {
						throw transientError({ statusCode: 502 });
					}
					if (action === "list" && doorListAttempts++ === 0) {
						throw transientError({ code: "ETIMEDOUT" });
					}
					return { content: [], isError: false };
				},
				definitions: [definition("show_marketing_studio")],
				toolImplementations: {
					show_marketing_studio: executableTool(directExecute),
				},
			});
			queueClient(client);
			const { service } = buildService({
				connectors: [connector({ slug: "higgsfield" })],
			});
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			vi.useFakeTimers();

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_higgsfield_show_marketing_studio"),
					{ action: "create", type: "product" },
				),
			).rejects.toMatchObject({ statusCode: 503 });
			expect(directExecute).toHaveBeenCalledTimes(1);

			const directList = executeTool(
				requiredTool(result.tools, "mcp_higgsfield_show_marketing_studio"),
				{ action: "list", type: "product" },
			);
			await vi.advanceTimersByTimeAsync(250);
			await expect(directList).resolves.toEqual({ ok: "direct-list" });
			expect(directExecute).toHaveBeenCalledTimes(3);

			await expect(
				executeTool(requiredTool(result.tools, "run_platform_tool"), {
					connector: "higgsfield",
					params: { action: "create", type: "product" },
					tool_name: "show_marketing_studio",
				}),
			).rejects.toMatchObject({ statusCode: 502 });
			expect(client.callTool).toHaveBeenCalledTimes(1);

			const doorList = executeTool(
				requiredTool(result.tools, "run_platform_tool"),
				{
					connector: "higgsfield",
					params: { action: "list", type: "product" },
					tool_name: "show_marketing_studio",
				},
			);
			await vi.advanceTimersByTimeAsync(250);
			await expect(doorList).resolves.toMatchObject({ isError: false });
			expect(client.callTool).toHaveBeenCalledTimes(3);
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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

			await expect(
				executeTool(
					requiredTool(result.tools, "mcp_meta-ads_campaign_get"),
					{},
				),
			).rejects.toBe(applicationFailure);
			expect(execute).toHaveBeenCalledTimes(1);
		});

		it("normalizes string params on ads tool_execute so the guards see the real arguments", async () => {
			const execute = vi.fn().mockResolvedValue({ ok: true });
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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			const tool = requiredTool(result.tools, "mcp_tiktok-ads_tool_execute");

			// A dinar budget hidden inside a JSON-string params must still hit
			// the USD guard — the string is parsed before the choke point.
			await expect(
				executeTool(tool, {
					params: '{"adgroup_id":"9","budget":"3000 DA"}',
					tool_name: "adgroup_update",
				}),
			).rejects.toThrow(/USD/);
			expect(execute).not.toHaveBeenCalled();

			// An unparseable string params never reaches the provider.
			const rejected = await executeTool(tool, {
				params: "not json at all",
				tool_name: "adgroup_update",
			});
			expect(rejected).toMatchObject({ isError: true });
			expect(execute).not.toHaveBeenCalled();
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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			const approval = result.approvalMap["mcp_tiktok-ads_tool_execute"];

			expect(approval).toBeTypeOf("function");
			if (typeof approval !== "function") {
				throw new Error("Expected a call-time approval function");
			}
			expect(approval({ tool_name: "campaign_get" })).toBe("not-applicable");
			expect(approval({ tool_name: "campaign_create" })).toBe("user-approval");
			expect(
				approval({
					params: { operation_status: "DISABLE" },
					tool_name: "campaign_create",
				}),
			).toBe("not-applicable");
			expect(
				approval({
					params: { budgets: [{ adgroup_id: "9", budget: 80 }] },
					tool_name: "adgroup_budget_update",
				}),
			).toBe("user-approval");
			// A JSON-string params must not blind the walk: it is parsed, and
			// an unparseable one fails closed.
			expect(
				approval({
					params: '{"adgroup_ids":["123"],"operation_status":"ENABLE"}',
					tool_name: "adgroup_status_update",
				}),
			).toBe("user-approval");
			expect(
				approval({
					params: '{"operation_status":"DISABLE"}',
					tool_name: "campaign_create",
				}),
			).toBe("not-applicable");
			expect(
				approval({ params: "not json at all", tool_name: "campaign_update" }),
			).toBe("user-approval");
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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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
			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			await service.resolveToolsForUser({ actorUserId: USER_ID });

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const result = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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

			const firstResult = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
			await firstResult.close();
			const currentResult = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});
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

			await service.resolveToolsForUser({ actorUserId: USER_ID });
			const secondResult = await service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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
			const resultPromise = service.resolveToolsForUser({
				actorUserId: USER_ID,
			});

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
				"The user's Meta Ads connection could not be used (connector unreachable). If the user asks for ANYTHING that needs this connector (a generation, a report…), say plainly that it is temporarily unavailable right now and to try again shortly — never announce or pretend to start that work. You may offer to make the whole video with Wandit's own generator instead, but only as an explicit user-approved switch.",
			]);
			expect(client.close).toHaveBeenCalledTimes(1);
			expect(client.listTools).not.toHaveBeenCalled();
			expect(client.toolsFromDefinitions).not.toHaveBeenCalled();
		});
	});
});
