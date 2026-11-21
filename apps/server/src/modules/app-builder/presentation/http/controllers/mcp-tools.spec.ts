import {
	createMcpHandler,
	isCallToolResult,
	isJSONRPCResultResponse,
	parseJSONRPCMessage,
} from "@modelcontextprotocol/server";
import {
	type AppBuild,
	type McpScope,
	mcpScopes,
	mcpToolErrorSchema,
	uuidSchema,
} from "@wandit/contracts";
import { afterAll, describe, expect, it } from "vitest";
import type { ChatsRepository } from "../../../../generation/infrastructure/persistence/chats.repository";
// The real role rule of `ProjectAccessService.resolve`, so each case states facts, not a role.
import {
	type ProjectAccessFacts,
	type ProjectAccessService,
	resolveProjectAccess,
} from "../../../../projects";
import type { AppProjectsService } from "../../../application/services/app-projects.service";
import type { TurnsService } from "../../../application/services/turns.service";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../../infrastructure/persistence/builder-turns.repository";
import type { RateLimitStore } from "../guards/redis-rate-limit.guard";
import { type McpCallContext, McpTools } from "./mcp-tools";

const CALL: McpCallContext = {
	clientId: "https://claude.ai/oauth/claude-code-client-metadata",
	clientIp: "203.0.113.7",
	trustedClientIp: null,
	userId: "user-1",
};

const OWN_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FOREIGN_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const VIEWER_PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const OUTSIDER_PROJECT_ID = "55555555-5555-4555-8555-555555555555";
const V1_PROJECT_ID = "66666666-6666-4666-8666-666666666666";
const RESTRICTED_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHARED_PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** The facts of one project for user-1, without the id: the map key gives it. */
type ProjectFacts = Omit<ProjectAccessFacts, "id">;

/** The default is a personal project of user-2 without a grant. */
function factsOf(facts: Partial<ProjectFacts>): ProjectFacts {
	return {
		directRole: null,
		engine: "v2_app",
		memberRole: null,
		organizationId: null,
		userId: "user-2",
		workspaceAccess: "can_edit",
		workspaceId: "org-personal-2",
		workspaceName: "User 2's workspace",
		workspacePersonalOwnerUserId: "user-2",
		...facts,
	};
}

// user-1 is a workspace Editor (`member`) of "org-team". A team project uses the team's row.
const TEAM_FACTS = {
	memberRole: "member",
	organizationId: "org-team",
	workspaceId: "org-team",
	workspaceName: "Team",
	workspacePersonalOwnerUserId: null,
} satisfies Partial<ProjectFacts>;

// A personal project of user-1.
const OWN_FACTS = factsOf({
	memberRole: "owner",
	userId: "user-1",
	workspaceId: "org-personal-1",
	workspacePersonalOwnerUserId: "user-1",
});

const FACTS = new Map<string, ProjectFacts>([
	[OWN_PROJECT_ID, OWN_FACTS],
	[FOREIGN_PROJECT_ID, factsOf({})],
	[TEAM_PROJECT_ID, factsOf(TEAM_FACTS)],
	// A workspace Editor on a "Can view" project is a project viewer.
	[VIEWER_PROJECT_ID, factsOf({ ...TEAM_FACTS, workspaceAccess: "can_view" })],
	[
		OUTSIDER_PROJECT_ID,
		factsOf({
			organizationId: "org-outsider",
			workspaceId: "org-outsider",
			workspacePersonalOwnerUserId: null,
		}),
	],
	[
		V1_PROJECT_ID,
		factsOf({
			engine: "v1_page",
			memberRole: "owner",
			userId: "user-1",
			workspaceId: "org-personal-1",
			workspacePersonalOwnerUserId: "user-1",
		}),
	],
	[
		RESTRICTED_PROJECT_ID,
		factsOf({ ...TEAM_FACTS, workspaceAccess: "restricted" }),
	],
	// A direct "Can edit" grant on another user's personal project, without a workspace membership.
	[SHARED_PROJECT_ID, factsOf({ directRole: "editor" })],
]);

// The member rows of user-1 that `findMembership` answers, by workspace id.
const MEMBERSHIPS = new Map([
	[
		"org-team",
		{ organizationId: "org-team", personalOwnerUserId: null, role: "member" },
	],
	[
		"org-viewer",
		{ organizationId: "org-viewer", personalOwnerUserId: null, role: "viewer" },
	],
]);

const BUILD: AppBuild = {
	commitSha: "a".repeat(40),
	completedAt: null,
	createdAt: "2026-11-04T10:00:00.000Z",
	errorCode: null,
	gateFindings: [],
	gateOverride: false,
	id: "77777777-7777-4777-8777-777777777777",
	projectId: TEAM_PROJECT_ID,
	sourceBuildId: null,
	status: "queued",
};

// A case that reaches a dependency it must not reach answers INTERNAL_ERROR, not its expected outcome.
function notReached(): Promise<never> {
	return Promise.reject(new Error("This case must not reach this dependency"));
}

/** The fakes that one case replaces. The others reject or answer a fixed value. */
type ToolFakes = {
	access?: Pick<ProjectAccessService, "resolve">;
	appProjects?: Pick<AppProjectsService, "get" | "create">;
	chats?: Pick<
		ChatsRepository,
		"findAccessibleChatByProjectId" | "listProjectChats" | "listFirstTexts"
	>;
	turns?: Pick<TurnsService, "create" | "cancel" | "assertStreamAccess">;
	turnRows?: Pick<
		BuilderTurnsRepository,
		"findBusyChatId" | "findCardParts" | "findByRequestKey"
	>;
	rateLimits?: RateLimitStore;
};

function toolsWith(fakes: ToolFakes = {}): McpTools {
	return new McpTools(
		fakes.access ?? {
			resolve: async (userId, projectId) => {
				const facts = FACTS.get(projectId);
				return facts === undefined || userId !== CALL.userId
					? null
					: resolveProjectAccess({ ...facts, id: projectId }, userId);
			},
		},
		// user-1 is an Editor of "org-team" and a Viewer of "org-viewer". Other workspaces have no member row.
		{
			findMembership: async (organizationId) =>
				MEMBERSHIPS.get(organizationId) ?? null,
		},
		{ listForUser: notReached },
		{ list: notReached, listShared: notReached },
		fakes.chats ?? {
			findAccessibleChatByProjectId: notReached,
			listFirstTexts: notReached,
			listProjectChats: notReached,
		},
		// A gate case that reaches the create answers INTERNAL_ERROR, so it proves that no project and no credit hold exist.
		fakes.appProjects ?? { create: notReached, get: notReached },
		{ file: notReached, snapshot: notReached },
		{ list: async () => ({ items: [], nextCursor: null }) },
		fakes.turns ?? {
			assertStreamAccess: notReached,
			cancel: notReached,
			create: notReached,
		},
		fakes.turnRows ?? {
			findBusyChatId: notReached,
			findByRequestKey: notReached,
			findCardParts: notReached,
		},
		{ wake: async () => ({ status: "running" }) },
		{
			apply: async () => ({ headSha: "c".repeat(40) }),
			sandboxHead: notReached,
		},
		{ publishHead: async () => BUILD, status: notReached },
		{ record: async () => {} },
		fakes.rateLimits ?? {
			hit: async () => ({ count: 1, ttlMs: 600_000 }),
			release: async () => {},
		},
	);
}

// The controller builds one handler for each POST. Each handler prints a console.warn, so this file builds few.
function handlerFor(
	tools: McpTools,
	call: McpCallContext = CALL,
): ReturnType<typeof createMcpHandler> {
	return createMcpHandler(() => tools.createServer(call), {
		legacy: "stateless",
		responseMode: "json",
	});
}

const handler = handlerFor(toolsWith());

afterAll(async () => {
	await handler.close();
});

/** The outcome of `outcomeOf`, and the text of a successful answer ("" on a failure). */
type ToolCall = { outcome: string; answerText: string };

async function outcomeOf(
	scopes: McpScope[],
	tool: string,
	toolArguments: Record<string, string | number | Record<string, string>[]>,
	target: ReturnType<typeof createMcpHandler> = handler,
): Promise<string> {
	return (await toolCallOf(scopes, tool, toolArguments, target)).outcome;
}

/**
 * Calls one tool through the MCP SDK and names the outcome: "success", the tool error code,
 * or "<HTTP status> <scope>" when the SDK scope check refuses the call.
 */
async function toolCallOf(
	scopes: McpScope[],
	tool: string,
	toolArguments: Record<string, string | number | Record<string, string>[]>,
	target: ReturnType<typeof createMcpHandler> = handler,
): Promise<ToolCall> {
	const response = await target.fetch(
		new Request("http://localhost:3000/api/mcp", {
			headers: {
				accept: "application/json, text/event-stream",
				"content-type": "application/json",
			},
			method: "POST",
		}),
		{
			authInfo: { clientId: CALL.clientId, scopes, token: "" },
			parsedBody: {
				id: 1,
				jsonrpc: "2.0",
				method: "tools/call",
				params: { arguments: toolArguments, name: tool },
			},
		},
	);
	const text = await response.text();
	if (response.status !== 200) {
		// The scope challenge names the scope that the tool needs.
		const scope = response.headers
			.get("www-authenticate")
			?.match(/ scope="([^"]+)"/)?.[1];
		return { answerText: "", outcome: `${response.status} ${scope ?? text}` };
	}
	// The legacy leg answers one SSE event: "event: message", then "data: <JSON-RPC response>".
	const message = parseJSONRPCMessage(
		JSON.parse(text.slice(text.indexOf("data: ") + "data: ".length)),
	);
	if (!isJSONRPCResultResponse(message) || !isCallToolResult(message.result)) {
		return { answerText: "", outcome: `unexpected answer: ${text}` };
	}
	const [block] = message.result.content;
	const blockText = block?.type === "text" ? block.text : "";
	if (message.result.isError !== true) {
		return { answerText: blockText, outcome: "success" };
	}
	const failure = blockText.startsWith("{")
		? mcpToolErrorSchema.safeParse(JSON.parse(blockText))
		: null;
	return {
		answerText: "",
		outcome: failure?.success
			? failure.data.code
			: `unparsed error: ${blockText}`,
	};
}

const APPLY_CHANGES_INPUT = {
	changes: [{ content: "export const a = 1;\n", path: "src/a.ts" }],
	expectedHeadSha: "b".repeat(40),
	message: "Edit a",
};
const REQUEST_KEY = "88888888-8888-4888-8888-888888888888";
const CREATE_PROJECT_INPUT = {
	prompt: "Build a shop",
	requestKey: REQUEST_KEY,
};
// Every scope but the one in the name.
const ALL_BUT_BUILDER_RUN = mcpScopes.filter(
	(scope) => scope !== "builder:run",
);
const ALL_BUT_PROJECTS_WRITE = mcpScopes.filter(
	(scope) => scope !== "projects:write",
);
const TURN_ID = "99999999-9999-4999-8999-999999999999";

describe("McpTools access, role, and scope checks", () => {
	it.each<
		[
			string,
			McpScope[],
			string,
			Record<string, string | Record<string, string>[]>,
			string,
		]
	>([
		[
			"the creator reads a personal project",
			[...mcpScopes],
			"list_versions",
			{ projectId: OWN_PROJECT_ID },
			"success",
		],
		[
			"a team member reads a team project",
			[...mcpScopes],
			"list_versions",
			{ projectId: TEAM_PROJECT_ID },
			"success",
		],
		[
			"another user's personal project is hidden",
			[...mcpScopes],
			"list_versions",
			{ projectId: FOREIGN_PROJECT_ID },
			"PROJECT_NOT_FOUND",
		],
		[
			"a team project without a member row is hidden",
			[...mcpScopes],
			"list_versions",
			{ projectId: OUTSIDER_PROJECT_ID },
			"PROJECT_NOT_FOUND",
		],
		[
			"a V1 page project of the caller is hidden",
			[...mcpScopes],
			"list_versions",
			{ projectId: V1_PROJECT_ID },
			"PROJECT_NOT_FOUND",
		],
		[
			"a workspace Editor cannot open a Restricted project",
			[...mcpScopes],
			"list_versions",
			{ projectId: RESTRICTED_PROJECT_ID },
			"PROJECT_NOT_FOUND",
		],
		[
			"a team that the user is not a member of is hidden",
			[...mcpScopes],
			"list_projects",
			{ workspaceId: "org-outsider" },
			"WORKSPACE_NOT_FOUND",
		],
		[
			"a team member wakes the sandbox",
			[...mcpScopes],
			"wake_sandbox",
			{ projectId: TEAM_PROJECT_ID },
			"success",
		],
		[
			"a team member publishes",
			[...mcpScopes],
			"publish_app",
			{ projectId: TEAM_PROJECT_ID, requestKey: REQUEST_KEY },
			"success",
		],
		[
			"a direct-grant editor applies changes",
			[...mcpScopes],
			"apply_changes",
			{ ...APPLY_CHANGES_INPUT, projectId: SHARED_PROJECT_ID },
			"success",
		],
		[
			"a project viewer cannot apply changes",
			[...mcpScopes],
			"apply_changes",
			{ ...APPLY_CHANGES_INPUT, projectId: VIEWER_PROJECT_ID },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a project viewer cannot send a prompt",
			[...mcpScopes],
			"send_prompt",
			{
				message: "Add a page",
				projectId: VIEWER_PROJECT_ID,
				requestKey: REQUEST_KEY,
			},
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a project viewer cannot cancel a turn",
			[...mcpScopes],
			"cancel_turn",
			{ projectId: VIEWER_PROJECT_ID, turnId: TURN_ID },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a project viewer cannot publish",
			[...mcpScopes],
			"publish_app",
			{ projectId: VIEWER_PROJECT_ID, requestKey: REQUEST_KEY },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a read-only token cannot wake the sandbox",
			["projects:read"],
			"wake_sandbox",
			{ projectId: OWN_PROJECT_ID },
			"403 projects:write",
		],
		[
			"a read-only token cannot apply changes",
			["projects:read"],
			"apply_changes",
			{ ...APPLY_CHANGES_INPUT, projectId: OWN_PROJECT_ID },
			"403 projects:write",
		],
		[
			"a read-only token cannot send a prompt",
			["projects:read"],
			"send_prompt",
			{
				message: "Add a page",
				projectId: OWN_PROJECT_ID,
				requestKey: REQUEST_KEY,
			},
			"403 builder:run",
		],
		[
			"a read-only token cannot cancel a turn",
			["projects:read"],
			"cancel_turn",
			{ projectId: OWN_PROJECT_ID, turnId: TURN_ID },
			"403 builder:run",
		],
		[
			"a read-only token cannot publish",
			["projects:read"],
			"publish_app",
			{ projectId: OWN_PROJECT_ID, requestKey: REQUEST_KEY },
			"403 projects:deploy",
		],
		[
			"a token without builder:run cannot create a project",
			ALL_BUT_BUILDER_RUN,
			"create_project",
			CREATE_PROJECT_INPUT,
			"403 projects:write builder:run",
		],
		[
			"a token without projects:write cannot create a project",
			ALL_BUT_PROJECTS_WRITE,
			"create_project",
			CREATE_PROJECT_INPUT,
			"403 projects:write builder:run",
		],
		[
			"a workspace Viewer cannot create a project",
			[...mcpScopes],
			"create_project",
			{ ...CREATE_PROJECT_INPUT, workspaceId: "org-viewer" },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a team without a member row cannot create a project",
			[...mcpScopes],
			"create_project",
			{ ...CREATE_PROJECT_INPUT, workspaceId: "org-outsider" },
			"WORKSPACE_NOT_FOUND",
		],
		[
			"the shared list cannot own a new project",
			[...mcpScopes],
			"create_project",
			{ ...CREATE_PROJECT_INPUT, workspaceId: "shared" },
			"WORKSPACE_NOT_SUPPORTED",
		],
	])("%s", async (_label, scopes, tool, toolArguments, expected) => {
		expect(await outcomeOf(scopes, tool, toolArguments)).toBe(expected);
	});
});

const RUNNING_TURN: BuilderTurnRow = {
	cacheReadTokens: null,
	cacheWriteTokens: null,
	chatId: "chat-1",
	completedAt: null,
	createdAt: new Date(0),
	credits: null,
	error: null,
	failureCode: null,
	failureKind: null,
	failureProvider: null,
	failureProviderMessage: null,
	failureRequestId: null,
	failureSource: null,
	harness: "claude_code",
	id: TURN_ID,
	inputCommitSha: null,
	inputTokens: null,
	messageId: "message-1",
	model: null,
	organizationId: null,
	outputCommitSha: null,
	outputTokens: null,
	projectId: OWN_PROJECT_ID,
	requestKey: TURN_ID,
	runner: "trigger",
	sentryEventId: null,
	sessionId: "session-1",
	spec: { attachments: [], composer: null, message: "Add a page" },
	startedAt: null,
	status: "running",
	triggerRunId: null,
	turnNumber: 1,
	userId: CALL.userId,
};

describe("McpTools get_turn", () => {
	it("answers at once when the user holds every stream slot, and gives the denied hit back", async () => {
		// The web turn streams of the user hold all 5 open slots of the bucket.
		let heldSlots = 5;
		let turnReads = 0;
		const target = handlerFor(
			toolsWith({
				rateLimits: {
					hit: async () => {
						heldSlots += 1;
						return { count: heldSlots, ttlMs: 60_000 };
					},
					release: async () => {
						heldSlots = Math.max(0, heldSlots - 1);
					},
				},
				turns: {
					assertStreamAccess: async () => {
						turnReads += 1;
						return RUNNING_TURN;
					},
					cancel: notReached,
					create: notReached,
				},
			}),
		);

		const outcome = await outcomeOf(
			[...mcpScopes],
			"get_turn",
			{ projectId: OWN_PROJECT_ID, turnId: TURN_ID, waitSeconds: 25 },
			target,
		);
		await target.close();

		expect(outcome).toBe("success");
		// One read and no poll: a wait reads the row again every 2 s for up to 25 s.
		expect(turnReads).toBe(1);
		expect(heldSlots).toBe(5);
	});
});

describe("send_prompt conversation", () => {
	const OLDEST_CHAT_ID = "c0000000-0000-4000-8000-000000000001";
	const NEWEST_CHAT_ID = "c0000000-0000-4000-8000-000000000002";
	const BUSY_CHAT_ID = "c0000000-0000-4000-8000-000000000003";

	// Product rule: one conversation at a time uses the project. The prompt must
	// not go to the oldest conversation, which the API refuses while another holds it.
	it.each([
		{
			holder: "another conversation",
			busyChatId: BUSY_CHAT_ID,
			expected: BUSY_CHAT_ID,
		},
		{ holder: "no conversation", busyChatId: null, expected: NEWEST_CHAT_ID },
	])("sends to the right conversation when $holder holds the project", async ({
		busyChatId,
		expected,
	}) => {
		const sentChatIds: string[] = [];
		const target = handlerFor(
			toolsWith({
				chats: {
					findAccessibleChatByProjectId: async () => ({
						id: OLDEST_CHAT_ID,
						projectId: OWN_PROJECT_ID,
						userId: CALL.userId,
					}),
					listFirstTexts: notReached,
					listProjectChats: async () => [
						{
							createdAt: new Date(1),
							id: NEWEST_CHAT_ID,
							lastMessageAt: new Date(2),
							model: null,
							title: "Add a page",
						},
						{
							createdAt: new Date(0),
							id: OLDEST_CHAT_ID,
							lastMessageAt: new Date(1),
							model: null,
							title: "Build a shop",
						},
					],
				},
				turnRows: {
					findBusyChatId: async () => busyChatId,
					findByRequestKey: notReached,
					findCardParts: notReached,
				},
				turns: {
					assertStreamAccess: notReached,
					cancel: notReached,
					create: async (_scope, _projectId, body) => {
						sentChatIds.push(body.chatId);
						return {
							chatId: body.chatId,
							runId: null,
							status: "queued",
							streamUrl: "",
							turnId: TURN_ID,
						};
					},
				},
			}),
		);

		const outcome = await outcomeOf(
			[...mcpScopes],
			"send_prompt",
			{
				message: "Add a page",
				projectId: OWN_PROJECT_ID,
				requestKey: REQUEST_KEY,
			},
			target,
		);
		await target.close();

		expect(outcome).toBe("success");
		expect(sentChatIds).toEqual([expected]);
	});
});

describe("create_project replay", () => {
	/** The rows that the first call with the request key left. */
	type FirstCall =
		// The first turn of "Build a shop" runs.
		| "turn started"
		// The first turn failed: the chat holds the prompt and the error reply.
		| "turn failed"
		// The first call still runs: the chat holds only the prompt.
		| "still running"
		// The first call stopped before its turn (crash, deploy): the chat holds only a 10 min old prompt.
		| "stopped";

	/**
	 * Tools whose create fake stores each new project id, so `resolve` then finds it, as Postgres does.
	 * `race` makes the create fail on the primary key: `visible` leaves a project the caller can open.
	 */
	function replayTools(firstCall: FirstCall, race?: { visible: boolean }) {
		const projectIds = new Set<string>();
		let creates = 0;
		const tools = toolsWith({
			access: {
				resolve: async (userId, projectId) =>
					projectIds.has(projectId)
						? resolveProjectAccess({ ...OWN_FACTS, id: projectId }, userId)
						: null,
			},
			appProjects: {
				create: async (_scope, _body, request) => {
					creates += 1;
					if (request.ids === undefined) {
						return notReached();
					}
					if (race !== undefined) {
						if (race.visible) {
							projectIds.add(request.ids.projectId);
						}
						throw new Error("insert failed", { cause: { code: "23505" } });
					}
					projectIds.add(request.ids.projectId);
					return {
						...request.ids,
						turnId: firstCall === "turn started" ? TURN_ID : null,
					};
				},
				get: notReached,
			},
			chats: {
				findAccessibleChatByProjectId: notReached,
				listFirstTexts: async () => [
					{
						createdAt: new Date(
							firstCall === "stopped" ? Date.now() - 10 * 60_000 : Date.now(),
						),
						id: "message-1",
						role: "user",
						text: "Build a shop",
					},
					...(firstCall === "turn failed"
						? [
								{
									createdAt: new Date(),
									id: "message-2",
									role: "assistant" as const,
									text: "",
								},
							]
						: []),
				],
				listProjectChats: notReached,
			},
			turnRows: {
				findBusyChatId: notReached,
				findByRequestKey: async (chatId, requestKey) =>
					firstCall === "turn started"
						? {
								...RUNNING_TURN,
								chatId,
								requestKey,
								spec: {
									attachments: [],
									composer: null,
									message: "Build a shop",
								},
							}
						: null,
				findCardParts: notReached,
			},
		});
		return { createCount: () => creates, tools };
	}

	it.each<{ firstCall: FirstCall; prompt: string; expected: string }>([
		{ firstCall: "turn started", prompt: "Build a shop", expected: "success" },
		{
			firstCall: "turn started",
			prompt: "Build a blog",
			expected: "REQUEST_KEY_REUSED",
		},
		{ firstCall: "turn failed", prompt: "Build a shop", expected: "success" },
		{
			firstCall: "turn failed",
			prompt: "Build a blog",
			expected: "REQUEST_KEY_REUSED",
		},
		// A turnId null answer here makes the agent send the prompt again and pay twice.
		{
			firstCall: "still running",
			prompt: "Build a shop",
			expected: "CREATE_IN_PROGRESS",
		},
		// Without a time bound, every retry answers CREATE_IN_PROGRESS for good, and the agent has no way out.
		{ firstCall: "stopped", prompt: "Build a shop", expected: "success" },
	])("a retry after the $firstCall state with the prompt $prompt answers $expected", async ({
		firstCall,
		prompt,
		expected,
	}) => {
		const { createCount, tools } = replayTools(firstCall);
		const target = handlerFor(tools);

		const first = await toolCallOf(
			[...mcpScopes],
			"create_project",
			CREATE_PROJECT_INPUT,
			target,
		);
		const retry = await toolCallOf(
			[...mcpScopes],
			"create_project",
			{ ...CREATE_PROJECT_INPUT, prompt },
			target,
		);
		await target.close();

		expect(first.outcome).toBe("success");
		expect(retry.outcome).toBe(expected);
		// The retry takes no second credit check, backend, or first turn.
		expect(createCount()).toBe(1);
		if (expected === "success") {
			expect(retry.answerText).toBe(first.answerText);
		}
	});

	// Two calls with one requestKey at the same time: the second insert hits the primary key.
	it.each([
		{ visible: true, expected: "CREATE_IN_PROGRESS" },
		{ visible: false, expected: "REQUEST_KEY_REUSED" },
	])("a unique violation answers $expected when the caller can open the project: $visible", async ({
		visible,
		expected,
	}) => {
		const target = handlerFor(replayTools("still running", { visible }).tools);

		const outcome = await outcomeOf(
			[...mcpScopes],
			"create_project",
			CREATE_PROJECT_INPUT,
			target,
		);
		await target.close();

		expect(outcome).toBe(expected);
	});

	// Money: the project goes into the team that the agent named, so the team pool pays, not the personal pool.
	it("a team Editor creates the project in the team", async () => {
		const owners: (string | null)[] = [];
		const target = handlerFor(
			toolsWith({
				appProjects: {
					create: async (scope, _body, request) => {
						if (request.ids === undefined) {
							return notReached();
						}
						owners.push(scope.kind === "org" ? scope.organizationId : null);
						return { ...request.ids, turnId: TURN_ID };
					},
					get: notReached,
				},
			}),
		);

		const outcome = await outcomeOf(
			[...mcpScopes],
			"create_project",
			{ ...CREATE_PROJECT_INPUT, workspaceId: "org-team" },
			target,
		);
		await target.close();

		expect(outcome).toBe("success");
		expect(owners).toEqual(["org-team"]);
	});

	// Security: another user or another client with the same requestKey must never reach the same project.
	it("derives other ids for another user and another client", async () => {
		const ids: string[] = [];
		const tools = toolsWith({
			appProjects: {
				create: async (_scope, _body, request) => {
					if (request.ids === undefined) {
						return notReached();
					}
					ids.push(request.ids.projectId, request.ids.chatId);
					return { ...request.ids, turnId: TURN_ID };
				},
				get: notReached,
			},
		});
		const calls: McpCallContext[] = [
			CALL,
			{ ...CALL, userId: "user-3" },
			{ ...CALL, clientId: "https://chatgpt.com/oauth/codex-client-metadata" },
		];

		for (const call of calls) {
			const target = handlerFor(tools, call);
			expect(
				await outcomeOf(
					[...mcpScopes],
					"create_project",
					CREATE_PROJECT_INPUT,
					target,
				),
			).toBe("success");
			await target.close();
		}

		expect(new Set(ids).size).toBe(6);
		expect(ids.every((id) => uuidSchema.safeParse(id).success)).toBe(true);
	});
});
