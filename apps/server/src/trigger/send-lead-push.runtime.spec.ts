import { PgDialect } from "@wandit/db";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	type LeadPushFetch,
	type LeadPushRuntimeLogger,
	sendLeadPush,
} from "./send-lead-push.runtime";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const payload = {
	leadId: LEAD_ID,
	leadName: "Amina",
	leadPhone: "+213550000000",
	projectId: PROJECT_ID,
	wilaya: "Alger",
};

describe("sendLeadPush", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends to the personal project owner only", async () => {
		const database = databaseStub({
			project: {
				name: "Personal project",
				organizationId: null,
				userId: "owner-user",
			},
			tokens: [{ token: "ExponentPushToken[owner-device]" }],
		});
		const fetchMock = successfulFetch();

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).resolves.toMatchObject({
			recipientCount: 1,
			requestCount: 1,
			status: "sent",
			tokenCount: 1,
		});

		expect(database.calls.memberWhere).toBeUndefined();
		expect(sqlParams(database.calls.tokenWhere)).toEqual(["owner-user"]);
		const messages = requestMessages(fetchMock, 0);
		expect(messages).toEqual([
			{
				body: "Amina · +213550000000 · Alger",
				data: {
					leadId: LEAD_ID,
					projectId: PROJECT_ID,
					type: "lead.captured",
				},
				sound: "default",
				title: "New lead",
				to: "ExponentPushToken[owner-device]",
			},
		]);
	});

	it("resolves every organization member instead of the project creator", async () => {
		const database = databaseStub({
			members: [{ userId: "member-a" }, { userId: "member-b" }],
			project: {
				name: "Team project",
				organizationId: "organization-1",
				userId: "creator-user",
			},
			tokens: [
				{ token: "ExponentPushToken[member-a-device]" },
				{ token: "ExponentPushToken[member-b-device]" },
			],
		});
		const fetchMock = successfulFetch();

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).resolves.toMatchObject({
			recipientCount: 2,
			status: "sent",
			tokenCount: 2,
		});

		expect(sqlParams(database.calls.memberWhere)).toEqual(["organization-1"]);
		expect(sqlParams(database.calls.tokenWhere)).toEqual([
			"member-a",
			"member-b",
		]);
		expect(requestMessages(fetchMock, 0).map((message) => message.to)).toEqual([
			"ExponentPushToken[member-a-device]",
			"ExponentPushToken[member-b-device]",
		]);
	});

	it("skips an unknown project and constrains lookup to live projects", async () => {
		const database = databaseStub({ project: null });
		const fetchMock = successfulFetch();

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).resolves.toEqual({
			prunedTokenCount: 0,
			reason: "project_not_found",
			recipientCount: 0,
			requestCount: 0,
			status: "skipped",
			ticketErrorCount: 0,
			tokenCount: 0,
		});
		expect(sqlText(database.calls.projectWhere)).toContain(
			'"projects"."deleted_at" is null',
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns before calling Expo when recipients have no tokens", async () => {
		const database = databaseStub({
			project: {
				name: "Personal project",
				organizationId: null,
				userId: "owner-user",
			},
			tokens: [],
		});
		const fetchMock = successfulFetch();

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).resolves.toMatchObject({
			reason: "no_tokens",
			recipientCount: 1,
			requestCount: 0,
			status: "skipped",
			tokenCount: 0,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("deduplicates tokens and sends at most 100 messages per request", async () => {
		const tokens = Array.from({ length: 205 }, (_, index) => ({
			token: `ExponentPushToken[device-${index}]`,
		}));
		const database = databaseStub({
			project: {
				name: "Personal project",
				organizationId: null,
				userId: "owner-user",
			},
			tokens: [...tokens, tokens[0] as { token: string }],
		});
		const fetchMock = successfulFetch();

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).resolves.toMatchObject({
			requestCount: 3,
			status: "sent",
			tokenCount: 205,
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(
			[0, 1, 2].map((index) => requestMessages(fetchMock, index).length),
		).toEqual([100, 100, 5]);
	});

	it("prunes DeviceNotRegistered tokens by their aligned ticket index", async () => {
		const database = databaseStub({
			project: {
				name: "Personal project",
				organizationId: null,
				userId: "owner-user",
			},
			tokens: [
				{ token: "ExponentPushToken[stale]" },
				{ token: "ExponentPushToken[live]" },
			],
		});
		const fetchMock = vi.fn(async () =>
			jsonResponse({
				data: [
					{
						details: { error: "DeviceNotRegistered" },
						message: "Device is no longer registered",
						status: "error",
					},
					{ status: "ok" },
				],
			}),
		);

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).resolves.toMatchObject({
			prunedTokenCount: 1,
			status: "sent",
			ticketErrorCount: 1,
		});
		expect(database.calls.deleteWhere).toHaveLength(1);
		expect(sqlParams(database.calls.deleteWhere[0])).toEqual([
			"ExponentPushToken[stale]",
		]);
	});

	it("throws on a non-success Expo response so Trigger.dev can retry", async () => {
		const database = databaseStub({
			project: {
				name: "Personal project",
				organizationId: null,
				userId: "owner-user",
			},
			tokens: [{ token: "ExponentPushToken[owner-device]" }],
		});
		const fetchMock = vi.fn(async () => jsonResponse({}, 503));

		await expect(
			sendLeadPush(database.db, payload, { fetch: asFetch(fetchMock) }),
		).rejects.toThrow("Expo push request failed with status 503");
	});

	it("does not fail delivery when stale-token pruning fails", async () => {
		const database = databaseStub({
			deleteError: new Error("database unavailable"),
			project: {
				name: "Personal project",
				organizationId: null,
				userId: "owner-user",
			},
			tokens: [{ token: "ExponentPushToken[stale]" }],
		});
		const fetchMock = vi.fn(async () =>
			jsonResponse({
				data: [
					{
						details: { error: "DeviceNotRegistered" },
						status: "error",
					},
				],
			}),
		);
		const logger: LeadPushRuntimeLogger = { warn: vi.fn() };

		await expect(
			sendLeadPush(database.db, payload, {
				fetch: asFetch(fetchMock),
				logger,
			}),
		).resolves.toMatchObject({
			prunedTokenCount: 0,
			status: "sent",
			ticketErrorCount: 1,
		});
		expect(logger.warn).toHaveBeenCalledWith(
			"Failed to prune an unregistered Expo push token",
			{ leadId: LEAD_ID, projectId: PROJECT_ID },
		);
	});
});

type ProjectRow = {
	name: string;
	organizationId: string | null;
	userId: string;
};

type DatabaseScenario = {
	deleteError?: Error;
	members?: { userId: string }[];
	project: ProjectRow | null;
	tokens?: { token: string }[];
};

type QueryKind = "member" | "project" | "token";

function databaseStub(scenario: DatabaseScenario) {
	const calls: {
		deleteWhere: unknown[];
		memberWhere?: unknown;
		projectWhere?: unknown;
		tokenWhere?: unknown;
	} = { deleteWhere: [] };
	const select = vi.fn((columns: Record<string, unknown>) => {
		const kind: QueryKind =
			"organizationId" in columns
				? "project"
				: "userId" in columns
					? "member"
					: "token";
		const rows =
			kind === "project"
				? scenario.project
					? [scenario.project]
					: []
				: kind === "member"
					? (scenario.members ?? [])
					: (scenario.tokens ?? []);

		return thenableQuery(rows, (condition) => {
			calls[`${kind}Where`] = condition;
		});
	});
	const deleteWhere = vi.fn(async (condition: unknown) => {
		calls.deleteWhere.push(condition);
		if (scenario.deleteError) {
			throw scenario.deleteError;
		}
	});
	const deleteRows = vi.fn(() => ({ where: deleteWhere }));

	return {
		calls,
		db: { delete: deleteRows, select } as unknown as Parameters<
			typeof sendLeadPush
		>[0],
	};
}

function thenableQuery(rows: unknown[], onWhere: (condition: unknown) => void) {
	const builder = {
		from: vi.fn(),
		limit: vi.fn(),
		// biome-ignore lint/suspicious/noThenProperty: The fake must preserve Drizzle's promise-like query contract.
		then: (
			resolve: (value: unknown[]) => unknown,
			reject: (reason: unknown) => unknown,
		) => Promise.resolve(rows).then(resolve, reject),
		where: vi.fn(),
	};
	builder.from.mockReturnValue(builder);
	builder.limit.mockReturnValue(builder);
	builder.where.mockImplementation((condition: unknown) => {
		onWhere(condition);
		return builder;
	});

	return builder;
}

function successfulFetch() {
	return vi.fn(async (_input: unknown, init?: RequestInit) => {
		const messages = JSON.parse(String(init?.body)) as unknown[];

		return jsonResponse({ data: messages.map(() => ({ status: "ok" })) });
	});
}

function jsonResponse(body: unknown, status = 200): Response {
	return {
		json: async () => body,
		ok: status >= 200 && status < 300,
		status,
	} as Response;
}

function asFetch(mock: ReturnType<typeof vi.fn>): LeadPushFetch {
	return mock as unknown as LeadPushFetch;
}

function requestMessages(
	fetchMock: ReturnType<typeof vi.fn>,
	callIndex: number,
): { to: string }[] {
	const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;

	return JSON.parse(String(init?.body)) as { to: string }[];
}

function sqlParams(expression: unknown): unknown[] {
	return new PgDialect().sqlToQuery(
		expression as Parameters<PgDialect["sqlToQuery"]>[0],
	).params;
}

function sqlText(expression: unknown): string {
	return new PgDialect().sqlToQuery(
		expression as Parameters<PgDialect["sqlToQuery"]>[0],
	).sql;
}
