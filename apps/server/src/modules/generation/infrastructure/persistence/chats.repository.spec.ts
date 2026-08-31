import { PgDialect } from "@wandit/db";
import { messages } from "@wandit/db/schema/chats";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { ChatsRepository } from "./chats.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: unknown) {
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setupWrites() {
	const onConflictDoNothing = vi.fn(async (_input: unknown) => undefined);
	const onConflictDoUpdate = vi.fn(async (_input: unknown) => undefined);
	const values = vi.fn((_input: unknown) => ({
		onConflictDoNothing,
		onConflictDoUpdate,
	}));
	const insert = vi.fn(() => ({ values }));
	const repository = new ChatsRepository({ insert } as unknown as Database);

	return {
		insert,
		onConflictDoNothing,
		onConflictDoUpdate,
		repository,
		values,
	};
}

function aiErrorData(overrides: Record<string, unknown> = {}) {
	return {
		kind: "provider_error",
		moderationStage: null,
		providerLabel: "Anthropic",
		providerMessage: "The provider rejected this request.",
		refunded: true,
		requestId: "request-1",
		retryable: true,
		source: "provider:anthropic",
		terminal: true,
		...overrides,
	};
}

describe("ChatsRepository failure persistence", () => {
	it("stores trusted failure columns without putting the Sentry id in parts", async () => {
		const { onConflictDoNothing, repository, values } = setupWrites();
		const parts = [
			{
				data: aiErrorData({
					provider: "openai",
					providerLabel: "A display label, not a slug",
				}),
				type: "data-ai-error",
			},
		];
		const failure = {
			failureKind: "provider_error",
			failureProvider: "openai",
			failureProviderMessage: "The provider rejected this request.",
			failureRequestId: "request-1",
			failureSource: "provider:anthropic",
			sentryEventId: "0123456789abcdef0123456789abcdef",
		};

		await repository.insertUiMessagesIfAbsent(
			"chat-1",
			[
				{
					id: "message-1",
					parts,
					role: "assistant",
				},
			],
			failure,
		);

		expect(values).toHaveBeenCalledWith([
			{
				chatId: "chat-1",
				failureKind: "provider_error",
				failureProvider: "openai",
				failureProviderMessage: "The provider rejected this request.",
				failureRequestId: "request-1",
				failureSource: "provider:anthropic",
				id: "message-1",
				metadata: null,
				parts,
				role: "assistant",
				sentryEventId: "0123456789abcdef0123456789abcdef",
			},
		]);
		expect(JSON.stringify(parts)).not.toContain("sentryEventId");
		expect(onConflictDoNothing).toHaveBeenCalledWith({ target: messages.id });
	});

	it("does not derive trusted columns from assistant-owned JSON parts", async () => {
		const { repository, values } = setupWrites();
		const terminalParts = [
			{
				data: aiErrorData(),
				type: "data-ai-error",
			},
		];
		const explicitNullProviderParts = [
			{
				data: aiErrorData({ provider: null, source: "provider:google" }),
				type: "data-ai-error",
			},
		];
		const directProviderParts = [
			{
				data: aiErrorData({
					providerLabel: "Higgsfield",
					source: "higgsfield",
				}),
				type: "data-ai-error",
			},
		];
		const displayLabelOnlyParts = [
			{
				data: aiErrorData({
					providerLabel: "Anthropic",
					source: "gateway",
				}),
				type: "data-ai-error",
			},
		];
		const toolErrorParts = [
			{
				data: aiErrorData({ toolCallId: "tool-1" }),
				type: "data-ai-error",
			},
		];
		const noticeParts = [
			{
				data: aiErrorData({ terminal: false }),
				type: "data-ai-error",
			},
		];

		await repository.insertUiMessagesIfAbsent(
			"chat-1",
			[
				{ id: "terminal", parts: terminalParts, role: "assistant" },
				{
					id: "explicit-null",
					parts: explicitNullProviderParts,
					role: "assistant",
				},
				{
					id: "direct-provider",
					parts: directProviderParts,
					role: "assistant",
				},
				{
					id: "display-label-only",
					parts: displayLabelOnlyParts,
					role: "assistant",
				},
				{ id: "tool", parts: toolErrorParts, role: "assistant" },
				{ id: "notice", parts: noticeParts, role: "assistant" },
			],
			null,
		);

		const inserted = values.mock.calls[0]?.[0] as Array<
			Record<string, unknown>
		>;
		for (const row of inserted) {
			expect(row).toMatchObject({
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: null,
				sentryEventId: null,
			});
		}
	});

	it("never derives failure columns from a user-authored data part", async () => {
		const { repository, values } = setupWrites();
		const parts = [
			{
				data: aiErrorData({
					provider: "openai",
					sentryEventId: "spoofed-event-id",
				}),
				type: "data-ai-error",
			},
		];

		await repository.insertUiMessagesIfAbsent(
			"chat-1",
			[{ id: "user-message", parts, role: "user" }],
			{
				failureKind: "internal",
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: "ours",
				sentryEventId: "spoofed-event-id",
			},
		);

		expect(values).toHaveBeenCalledWith([
			expect.objectContaining({
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: null,
				sentryEventId: null,
			}),
		]);
	});

	it("updates or clears every failure column when a message is replaced", async () => {
		const { onConflictDoUpdate, repository, values } = setupWrites();
		const parts = [{ state: "done", text: "Recovered", type: "text" }];

		await repository.upsertUiMessage(
			"chat-1",
			{
				id: "message-1",
				parts,
				role: "assistant",
			},
			null,
		);

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: null,
				sentryEventId: null,
			}),
		);
		const conflict = onConflictDoUpdate.mock.calls[0]?.[0] as
			| { set: Record<string, unknown>; target: unknown }
			| undefined;
		expect(conflict?.target).toBe(messages.id);
		expect(Object.keys(conflict?.set ?? {}).sort()).toEqual(
			[
				"failureKind",
				"failureProvider",
				"failureProviderMessage",
				"failureRequestId",
				"failureSource",
				"metadata",
				"parts",
				"sentryEventId",
			].sort(),
		);
		for (const [column, expression] of Object.entries(conflict?.set ?? {})) {
			const expected =
				column === "failureKind"
					? "failure_kind"
					: column === "failureProvider"
						? "failure_provider"
						: column === "failureProviderMessage"
							? "failure_provider_message"
							: column === "failureRequestId"
								? "failure_request_id"
								: column === "failureSource"
									? "failure_source"
									: column === "sentryEventId"
										? "sentry_event_id"
										: column;
			expect(compile(expression).sql).toBe(`excluded.${expected}`);
		}
	});
});

describe("ChatsRepository.deleteTerminalFailedAssistantMessage", () => {
	function setupDelete(returned: Array<{ id: string }>) {
		const returning = vi.fn(async (_selection: unknown) => returned);
		const where = vi.fn((_predicate: unknown) => ({ returning }));
		const deleteMessage = vi.fn(() => ({ where }));
		const repository = new ChatsRepository({
			delete: deleteMessage,
		} as unknown as Database);

		return { deleteMessage, repository, returning, where };
	}

	it("deletes in one query scoped to the chat, assistant role, and terminal error", async () => {
		const { deleteMessage, repository, returning, where } = setupDelete([
			{ id: "message-1" },
		]);

		await expect(
			repository.deleteTerminalFailedAssistantMessage("chat-1", "message-1"),
		).resolves.toBe(true);

		expect(deleteMessage).toHaveBeenCalledWith(messages);
		expect(returning).toHaveBeenCalledWith({ id: messages.id });
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["message-1", "chat-1", "assistant"]);
		expect(predicate.sql).toContain('"messages"."id" = $1');
		expect(predicate.sql).toContain('"messages"."chat_id" = $2');
		expect(predicate.sql).toContain('"messages"."role" = $3');
		expect(predicate.sql).toContain("jsonb_array_elements");
		expect(predicate.sql).toContain("jsonb_typeof");
		expect(predicate.sql).toContain("part ->> 'type' = 'data-ai-error'");
		expect(predicate.sql).toContain("part #>> '{data,terminal}' = 'true'");
		expect(predicate.sql).toContain("part #>> '{data,toolCallId}' IS NULL");
	});

	it("returns false when a row from another chat cannot satisfy the scoped predicate", async () => {
		const { repository } = setupDelete([]);

		await expect(
			repository.deleteTerminalFailedAssistantMessage("chat-1", "message-1"),
		).resolves.toBe(false);
	});
});
