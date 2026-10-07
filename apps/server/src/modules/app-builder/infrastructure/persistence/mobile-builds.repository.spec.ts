import { PgDialect, type SQL } from "@wandit/db";
import type { mobileBuilds } from "@wandit/db/schema/mobile-builds";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	MalformedMobileBuildCursorError,
	type MobileBuildRow,
	MobileBuildsRepository,
	type NewMobileBuild,
} from "./mobile-builds.repository";

type MobileBuildInsert = typeof mobileBuilds.$inferInsert;

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
const OLDER_BUILD_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const PROJECT_ID = "0f3a9c1b-4e7d-4a2b-9c3d-1e2f3a4b5c6d";
const REQUEST_KEY = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const ROW: MobileBuildRow = {
	artifactUrl: null,
	commitSha: "a".repeat(40),
	completedAt: null,
	createdAt: new Date("2026-09-26T10:00:00.000Z"),
	easBuildId: null,
	errorCode: null,
	errorMessage: null,
	id: BUILD_ID,
	kind: "apk",
	organizationId: null,
	platform: "android",
	projectId: PROJECT_ID,
	requestKey: REQUEST_KEY,
	status: "queued",
	triggerRunId: null,
	updatedAt: new Date("2026-09-26T10:00:00.000Z"),
	userId: "user-1",
};

const NEW_BUILD: NewMobileBuild = {
	commitSha: ROW.commitSha,
	id: BUILD_ID,
	kind: "apk",
	organizationId: null,
	platform: "android",
	projectId: PROJECT_ID,
	requestKey: REQUEST_KEY,
	userId: "user-1",
};

// Drizzle wraps the driver error, so the 23505 sits in the cause.
const UNIQUE_VIOLATION = new Error("insert failed", {
	cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
});

// A fake db with the insert, select, and update chains the repository calls.
function fakeDb(options: {
	inserted?: MobileBuildRow[];
	insertError?: Error;
	selected?: MobileBuildRow[];
	updated?: MobileBuildRow[];
}) {
	const values = vi.fn((_row: MobileBuildInsert) => ({
		returning: async () => {
			if (options.insertError) {
				throw options.insertError;
			}
			return options.inserted ?? [ROW];
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
	const set = vi.fn((_columns: Partial<MobileBuildInsert>) => ({
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
		orderBy,
		repository: new MobileBuildsRepository(db),
		selectWhere,
		set,
		updateWhere,
		values,
	};
}

describe("MobileBuildsRepository.insertQueued", () => {
	it("inserts a queued row and answers created", async () => {
		const { repository, values } = fakeDb({});

		const result = await repository.insertQueued(NEW_BUILD);

		expect(result).toEqual({ kind: "created", row: ROW });
		expect(values).toHaveBeenCalledWith({ ...NEW_BUILD, status: "queued" });
	});

	it("answers the earlier row of a retried request key", async () => {
		const earlier = { ...ROW, status: "building" as const };
		const { repository, selectWhere } = fakeDb({
			insertError: UNIQUE_VIOLATION,
			selected: [earlier],
		});

		const result = await repository.insertQueued(NEW_BUILD);

		expect(result).toEqual({ kind: "request_exists", row: earlier });
		const predicate = compile(selectWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("mobile_builds"."project_id" = $1 and "mobile_builds"."request_key" = $2)',
		);
		expect(predicate.params).toEqual([PROJECT_ID, REQUEST_KEY]);
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

	it("rejects an insert that returns no row", async () => {
		const { repository } = fakeDb({ inserted: [] });

		await expect(repository.insertQueued(NEW_BUILD)).rejects.toThrow(
			"mobile_builds insert did not return a row",
		);
	});

	it("rethrows an insert error that is not a unique violation", async () => {
		const failure = new Error("connection lost");
		const { repository, selectWhere } = fakeDb({ insertError: failure });

		await expect(repository.insertQueued(NEW_BUILD)).rejects.toBe(failure);
		expect(selectWhere).not.toHaveBeenCalled();
	});
});

describe("MobileBuildsRepository reads", () => {
	it("finds the live build of a project and platform", async () => {
		const { repository, selectWhere } = fakeDb({ selected: [ROW] });

		expect(await repository.findLive(PROJECT_ID, "android")).toEqual(ROW);
		const predicate = compile(selectWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("mobile_builds"."project_id" = $1 and "mobile_builds"."platform" = $2 and "mobile_builds"."status" in ($3, $4))',
		);
		expect(predicate.params).toEqual([
			PROJECT_ID,
			"android",
			"queued",
			"building",
		]);
	});

	it("answers null when no row matches the id", async () => {
		const { repository, selectWhere } = fakeDb({ selected: [] });

		expect(await repository.findById(BUILD_ID)).toBeNull();
		expect(compile(selectWhere.mock.calls[0]?.[0]).params).toEqual([BUILD_ID]);
	});
});

describe("MobileBuildsRepository.listByProject", () => {
	it("pages newest first inside the project after the cursor", async () => {
		const { limit, orderBy, repository, selectWhere } = fakeDb({
			selected: [ROW],
		});

		const page = await repository.listByProject(PROJECT_ID, {
			cursor: `2026-09-26T11:00:00.000Z_${OLDER_BUILD_ID}`,
			limit: 2,
		});

		expect(page).toEqual({ items: [ROW], nextCursor: null });
		const predicate = compile(selectWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("mobile_builds"."project_id" = $1 and ("mobile_builds"."created_at" < $2 or ("mobile_builds"."created_at" = $3 and "mobile_builds"."id" < $4)))',
		);
		expect(predicate.params).toEqual([
			PROJECT_ID,
			"2026-09-26T11:00:00.000Z",
			"2026-09-26T11:00:00.000Z",
			OLDER_BUILD_ID,
		]);
		expect(orderBy.mock.calls[0]?.map((order) => compile(order).sql)).toEqual([
			'"mobile_builds"."created_at" desc',
			'"mobile_builds"."id" desc',
		]);
		expect(limit).toHaveBeenCalledWith(3);
	});

	it("answers the cursor of the last item when one more row exists", async () => {
		const older = { ...ROW, id: OLDER_BUILD_ID };
		const { repository } = fakeDb({ selected: [ROW, older] });

		const page = await repository.listByProject(PROJECT_ID, { limit: 1 });

		expect(page).toEqual({
			items: [ROW],
			nextCursor: `2026-09-26T10:00:00.000Z_${BUILD_ID}`,
		});
	});

	it.each([
		"not-a-cursor",
		`_${BUILD_ID}`,
		`yesterday_${BUILD_ID}`,
		"2026-09-26T11:00:00.000Z_row-5",
	])("rejects the malformed cursor %s before a query", async (cursor) => {
		const { limit, repository } = fakeDb({ selected: [ROW] });

		await expect(
			repository.listByProject(PROJECT_ID, { cursor, limit: 20 }),
		).rejects.toBeInstanceOf(MalformedMobileBuildCursorError);
		expect(limit).not.toHaveBeenCalled();
	});
});

describe("MobileBuildsRepository.transition", () => {
	it("claims a queued row for a run", async () => {
		const building = { ...ROW, status: "building" as const };
		const { repository, set, updateWhere } = fakeDb({ updated: [building] });

		const row = await repository.transition(BUILD_ID, {
			to: "building",
			triggerRunId: "run_1",
		});

		expect(row).toEqual(building);
		expect(set).toHaveBeenCalledWith({
			status: "building",
			triggerRunId: "run_1",
		});
		const predicate = compile(updateWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("mobile_builds"."id" = $1 and "mobile_builds"."status" in ($2))',
		);
		expect(predicate.params).toEqual([BUILD_ID, "queued"]);
	});

	it("finishes only a building row and sets completedAt", async () => {
		const { repository, set, updateWhere } = fakeDb({ updated: [ROW] });

		await repository.transition(BUILD_ID, {
			artifactUrl: "https://expo.dev/artifacts/eas/app.apk",
			to: "finished",
		});

		expect(set).toHaveBeenCalledWith({
			artifactUrl: "https://expo.dev/artifacts/eas/app.apk",
			completedAt: expect.any(Date),
			status: "finished",
		});
		expect(compile(updateWhere.mock.calls[0]?.[0]).params).toEqual([
			BUILD_ID,
			"building",
		]);
	});

	it("fails a live row and keeps the first 500 characters of the message", async () => {
		const { repository, set, updateWhere } = fakeDb({ updated: [ROW] });

		await repository.transition(BUILD_ID, {
			errorCode: "eas_errored",
			errorMessage: `${"x".repeat(500)}TAIL`,
			to: "failed",
		});

		expect(set).toHaveBeenCalledWith({
			completedAt: expect.any(Date),
			errorCode: "eas_errored",
			errorMessage: "x".repeat(500),
			status: "failed",
		});
		expect(compile(updateWhere.mock.calls[0]?.[0]).params).toEqual([
			BUILD_ID,
			"queued",
			"building",
		]);
	});

	it("answers null when the row already left the allowed statuses", async () => {
		const { repository, set } = fakeDb({ updated: [] });

		expect(
			await repository.transition(BUILD_ID, { to: "canceled" }),
		).toBeNull();
		expect(set).toHaveBeenCalledWith({
			completedAt: expect.any(Date),
			status: "canceled",
		});
	});
});

describe("MobileBuildsRepository.setEasBuildId", () => {
	it("writes the id only on a building row without an EAS id", async () => {
		const { repository, set, updateWhere } = fakeDb({ updated: [ROW] });

		expect(await repository.setEasBuildId(BUILD_ID, "eas-1")).toBe(true);
		expect(set).toHaveBeenCalledWith({ easBuildId: "eas-1" });
		const predicate = compile(updateWhere.mock.calls[0]?.[0]);
		expect(predicate.sql).toBe(
			'("mobile_builds"."id" = $1 and "mobile_builds"."status" = $2 and "mobile_builds"."eas_build_id" is null)',
		);
		expect(predicate.params).toEqual([BUILD_ID, "building"]);
	});

	it("answers false when the row left building", async () => {
		const { repository } = fakeDb({ updated: [] });

		expect(await repository.setEasBuildId(BUILD_ID, "eas-1")).toBe(false);
	});
});
