/**
 * Repository for the `mobile_builds` table (WANDIT-194).
 * `mobile-builds.service.ts` calls it in the API process. The `mobile-build`
 * Trigger task calls the compare-and-set methods inside a run. The partial
 * unique index `mobile_builds_live_project_platform_uq` is the last guard of
 * the one-live-build rule.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	isoDateTimeSchema,
	liveMobileBuildStatuses,
	type MobileBuildErrorCode,
	type MobileBuildKind,
	type MobileBuildPlatform,
	uuidSchema,
} from "@wandit/contracts";
import { and, desc, eq, inArray, isNull, lt, or, type SQL } from "@wandit/db";
import { mobileBuilds } from "@wandit/db/schema/mobile-builds";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { statusesThatMayMoveTo } from "../../domain/mobile-build";
import { isUniqueViolation } from "./builder-turns.repository";

/** One `mobile_builds` row as Drizzle returns it. */
export type MobileBuildRow = typeof mobileBuilds.$inferSelect;

/** Columns of a new `queued` row. `createdAt` and `updatedAt` are DB defaults. */
export type NewMobileBuild = {
	/** Server-made uuid. The credit hold key `mobile_build:<id>` needs it before the row exists. */
	id: string;
	/** The user who asked for the build. */
	userId: string;
	/** Org workspace of the project, or null on a personal project. */
	organizationId: string | null;
	projectId: string;
	platform: MobileBuildPlatform;
	kind: MobileBuildKind;
	/** Head of `main` on code.storage at request time. The task clones this commit. */
	commitSha: string;
	/** Client uuid of the create request. Unique per project. */
	requestKey: string;
};

/**
 * One status change and the columns it writes. `transition` applies it only
 * when the row holds a status from `statusesThatMayMoveTo(to)`.
 */
export type MobileBuildTransition =
	| {
			to: "building";
			/** Id of the Trigger.dev run that claims the queued row. */
			triggerRunId: string;
	  }
	| {
			to: "finished";
			/** Direct APK download URL that EAS reports on a FINISHED build. */
			artifactUrl: string;
	  }
	| {
			to: "failed";
			errorCode: MobileBuildErrorCode;
			/** Masked failure text. The write keeps its first 500 characters. */
			errorMessage: string;
	  }
	| { to: "canceled" };

/**
 * Result of `insertQueued`. `request_exists` answers the row of a retried
 * request with the same `(projectId, requestKey)`. `live_exists` means the
 * live index rejected the insert: a queued or building row holds the slot.
 */
export type InsertQueuedResult =
	| { kind: "created"; row: MobileBuildRow }
	| { kind: "request_exists"; row: MobileBuildRow }
	| { kind: "live_exists" };

/**
 * The list cursor is not a `<createdAt ISO>_<uuid>` pair. The repository
 * stays HTTP-free; the service answers 400.
 */
export class MalformedMobileBuildCursorError extends Error {
	constructor() {
		super("Malformed mobile builds cursor");
		this.name = "MalformedMobileBuildCursorError";
	}
}

// Security rule of WANDIT-194: a stored failure text stays short. This write
// is the one place that stores it, so every caller gets the same cap.
const ERROR_MESSAGE_MAX_LENGTH = 500;

/** Drizzle persistence for `mobile_builds`. Every status change is a compare-and-set. */
@Injectable()
export class MobileBuildsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts a `queued` row. A unique violation comes from the request key
	 * index or from the live index. The request key lookup tells them apart.
	 */
	async insertQueued(input: NewMobileBuild): Promise<InsertQueuedResult> {
		try {
			const [row] = await this.db
				.insert(mobileBuilds)
				.values({ ...input, status: "queued" })
				.returning();
			if (!row) {
				throw new Error("mobile_builds insert did not return a row");
			}
			return { kind: "created", row };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}
			const existing = await this.findByRequestKey(
				input.projectId,
				input.requestKey,
			);
			return existing
				? { kind: "request_exists", row: existing }
				: { kind: "live_exists" };
		}
	}

	/** The row, or null. The caller checks `projectId` against its own project. */
	async findById(id: string): Promise<MobileBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(mobileBuilds)
			.where(eq(mobileBuilds.id, id))
			.limit(1);
		return row ?? null;
	}

	/** The row an earlier request with the same key made, or null. */
	async findByRequestKey(
		projectId: string,
		requestKey: string,
	): Promise<MobileBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(mobileBuilds)
			.where(
				and(
					eq(mobileBuilds.projectId, projectId),
					eq(mobileBuilds.requestKey, requestKey),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The queued or building row of a project and platform, or null. */
	async findLive(
		projectId: string,
		platform: MobileBuildPlatform,
	): Promise<MobileBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(mobileBuilds)
			.where(
				and(
					eq(mobileBuilds.projectId, projectId),
					eq(mobileBuilds.platform, platform),
					inArray(mobileBuilds.status, [...liveMobileBuildStatuses]),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/**
	 * Pages the builds of one project, newest first. `cursor` is the
	 * `<createdAt ISO>_<id>` of the last row of the previous page. Throws
	 * `MalformedMobileBuildCursorError` for any other cursor text.
	 */
	async listByProject(
		projectId: string,
		page: { cursor?: string; limit: number },
	): Promise<{ items: MobileBuildRow[]; nextCursor: string | null }> {
		const predicates = [eq(mobileBuilds.projectId, projectId)];
		if (page.cursor !== undefined) {
			predicates.push(cursorPredicate(page.cursor));
		}
		const rows = await this.db
			.select()
			.from(mobileBuilds)
			.where(and(...predicates))
			.orderBy(desc(mobileBuilds.createdAt), desc(mobileBuilds.id))
			// One extra row tells whether a next page exists.
			.limit(page.limit + 1);

		const items = rows.slice(0, page.limit);
		const last = items.at(-1);
		return {
			items,
			nextCursor:
				rows.length > page.limit && last
					? `${last.createdAt.toISOString()}_${last.id}`
					: null,
		};
	}

	/**
	 * Stores the run id that `tasks.trigger` answered. No compare-and-set:
	 * the task claims the row with the same id, so the order of the two
	 * writes does not matter.
	 */
	async setTriggerRunId(id: string, triggerRunId: string): Promise<void> {
		await this.db
			.update(mobileBuilds)
			.set({ triggerRunId })
			.where(eq(mobileBuilds.id, id));
	}

	/**
	 * Compare-and-set of one status change. A terminal status also sets
	 * `completedAt`. Answers the updated row, or null when the row holds a
	 * status that may not move to `change.to`.
	 */
	async transition(
		id: string,
		change: MobileBuildTransition,
	): Promise<MobileBuildRow | null> {
		const [row] = await this.db
			.update(mobileBuilds)
			.set(transitionColumns(change))
			.where(
				and(
					eq(mobileBuilds.id, id),
					inArray(mobileBuilds.status, statusesThatMayMoveTo(change.to)),
				),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Stores the EAS build id once. Answers false when the row left
	 * `building` (the API canceled it) or already holds an EAS id.
	 */
	async setEasBuildId(id: string, easBuildId: string): Promise<boolean> {
		const rows = await this.db
			.update(mobileBuilds)
			.set({ easBuildId })
			.where(
				and(
					eq(mobileBuilds.id, id),
					eq(mobileBuilds.status, "building"),
					isNull(mobileBuilds.easBuildId),
				),
			)
			.returning({ id: mobileBuilds.id });
		return rows.length > 0;
	}
}

// The new status and the other columns that one status change writes.
function transitionColumns(
	change: MobileBuildTransition,
): Partial<typeof mobileBuilds.$inferInsert> {
	switch (change.to) {
		case "building":
			return { status: "building", triggerRunId: change.triggerRunId };
		case "finished":
			return {
				artifactUrl: change.artifactUrl,
				completedAt: new Date(),
				status: "finished",
			};
		case "failed":
			return {
				completedAt: new Date(),
				errorCode: change.errorCode,
				errorMessage: change.errorMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH),
				status: "failed",
			};
		case "canceled":
			return { completedAt: new Date(), status: "canceled" };
	}
}

// The cursor carries `createdAt` plus the row id, so equal timestamps keep a
// stable order. `<` on the pair gives the next older page. The cursor comes
// from the HTTP query, so both parts pass a contract schema before SQL.
// LIMIT: the cursor keeps milliseconds, but Postgres keeps microseconds. Two
// builds of one project in the same millisecond can skip a row at a page edge.
// Upgrade: a cursor with the microsecond timestamp text.
function cursorPredicate(cursor: string): SQL {
	const separator = cursor.indexOf("_");
	const createdAtText = cursor.slice(0, separator);
	const id = cursor.slice(separator + 1);
	if (
		separator < 1 ||
		!isoDateTimeSchema.safeParse(createdAtText).success ||
		!uuidSchema.safeParse(id).success
	) {
		throw new MalformedMobileBuildCursorError();
	}
	const createdAt = new Date(createdAtText);
	const predicate = or(
		lt(mobileBuilds.createdAt, createdAt),
		and(eq(mobileBuilds.createdAt, createdAt), lt(mobileBuilds.id, id)),
	);
	if (!predicate) {
		throw new Error("Mobile builds cursor predicate could not be constructed");
	}
	return predicate;
}
