import { PgDialect, type SQL } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type SandboxSessionRow,
	SandboxSessionsRepository,
} from "./sandbox-sessions.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setupUpdate(returned: Array<{ id: string }> = []) {
	const returning = vi.fn(async () => returned);
	const where = vi.fn((_predicate: SQL | undefined) => ({ returning }));
	const set = vi.fn((_input: Partial<SandboxSessionRow>) => ({ where }));
	const update = vi.fn(() => ({ set }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// update chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { update }) as Database;
	const repository = new SandboxSessionsRepository(db);

	return { repository, returning, set, update, where };
}

function setupSelect(rows: SandboxSessionRow[] = []) {
	const limit = vi.fn(async (_count: number) => rows);
	const where = vi.fn((_predicate: SQL | undefined) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;
	const repository = new SandboxSessionsRepository(db);

	return { from, limit, repository, select, where };
}

describe("SandboxSessionsRepository.markRunning", () => {
	it("updates rows still in a live status", async () => {
		const { repository, set, where } = setupUpdate([{ id: "row-1" }]);
		const expiresAt = new Date("2030-01-01T00:00:00Z");

		await expect(
			repository.markRunning("row-1", {
				expiresAt,
				image: "registry.test/wandit/sandbox:1",
				previewHost: "preview.example.test",
				providerSandboxId: "sandbox-1",
			}),
		).resolves.toBe(true);

		const written = set.mock.calls[0]?.[0];
		expect(written).toMatchObject({
			error: null,
			expiresAt,
			image: "registry.test/wandit/sandbox:1",
			previewHost: "preview.example.test",
			providerSandboxId: "sandbox-1",
			status: "running",
		});
		expect(written?.lastActiveAt).toBeInstanceOf(Date);

		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual([
			"row-1",
			"creating",
			"running",
			"stopped",
		]);
		expect(predicate.sql).toContain('"sandbox_sessions"."id" = $1');
		expect(predicate.sql).toContain('"sandbox_sessions"."status" in');
	});

	it("returns false when the row already left the live set", async () => {
		const { repository } = setupUpdate([]);

		await expect(
			repository.markRunning("row-1", {
				expiresAt: null,
				image: "registry.test/wandit/sandbox:1",
				previewHost: "preview.example.test",
				providerSandboxId: "sandbox-1",
			}),
		).resolves.toBe(false);
	});
});

describe("SandboxSessionsRepository.markNetworkPolicyHash", () => {
	it("writes the hash on the row while it is live", async () => {
		const { repository, set, where } = setupUpdate();

		await repository.markNetworkPolicyHash("row-1", "abc123");

		expect(set.mock.calls[0]?.[0]).toEqual({ networkPolicyHash: "abc123" });

		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual([
			"row-1",
			"creating",
			"running",
			"stopped",
		]);
		expect(predicate.sql).toContain('"sandbox_sessions"."id" = $1');
		expect(predicate.sql).toContain('"sandbox_sessions"."status" in');
	});
});

describe("SandboxSessionsRepository.touchActivity", () => {
	it("stamps lastActiveAt on the live row of the project", async () => {
		const { repository, set, where } = setupUpdate();

		await repository.touchActivity("project-1");

		const written = set.mock.calls[0]?.[0];
		expect(written?.lastActiveAt).toBeInstanceOf(Date);

		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual([
			"project-1",
			"creating",
			"running",
			"stopped",
		]);
		expect(predicate.sql).toContain('"sandbox_sessions"."project_id" = $1');
		expect(predicate.sql).toContain('"sandbox_sessions"."status" in');
	});
});

describe("SandboxSessionsRepository.listIdleSince", () => {
	it("selects running rows whose last activity predates the cutoff", async () => {
		const { repository, where } = setupSelect([]);
		const cutoff = new Date("2030-01-01T00:00:00Z");

		await repository.listIdleSince(cutoff);

		const predicate = compile(where.mock.calls[0]?.[0]);
		// PgDialect serializes Date params to ISO strings.
		expect(predicate.params).toEqual(["running", cutoff.toISOString()]);
		expect(predicate.sql).toContain('"sandbox_sessions"."status" = $1');
		expect(predicate.sql).toContain('"sandbox_sessions"."last_active_at" < $2');
	});
});

describe("SandboxSessionsRepository.findLiveByProjectId", () => {
	it("filters to the three live statuses", async () => {
		const { repository, where } = setupSelect([]);

		await expect(
			repository.findLiveByProjectId("project-1"),
		).resolves.toBeNull();

		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual([
			"project-1",
			"creating",
			"running",
			"stopped",
		]);
	});
});
