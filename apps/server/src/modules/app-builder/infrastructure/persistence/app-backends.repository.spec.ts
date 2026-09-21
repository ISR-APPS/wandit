import { PgDialect, type SQL } from "@wandit/db";
import { appBackends } from "@wandit/db/schema/app-backends";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type AppBackendRow,
	AppBackendsRepository,
} from "./app-backends.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

function compile(query: SQL | undefined) {
	// SAFETY: the where-mock receives real drizzle SQL chunks.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

const ROW: AppBackendRow = {
	anonKey: null,
	dbHost: null,
	failureCode: null,
	id: "backend-1",
	orgId: null,
	organizationId: "org-1",
	projectId: "project-1",
	ref: null,
	region: "eu-west-3",
	requestKey: "req-key-1",
	status: "creating",
	triggerRunId: null,
	userId: "user-1",
};

function setupSelect(rows: AppBackendRow[] = []) {
	const limit = vi.fn(async (_count: number) => rows);
	const where = vi.fn((_predicate: SQL | undefined) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// select chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { select }) as Database;
	const repository = new AppBackendsRepository(db);

	return { repository, where };
}

function setupInsert(returned: AppBackendRow[]) {
	const returning = vi.fn(async () => returned);
	const onConflictDoNothing = vi.fn(() => ({ returning }));
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// insert chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { insert }) as Database;
	const repository = new AppBackendsRepository(db);

	return { onConflictDoNothing, repository, values };
}

function setupUpdate() {
	const where = vi.fn(async (_predicate: SQL | undefined) => []);
	const set = vi.fn((_input: Partial<typeof appBackends.$inferInsert>) => ({
		where,
	}));
	const update = vi.fn(() => ({ set }));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the
	// update chain the repository method under test calls.
	const db = Object.assign(Object.create(null), { update }) as Database;
	const repository = new AppBackendsRepository(db);

	return { repository, set, where };
}

describe("AppBackendsRepository.findByProjectId", () => {
	it("selects the row columns scoped to the project id", async () => {
		const { repository, where } = setupSelect([ROW]);

		const result = await repository.findByProjectId("project-1");

		expect(result).toEqual(ROW);
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
		expect(predicate.sql).toContain('"app_backends"."project_id" = $1');
	});

	it("returns null when the project has no row", async () => {
		const { repository } = setupSelect([]);

		expect(await repository.findByProjectId("missing")).toBeNull();
	});
});

describe("AppBackendsRepository.insertCreating", () => {
	it("inserts a creating row and ignores a project-id conflict", async () => {
		const { onConflictDoNothing, repository, values } = setupInsert([ROW]);

		const result = await repository.insertCreating({
			organizationId: "org-1",
			projectId: "project-1",
			region: "eu-west-3",
			requestKey: "req-key-1",
			userId: "user-1",
		});

		expect(result).toEqual(ROW);
		expect(values).toHaveBeenCalledWith({
			organizationId: "org-1",
			projectId: "project-1",
			region: "eu-west-3",
			requestKey: "req-key-1",
			status: "creating",
			userId: "user-1",
		});
		expect(onConflictDoNothing).toHaveBeenCalledWith({
			target: appBackends.projectId,
		});
	});

	it("returns null when the project already has a row", async () => {
		const { repository } = setupInsert([]);

		const result = await repository.insertCreating({
			organizationId: "org-1",
			projectId: "project-1",
			region: "eu-west-3",
			requestKey: "req-key-1",
			userId: "user-1",
		});

		expect(result).toBeNull();
	});
});

describe("AppBackendsRepository.markActive", () => {
	it("sets status active with the anon key, the host, and the stamp", async () => {
		const { repository, set, where } = setupUpdate();
		const lastActiveAt = new Date("2026-09-17T12:00:00Z");

		await repository.markActive("project-1", {
			anonKey: "anon-key-1",
			dbHost: "db.ref.supabase.co",
			lastActiveAt,
		});

		expect(set).toHaveBeenCalledWith({
			anonKey: "anon-key-1",
			dbHost: "db.ref.supabase.co",
			error: null,
			failureCode: null,
			failureKind: null,
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: null,
			lastActiveAt,
			sentryEventId: null,
			status: "active",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
		expect(predicate.sql).toContain('"app_backends"."project_id" = $1');
	});
});

describe("AppBackendsRepository.markError", () => {
	it("writes the failure code and the failure columns", async () => {
		const { repository, set, where } = setupUpdate();

		await repository.markError("project-1", {
			error: "poll timed out",
			failureCode: "backend_provision_timeout",
			failureKind: "timeout",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "supabase_api",
			sentryEventId: "evt-1",
		});

		expect(set).toHaveBeenCalledWith({
			error: "poll timed out",
			failureCode: "backend_provision_timeout",
			failureKind: "timeout",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "supabase_api",
			sentryEventId: "evt-1",
			status: "error",
		});
		const predicate = compile(where.mock.calls[0]?.[0]);
		expect(predicate.params).toEqual(["project-1"]);
	});
});
