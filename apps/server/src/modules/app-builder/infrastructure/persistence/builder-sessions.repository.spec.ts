import { PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import type { HarnessResumeState } from "../../domain/ports/builder-harness";
import { BuilderSessionsRepository } from "./builder-sessions.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: unknown) {
	// SAFETY: the fake db captures real drizzle SQL wrappers as this arg.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

describe("BuilderSessionsRepository", () => {
	it("findByChatId selects by chat id", async () => {
		const captured: { where?: unknown } = {};
		const limit = vi.fn(async () => []);
		const where = vi.fn((w: unknown) => {
			captured.where = w;
			return { limit };
		});
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		const repository = new BuilderSessionsRepository(
			// SAFETY: the fake implements the select chain the method uses.
			{ select } as unknown as Database,
		);

		await expect(repository.findByChatId("chat-1")).resolves.toBeNull();

		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_sessions"."chat_id" = $1');
		expect(params).toEqual(["chat-1"]);
	});

	it("saveResumeState writes provider session, resume state, and model", async () => {
		const captured: { set?: unknown; where?: unknown } = {};
		const returning = vi.fn(async () => [{ id: "session-1" }]);
		const where = vi.fn((w: unknown) => {
			captured.where = w;
			return { returning };
		});
		const set = vi.fn((s: unknown) => {
			captured.set = s;
			return { where };
		});
		const update = vi.fn(() => ({ set }));
		const repository = new BuilderSessionsRepository(
			// SAFETY: the fake implements the update chain the method uses.
			{ update } as unknown as Database,
		);

		const resumeState: HarnessResumeState = {
			harness: "claude_code",
			payload: "opaque",
			pending: [],
		};
		const row = await repository.saveResumeState("chat-1", {
			model: "claude-sonnet",
			providerSessionId: "provider-1",
			resumeState,
		});

		expect(row).toEqual({ id: "session-1" });
		expect(captured.set).toEqual({
			model: "claude-sonnet",
			providerSessionId: "provider-1",
			resumeState,
		});
		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_sessions"."chat_id" = $1');
		expect(params).toEqual(["chat-1"]);
	});

	it("clearResumeState nulls provider session and resume state", async () => {
		const captured: { set?: unknown; where?: unknown } = {};
		const returning = vi.fn(async () => [{ id: "session-1" }]);
		const where = vi.fn((w: unknown) => {
			captured.where = w;
			return { returning };
		});
		const set = vi.fn((s: unknown) => {
			captured.set = s;
			return { where };
		});
		const update = vi.fn(() => ({ set }));
		const repository = new BuilderSessionsRepository(
			// SAFETY: `Object.create` yields `any`; the fake exposes only the
			// update chain `clearResumeState` calls, and nothing executes.
			Object.assign(Object.create(null), { update }) as Database,
		);

		const row = await repository.clearResumeState("chat-1");

		expect(row).toEqual({ id: "session-1" });
		expect(captured.set).toEqual({
			providerSessionId: null,
			resumeState: null,
		});
		const { params, sql } = compile(captured.where);
		expect(sql).toContain('"builder_sessions"."chat_id" = $1');
		expect(params).toEqual(["chat-1"]);
	});
});
