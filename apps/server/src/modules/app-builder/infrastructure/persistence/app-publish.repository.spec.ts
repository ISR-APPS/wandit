import { PgDialect, type SQL } from "@wandit/db";
import type { appBuilds } from "@wandit/db/schema/app-builds";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type AppBuildRow,
	AppPublishRepository,
	type NewAppBuild,
} from "./app-publish.repository";

type AppBuildInsert = typeof appBuilds.$inferInsert;

function compile(query: SQL | undefined) {
	if (!query) {
		throw new Error("The repository passed no SQL to the fake");
	}
	const rendered = new PgDialect().sqlToQuery(query);
	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

const BUILD_ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const PROJECT_ID = "0f3a9c1b-4e7d-4a2b-9c3d-1e2f3a4b5c6d";
const REQUEST_KEY = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const ROW: AppBuildRow = {
	bytes: null,
	commitSha: "a".repeat(40),
	completedAt: null,
	createdAt: new Date("2026-10-01T10:00:00.000Z"),
	errorCode: null,
	errorMessage: null,
	fileCount: null,
	id: BUILD_ID,
	organizationId: null,
	projectId: PROJECT_ID,
	requestKey: REQUEST_KEY,
	sourceBuildId: null,
	status: "queued",
	triggerRunId: null,
	updatedAt: new Date("2026-10-01T10:00:00.000Z"),
	userId: "user-1",
};

const NEW_BUILD: NewAppBuild = {
	commitSha: ROW.commitSha,
	organizationId: null,
	projectId: PROJECT_ID,
	requestKey: REQUEST_KEY,
	sourceBuildId: null,
	userId: "user-1",
};

// Drizzle wraps the driver error, so the 23505 sits in the cause.
const UNIQUE_VIOLATION = new Error("insert failed", {
	cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
});

// A fake db with the insert, select, and update chains the repository calls.
function fakeDb(options: {
	insertError?: Error;
	selected?: AppBuildRow[];
	updated?: { id: string }[];
}) {
	const values = vi.fn((_row: AppBuildInsert) => ({
		returning: async () => {
			if (options.insertError) {
				throw options.insertError;
			}
			return [ROW];
		},
	}));
	const limit = vi.fn(async (_count: number) => options.selected ?? []);
	const orderBy = vi.fn((..._order: SQL[]) => ({ limit }));
	const selectWhere = vi.fn((_predicate: SQL | undefined) => ({
		limit,
		orderBy,
	}));
	const returning = vi.fn(async () => options.updated ?? []);
	const updateWhere = vi.fn((_predicate: SQL | undefined) => ({ returning }));
	const set = vi.fn((_columns: Partial<AppBuildInsert>) => ({
		where: updateWhere,
	}));
	// SAFETY: `Object.create` yields `any`; the stub exposes only the insert,
	// select, and update chains the repository methods call.
	const db = Object.assign(Object.create(null), {
		insert: () => ({ values }),
		select: () => ({ from: () => ({ where: selectWhere }) }),
		update: () => ({ set }),
	}) as Database;
	return {
		limit,
		repository: new AppPublishRepository(db),
		selectWhere,
		set,
		updateWhere,
		values,
	};
}

describe("AppPublishRepository.insertQueued", () => {
	it("inserts a queued row and answers created", async () => {
		const { repository, values } = fakeDb({});

		expect(await repository.insertQueued(NEW_BUILD)).toEqual({
			kind: "created",
			row: ROW,
		});
		expect(values).toHaveBeenCalledWith({ ...NEW_BUILD, status: "queued" });
	});

	it("answers the earlier row of a retried request key", async () => {
		const earlier = { ...ROW, status: "building" as const };
		const { repository } = fakeDb({
			insertError: UNIQUE_VIOLATION,
			selected: [earlier],
		});

		expect(await repository.insertQueued(NEW_BUILD)).toEqual({
			kind: "request_exists",
			row: earlier,
		});
	});

	it("answers live_exists when the live index rejects a new request key", async () => {
		const { repository } = fakeDb({
			insertError: UNIQUE_VIOLATION,
			selected: [],
		});

		expect(await repository.insertQueued(NEW_BUILD)).toEqual({
			kind: "live_exists",
		});
	});

	it("rethrows an insert error that is not a unique violation", async () => {
		const failure = new Error("connection lost");
		const { repository, selectWhere } = fakeDb({ insertError: failure });

		await expect(repository.insertQueued(NEW_BUILD)).rejects.toBe(failure);
		expect(selectWhere).not.toHaveBeenCalled();
	});
});

describe("AppPublishRepository reads", () => {
	it("finds the live build with the three live statuses", async () => {
		const { repository, selectWhere } = fakeDb({ selected: [ROW] });

		expect(await repository.findLive(PROJECT_ID)).toEqual(ROW);
		const predicate = compile(selectWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("app_builds"."project_id" = $1 and "app_builds"."status" in ($2, $3, $4))',
		);
		expect(predicate.params).toEqual([
			PROJECT_ID,
			"queued",
			"building",
			"uploading",
		]);
	});

	it("reads only app rows of the project for the history", async () => {
		const { limit, repository, selectWhere } = fakeDb({ selected: [] });

		await repository.listDeployments(PROJECT_ID, 20);

		const predicate = compile(selectWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("deployments"."project_id" = $1 and "deployments"."kind" = $2)',
		);
		expect(predicate.params).toEqual([PROJECT_ID, "app"]);
		expect(limit).toHaveBeenCalledWith(20);
	});

	it("reads one app deployment only inside the project", async () => {
		const { repository, selectWhere } = fakeDb({ selected: [] });

		expect(await repository.findDeployment(PROJECT_ID, "deployment-1")).toBe(
			null,
		);
		expect(compile(selectWhere.mock.calls[0]?.[0]).params).toEqual([
			"deployment-1",
			PROJECT_ID,
			"app",
		]);
	});
});

describe("AppPublishRepository writes", () => {
	it("moves a row only from the statuses the machine allows", async () => {
		const { repository, set, updateWhere } = fakeDb({});

		expect(
			await repository.transition(BUILD_ID, {
				fileCount: 3,
				bytes: 90,
				to: "uploading",
			}),
		).toBeNull();
		expect(set).toHaveBeenCalledWith({
			bytes: 90,
			fileCount: 3,
			status: "uploading",
		});
		const predicate = compile(updateWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("app_builds"."id" = $1 and "app_builds"."status" in ($2))',
		);
		expect(predicate.params).toEqual([BUILD_ID, "building"]);
	});

	it("stores a gate block with its code and caps a failure text at 500 characters", async () => {
		const { repository, set } = fakeDb({});

		await repository.transition(BUILD_ID, {
			errorMessage: "index.html: phishing form",
			to: "blocked",
		});
		await repository.transition(BUILD_ID, {
			errorCode: "build_failed",
			errorMessage: "x".repeat(600),
			to: "failed",
		});

		expect(set.mock.calls[0]?.[0]).toMatchObject({
			errorCode: "gate_blocked",
			status: "blocked",
		});
		expect(set.mock.calls[1]?.[0]?.errorMessage).toHaveLength(500);
	});

	it("fails only the live rows with no change since the cutoff", async () => {
		const cutoff = new Date("2026-10-01T11:30:00.000Z");
		const { repository, set, updateWhere } = fakeDb({
			updated: [{ id: BUILD_ID }],
		});

		expect(await repository.failStaleLive(PROJECT_ID, cutoff)).toBe(1);
		expect(set.mock.calls[0]?.[0]).toMatchObject({
			errorCode: "internal",
			status: "failed",
		});
		const predicate = compile(updateWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("app_builds"."project_id" = $1 and "app_builds"."status" in ($2, $3, $4) and "app_builds"."updated_at" < $5)',
		);
		expect(predicate.params).toEqual([
			PROJECT_ID,
			"queued",
			"building",
			"uploading",
			cutoff.toISOString(),
		]);
	});
});
