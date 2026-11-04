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
} from "@wandit/contracts";
import { afterAll, describe, expect, it } from "vitest";

import type { MemberRow } from "../../../../workspaces/infrastructure/persistence/members.repository";
import type { TurnsService } from "../../../application/services/turns.service";
import type { BuilderTurnRow } from "../../../infrastructure/persistence/builder-turns.repository";
import type { McpProjectOwner } from "../../../infrastructure/persistence/mcp-access.repository";
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

const OWNERS = new Map<string, McpProjectOwner>([
	[
		OWN_PROJECT_ID,
		{ engine: "v2_app", organizationId: null, userId: "user-1" },
	],
	[
		FOREIGN_PROJECT_ID,
		{ engine: "v2_app", organizationId: null, userId: "user-2" },
	],
	[
		TEAM_PROJECT_ID,
		{ engine: "v2_app", organizationId: "org-team", userId: "user-2" },
	],
	[
		VIEWER_PROJECT_ID,
		{ engine: "v2_app", organizationId: "org-viewer", userId: "user-2" },
	],
	[
		OUTSIDER_PROJECT_ID,
		{ engine: "v2_app", organizationId: "org-outsider", userId: "user-2" },
	],
	[
		V1_PROJECT_ID,
		{ engine: "v1_page", organizationId: null, userId: "user-1" },
	],
]);

// The `member.role` of user-1 in each team. Every v1 role has project:update and publish:manage.
// An unknown role name grants nothing, so "viewer" has neither permission.
const ROLES = new Map([
	["org-team", "member"],
	["org-viewer", "viewer"],
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
	turns?: Pick<TurnsService, "create" | "cancel" | "assertStreamAccess">;
	rateLimits?: RateLimitStore;
};

function toolsWith(fakes: ToolFakes = {}): McpTools {
	return new McpTools(
		{ findProjectOwner: async (projectId) => OWNERS.get(projectId) ?? null },
		{
			findMember: async (organizationId, userId): Promise<MemberRow | null> => {
				const role = ROLES.get(organizationId);
				return role === undefined || userId !== CALL.userId
					? null
					: {
							createdAt: new Date(0),
							id: `member-${organizationId}`,
							organizationId,
							role,
							userId,
						};
			},
		},
		{ listForUser: notReached },
		{ listForScope: notReached },
		{ findAccessibleChatByProjectId: notReached },
		{ get: notReached },
		{ file: notReached, snapshot: notReached },
		{ list: async () => ({ items: [], nextCursor: null }) },
		fakes.turns ?? {
			assertStreamAccess: notReached,
			cancel: notReached,
			create: notReached,
		},
		{ findCardParts: notReached },
		{ wake: async () => ({ status: "running" }) },
		{ apply: notReached, sandboxHead: notReached },
		{ publishHead: async () => BUILD, status: notReached },
		{ record: async () => {} },
		fakes.rateLimits ?? {
			hit: async () => ({ count: 1, ttlMs: 600_000 }),
			release: async () => {},
		},
	);
}

// The controller builds one handler for each POST. Each handler prints a console.warn, so this file builds few.
function handlerFor(tools: McpTools): ReturnType<typeof createMcpHandler> {
	return createMcpHandler(() => tools.createServer(CALL), {
		legacy: "stateless",
		responseMode: "json",
	});
}

const handler = handlerFor(toolsWith());

afterAll(async () => {
	await handler.close();
});

/**
 * Calls one tool through the MCP SDK and names the outcome: "success", the tool error code,
 * or "<HTTP status> <scope>" when the SDK scope check refuses the call.
 */
async function outcomeOf(
	scopes: McpScope[],
	tool: string,
	toolArguments: Record<string, string | number | Record<string, string>[]>,
	target: ReturnType<typeof createMcpHandler> = handler,
): Promise<string> {
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
		return `${response.status} ${scope ?? text}`;
	}
	// The legacy leg answers one SSE event: "event: message", then "data: <JSON-RPC response>".
	const message = parseJSONRPCMessage(
		JSON.parse(text.slice(text.indexOf("data: ") + "data: ".length)),
	);
	if (!isJSONRPCResultResponse(message) || !isCallToolResult(message.result)) {
		return `unexpected answer: ${text}`;
	}
	if (message.result.isError !== true) {
		return "success";
	}
	const [block] = message.result.content;
	const errorText = block?.type === "text" ? block.text : "";
	const failure = errorText.startsWith("{")
		? mcpToolErrorSchema.safeParse(JSON.parse(errorText))
		: null;
	return failure?.success ? failure.data.code : `unparsed error: ${errorText}`;
}

const APPLY_CHANGES_INPUT = {
	changes: [{ content: "export const a = 1;\n", path: "src/a.ts" }],
	expectedHeadSha: "b".repeat(40),
	message: "Edit a",
};
const REQUEST_KEY = "88888888-8888-4888-8888-888888888888";
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
			"a role without project:update cannot wake the sandbox",
			[...mcpScopes],
			"wake_sandbox",
			{ projectId: VIEWER_PROJECT_ID },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a role without project:update cannot apply changes",
			[...mcpScopes],
			"apply_changes",
			{ ...APPLY_CHANGES_INPUT, projectId: VIEWER_PROJECT_ID },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a role without project:update cannot send a prompt",
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
			"a role without project:update cannot cancel a turn",
			[...mcpScopes],
			"cancel_turn",
			{ projectId: VIEWER_PROJECT_ID, turnId: TURN_ID },
			"WORKSPACE_PERMISSION_DENIED",
		],
		[
			"a role without publish:manage cannot publish",
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
