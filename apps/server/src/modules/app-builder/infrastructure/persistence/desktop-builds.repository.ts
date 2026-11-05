/**
 * Repository for `desktop_apps` and `desktop_builds` (docs/v2/desktop-apps.md
 * sections 8 to 11). `DesktopBuildsService` calls it in the API process; the
 * `desktop-build` Trigger task calls `findForTask`, `findMigrationsCommit`,
 * and `transition`; the key rotation script calls the cipher methods; the
 * staff suspend calls `withdrawRelease`; the `delete-app-project` task calls
 * `deleteApp`. The `ready` transition also writes `desktop_migrations`;
 * `DesktopMigrationsRepository` reads them.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	type DesktopBuildErrorCode,
	type DesktopGateFinding,
	type DesktopPlatform,
	liveDesktopBuildStatuses,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	lt,
	or,
	sql,
} from "@wandit/db";
import {
	desktopApps,
	desktopBuilds,
	desktopMigrations,
} from "@wandit/db/schema/desktop-apps";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	creditOwnerLockValue,
	ownerFromIds,
} from "../../../credits/domain/credit-owner";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";
import {
	DESKTOP_SIGNING_STUCK_AFTER_MS,
	desktopStatusesThatMayMoveTo,
	desktopVersion,
	MAX_LIVE_DESKTOP_BUILDS_PER_PAYER,
	userCancelableDesktopBuildStatuses,
} from "../../domain/desktop-build";
import type { ReleasedDesktopMigration } from "../../domain/desktop-migrations";
import type { EncryptedSecret } from "../secrets/secret-crypto";
import { isUniqueViolation } from "./builder-turns.repository";

/** One `desktop_builds` row as Drizzle returns it. */
export type DesktopBuildRow = typeof desktopBuilds.$inferSelect;

/** One `desktop_apps` row as Drizzle returns it. It holds the encrypted updater key. */
export type DesktopAppRow = typeof desktopApps.$inferSelect;

/** The project columns that the desktop routes check. */
export type DesktopProject = Pick<
	typeof projects.$inferSelect,
	"id" | "engine" | "framework" | "name" | "suspendedAt" | "suspendedReasonCode"
>;

/** Columns of a new `queued` build. The repository adds the release number and the version. */
export type NewDesktopBuild = {
	/** Server-made uuid. The task payload and the audit row name it. */
	id: string;
	/** The user who asked for the build. */
	userId: string;
	/** Org workspace of the project, or null on a personal project. */
	organizationId: string | null;
	projectId: string;
	/** Head of `main` at request time. The task builds this commit. */
	commitSha: string;
	/** Release notes from the request, or null. */
	notes: string | null;
	/** Client uuid of the create request. Unique per project. */
	requestKey: string;
	/** The system of the build, from the create body. */
	platform: DesktopPlatform;
};

/** The `desktop_apps` row of the first build of a project. */
export type NewDesktopApp = {
	projectId: string;
	/** Owner pair of the project, as on `projects`. */
	userId: string;
	organizationId: string | null;
	/** Name of the app on both systems. It never changes after this insert. */
	productName: string;
	/** ASCII exe name from `desktopBinaryName`. It never changes either. */
	binaryName: string;
	/** 16 uppercase hex digits, from `generateUpdaterKeyPair`. */
	updaterKeyId: string;
	/** Base64 minisign public key text, from `generateUpdaterKeyPair`. */
	updaterPublicKey: string;
	/** The private key, encrypted by `encryptDesktopUpdaterKey`. */
	updaterPrivateKey: EncryptedSecret;
};

/**
 * Result of `insertQueued`. `request_exists` answers the row of a retried
 * request with the same `(projectId, requestKey)`. `live_exists` means the
 * live index refused the insert: another build of the project is live.
 * `payer_limit` means the payer has MAX_LIVE_DESKTOP_BUILDS_PER_PAYER live builds.
 */
export type InsertDesktopBuildResult =
	| { kind: "created"; row: DesktopBuildRow }
	| { kind: "request_exists"; row: DesktopBuildRow }
	| { kind: "live_exists" }
	| { kind: "payer_limit" };

/**
 * One status change and the columns it writes. `transition` applies it only
 * when the row holds a status from `desktopStatusesThatMayMoveTo(to)`.
 */
export type DesktopBuildTransition =
	| {
			to: "preparing";
			/** Id of the Trigger.dev run that claims the queued row. */
			triggerRunId: string;
	  }
	| {
			to: "building";
			/** GitHub workflow run id as decimal text, from `DesktopBuildRunner.dispatch`. */
			ciRunId: string;
	  }
	| { to: "signing" }
	| {
			to: "ready";
			/** R2 key of the download file (setup exe or disk image) in the folder of `desktopBuildFolderKey`. */
			installerKey: string;
			/** Lowercase hex SHA-256 of the download file bytes. */
			installerSha256: string;
			/** Size of the download file in bytes. */
			installerBytes: number;
			/** macOS: R2 key of the signed `.app.tar.gz` in the build folder. Windows: null. */
			updateArchiveKey: string | null;
			/** Base64 signature text of the update file, from `signUpdaterArtifact`. */
			updaterSignature: string;
			/** Every migration file of the build. Frozen rows stay; the new files become frozen. */
			migrations: ReleasedDesktopMigration[];
	  }
	| {
			to: "failed";
			errorCode: DesktopBuildErrorCode;
			/** English detail for support, never a token. The write keeps its first 500 characters. */
			errorMessage: string;
	  }
	| {
			to: "blocked";
			/** The findings of the gate or the secret scanner. Never empty. */
			findings: DesktopGateFinding[];
	  }
	| {
			to: "canceled";
			/**
			 * "user": the cancel route of the API. It stops a `signing` build only
			 * after DESKTOP_SIGNING_STUCK_AFTER_MS. "task": the task stop, which
			 * stops every live status.
			 */
			by: "user" | "task";
	  };

/**
 * What `release` reads on its own transaction after the app row lock, for
 * the `publishObjects` callback.
 */
export type DesktopReleaseState = {
	/** Release number of the current build of the same platform, or null before its first release. */
	currentReleaseNumber: number | null;
	/** Reads `projects` again. False after a staff suspend or a project delete. */
	isProjectActive: () => Promise<boolean>;
};

/** The cipher columns of one app, for the key rotation. */
export type DesktopUpdaterKeyRow = Pick<
	DesktopAppRow,
	"projectId" | "updaterPrivateKeyCiphertext" | "updaterKeyVersion"
>;

// Security rule of section 9: a stored failure text stays short. This write
// is the one place that stores it, so every caller gets the same cap.
const ERROR_MESSAGE_MAX_LENGTH = 500;

/** Drizzle persistence of desktop apps and builds. Every status change is a compare-and-set. */
@Injectable()
export class DesktopBuildsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The project in the scope, or null for another workspace or a deleted project. */
	async findProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<DesktopProject | null> {
		const [row] = await this.db
			.select({
				engine: projects.engine,
				framework: projects.framework,
				id: projects.id,
				name: projects.name,
				suspendedAt: projects.suspendedAt,
				suspendedReasonCode: projects.suspendedReasonCode,
			})
			.from(projects)
			.where(
				and(
					projectScopePredicate(scope),
					eq(projects.id, projectId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The desktop identity of a project, or null before its first build request. */
	async findApp(projectId: string): Promise<DesktopAppRow | null> {
		const [row] = await this.db
			.select()
			.from(desktopApps)
			.where(eq(desktopApps.projectId, projectId))
			.limit(1);
		return row ?? null;
	}

	/** The row, or null. The caller checks `projectId` against its own project. */
	async findById(buildId: string): Promise<DesktopBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(desktopBuilds)
			.where(eq(desktopBuilds.id, buildId))
			.limit(1);
		return row ?? null;
	}

	/** The row that an earlier request with the same key made, or null. */
	async findByRequestKey(
		projectId: string,
		requestKey: string,
	): Promise<DesktopBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(desktopBuilds)
			.where(
				and(
					eq(desktopBuilds.projectId, projectId),
					eq(desktopBuilds.requestKey, requestKey),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The live build of a project, or null. */
	async findLive(projectId: string): Promise<DesktopBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(desktopBuilds)
			.where(
				and(
					eq(desktopBuilds.projectId, projectId),
					inArray(desktopBuilds.status, [...liveDesktopBuildStatuses]),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The newest builds of a project, at most `limit` rows. */
	async listRecent(
		projectId: string,
		limit: number,
	): Promise<DesktopBuildRow[]> {
		return this.db
			.select()
			.from(desktopBuilds)
			.where(eq(desktopBuilds.projectId, projectId))
			.orderBy(desc(desktopBuilds.createdAt), desc(desktopBuilds.id))
			.limit(limit);
	}

	/**
	 * One build with its app row, for the `desktop-build` task. Null when the
	 * build row is gone. `app` is null after `deleteApp` of the project delete,
	 * so the task still cancels a queued build and refunds its hold at once.
	 */
	async findForTask(
		buildId: string,
	): Promise<{ build: DesktopBuildRow; app: DesktopAppRow | null } | null> {
		const [row] = await this.db
			.select({ app: desktopApps, build: desktopBuilds })
			.from(desktopBuilds)
			.leftJoin(desktopApps, eq(desktopApps.projectId, desktopBuilds.projectId))
			.where(eq(desktopBuilds.id, buildId))
			.limit(1);
		return row ?? null;
	}

	/**
	 * The commit whose `migrations/` a build of `commitSha` embeds (section 10).
	 * A commit that a ready build already holds is a rebuild of older code. It
	 * can lack newer frozen files, so it gets a commit that holds every frozen
	 * file. A new commit gets itself.
	 */
	async findMigrationsCommit(
		projectId: string,
		commitSha: string,
	): Promise<string> {
		const [shipped] = await this.db
			.select({ id: desktopBuilds.id })
			.from(desktopBuilds)
			.where(
				and(
					eq(desktopBuilds.projectId, projectId),
					eq(desktopBuilds.status, "ready"),
					eq(desktopBuilds.commitSha, commitSha),
				),
			)
			.limit(1);
		if (shipped === undefined) {
			return commitSha;
		}
		// The gate gives each new file a version above every frozen file. So the
		// build that froze the highest version held every frozen file at its own
		// commit. A rebuild never freezes a file: all its files are frozen already.
		const [newest] = await this.db
			.select({ commitSha: desktopBuilds.commitSha })
			.from(desktopMigrations)
			.innerJoin(
				desktopBuilds,
				eq(desktopBuilds.id, desktopMigrations.firstBuildId),
			)
			.where(eq(desktopMigrations.projectId, projectId))
			.orderBy(desc(desktopMigrations.version))
			.limit(1);
		return newest?.commitSha ?? commitSha;
	}

	/**
	 * Inserts a `queued` build with the next release number, and the app row
	 * first when `firstApp` is set. The payer lock and count refuse a build
	 * over MAX_LIVE_DESKTOP_BUILDS_PER_PAYER. A unique violation comes from the
	 * request key, the live build, or the release number index; the request
	 * key lookup and one retry tell them apart.
	 */
	async insertQueued(
		build: NewDesktopBuild,
		firstApp: NewDesktopApp | null,
	): Promise<InsertDesktopBuildResult> {
		for (let attempt = 1; attempt <= 2; attempt += 1) {
			try {
				return await this.insertQueuedOnce(build, firstApp);
			} catch (error) {
				if (!isUniqueViolation(error)) {
					throw error;
				}
				const existing = await this.findByRequestKey(
					build.projectId,
					build.requestKey,
				);
				if (existing) {
					return { kind: "request_exists", row: existing };
				}
				// No row of this request: the live index or the release number
				// index refused. The retry reads a fresh highest number, and the
				// live index refuses again when another build is live.
			}
		}
		return { kind: "live_exists" };
	}

	/**
	 * Stores the run id that `tasks.trigger` answered. No compare-and-set:
	 * the task claims the row with the same id, so the order of the two
	 * writes does not matter.
	 */
	async setTriggerRunId(buildId: string, triggerRunId: string): Promise<void> {
		await this.db
			.update(desktopBuilds)
			.set({ triggerRunId })
			.where(eq(desktopBuilds.id, buildId));
	}

	/**
	 * Compare-and-set of one status change. A terminal status also sets
	 * `completedAt`. Answers the updated row, or null when the row holds a
	 * status that may not move to `change.to`. `ready` also answers null for
	 * a suspended or deleted project.
	 */
	async transition(
		buildId: string,
		change: DesktopBuildTransition,
	): Promise<DesktopBuildRow | null> {
		const where = and(
			eq(desktopBuilds.id, buildId),
			change.to === "canceled" && change.by === "user"
				? userCancelWhere()
				: inArray(
						desktopBuilds.status,
						desktopStatusesThatMayMoveTo(change.to),
					),
		);
		if (change.to !== "ready") {
			const [row] = await this.db
				.update(desktopBuilds)
				.set(transitionColumns(change))
				.where(where)
				.returning();
			return row ?? null;
		}
		// Security: a takedown or a delete can land while the build signs and
		// uploads. If this write sees it, it answers null and the task deletes
		// its files. If this write commits first, `withdrawRelease` or the
		// delete drain runs after it and removes the files.
		const readyWhere = and(
			where,
			sql`NOT EXISTS (SELECT 1 FROM ${projects} WHERE ${projects.id} = ${desktopBuilds.projectId} AND (${projects.suspendedReasonCode} IS NOT NULL OR ${projects.deletedAt} IS NOT NULL))`,
		);
		// The file fields and the frozen files commit together: a ready
		// build always has its migrations in the registry (section 9, step 5).
		return this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(desktopBuilds)
				.set(transitionColumns(change))
				.where(readyWhere)
				.returning();
			if (!row) {
				return null;
			}
			if (change.migrations.length > 0) {
				await tx
					.insert(desktopMigrations)
					.values(
						change.migrations.map((migration) => ({
							firstBuildId: row.id,
							name: migration.name,
							projectId: row.projectId,
							sha256: migration.sha256,
							version: migration.version,
						})),
					)
					// A frozen file keeps the row of the first build that held it.
					.onConflictDoNothing();
			}
			return row;
		});
	}

	/**
	 * Makes one ready build of `platform` the current build of that platform.
	 * The app row lock queues two releases of one project, so the R2 objects
	 * that `publishObjects` writes always match the pointer of the platform.
	 * The other platform does not change. A throw of `publishObjects` rolls
	 * back the database.
	 */
	async release(
		projectId: string,
		buildId: string,
		/** `desktop_builds.platform` of the build. A build of the other platform throws. */
		platform: DesktopPlatform,
		publishObjects: (state: DesktopReleaseState) => Promise<void>,
	): Promise<DesktopBuildRow> {
		const currentBuildColumn =
			platform === "windows"
				? desktopApps.currentWindowsBuildId
				: desktopApps.currentMacosBuildId;
		return this.db.transaction(async (tx) => {
			// LIMIT: the row lock and one pool connection stay held while R2 copies
			// the download file (up to 300 MB). A create of the same project waits.
			// That create holds the payer lock of `insertQueuedOnce`, so every create
			// of the same payer in other projects waits too. Each waiting create
			// holds one pool connection.
			// Upgrade: a Redis lock per project around the R2 writes, then a short transaction.
			const [locked] = await tx
				.select({ currentBuildId: currentBuildColumn })
				.from(desktopApps)
				.where(eq(desktopApps.projectId, projectId))
				.for("update");
			// A second query, not a join: after a wait on the lock, Postgres keeps
			// the joined row of the old snapshot. A parallel release of a newer
			// build then reads as null and skips the downgrade guard.
			const [current] = locked?.currentBuildId
				? await tx
						.select({ releaseNumber: desktopBuilds.releaseNumber })
						.from(desktopBuilds)
						.where(eq(desktopBuilds.id, locked.currentBuildId))
				: [];
			await publishObjects({
				currentReleaseNumber: current?.releaseNumber ?? null,
				// Every read inside the transaction runs on `tx`. A read on the pool
				// waits for a second connection, and ten parallel releases then hold
				// all ten and wait for good (security audit A2).
				isProjectActive: async () => {
					const [project] = await tx
						.select({ id: projects.id })
						.from(projects)
						.where(
							and(
								eq(projects.id, projectId),
								isNull(projects.suspendedReasonCode),
								isNull(projects.deletedAt),
							),
						)
						.limit(1);
					return project !== undefined;
				},
			});
			const [row] = await tx
				.update(desktopBuilds)
				.set({ releasedAt: new Date() })
				.where(
					and(
						eq(desktopBuilds.id, buildId),
						eq(desktopBuilds.projectId, projectId),
						eq(desktopBuilds.status, "ready"),
						eq(desktopBuilds.platform, platform),
					),
				)
				.returning();
			if (!row) {
				throw new Error(
					`Desktop build ${buildId} is not a ready ${platform} build of project ${projectId}`,
				);
			}
			await tx
				.update(desktopApps)
				.set(
					platform === "windows"
						? { currentWindowsBuildId: buildId }
						: { currentMacosBuildId: buildId },
				)
				.where(eq(desktopApps.projectId, projectId));
			return row;
		});
	}

	/**
	 * Removes the current build of both platforms and every file key of a
	 * project (download files and update archives). The staff suspend calls it
	 * before it deletes `desktop/<projectId>/` on R2. The release refuses a
	 * build with no file key, so the owner builds again.
	 */
	async withdrawRelease(projectId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			// The app row goes first, in the lock order of `release`, so the two
			// never deadlock. This UPDATE waits for a release in progress, so the
			// R2 delete of the caller runs after the last write of that release.
			await tx
				.update(desktopApps)
				.set({ currentMacosBuildId: null, currentWindowsBuildId: null })
				.where(eq(desktopApps.projectId, projectId));
			await tx
				.update(desktopBuilds)
				.set({ installerKey: null, updateArchiveKey: null })
				.where(eq(desktopBuilds.projectId, projectId));
		});
	}

	/**
	 * Deletes the app row with its encrypted updater key and answers the
	 * count (0 or 1). The project delete calls it: a soft delete cascades
	 * nothing. The build and migration rows reference `projects`, so they
	 * stay. A queued build then gets a null app from `findForTask`.
	 */
	async deleteApp(projectId: string): Promise<number> {
		const rows = await this.db
			.delete(desktopApps)
			.where(eq(desktopApps.projectId, projectId))
			.returning({ projectId: desktopApps.projectId });
		return rows.length;
	}

	/** One page of apps whose updater key an older ring version encrypted, by project id. */
	async listAppsBelowKeyVersion(
		keyVersion: number,
		afterProjectId: string | null,
		limit: number,
	): Promise<DesktopUpdaterKeyRow[]> {
		const belowVersion = lt(desktopApps.updaterKeyVersion, keyVersion);
		return this.db
			.select({
				projectId: desktopApps.projectId,
				updaterKeyVersion: desktopApps.updaterKeyVersion,
				updaterPrivateKeyCiphertext: desktopApps.updaterPrivateKeyCiphertext,
			})
			.from(desktopApps)
			.where(
				afterProjectId === null
					? belowVersion
					: and(belowVersion, gt(desktopApps.projectId, afterProjectId)),
			)
			.orderBy(asc(desktopApps.projectId))
			.limit(limit);
	}

	/**
	 * Writes a re-encrypted updater key only while the row still holds
	 * `expectedKeyVersion`. Answers false when another rotation won.
	 */
	async replaceUpdaterKeyCipher(
		projectId: string,
		expectedKeyVersion: number,
		next: EncryptedSecret,
	): Promise<boolean> {
		const rows = await this.db
			.update(desktopApps)
			.set({
				updaterKeyVersion: next.keyVersion,
				updaterPrivateKeyCiphertext: next.ciphertext,
			})
			.where(
				and(
					eq(desktopApps.projectId, projectId),
					eq(desktopApps.updaterKeyVersion, expectedKeyVersion),
				),
			)
			.returning({ projectId: desktopApps.projectId });
		return rows.length > 0;
	}

	private async insertQueuedOnce(
		build: NewDesktopBuild,
		firstApp: NewDesktopApp | null,
	): Promise<InsertDesktopBuildResult> {
		return this.db.transaction(async (tx) => {
			// The payer lock queues every create of one payer, so two parallel
			// creates never both pass the count. The prefix keeps it apart from
			// the credit lock of the same payer.
			const payer = ownerFromIds(build.userId, build.organizationId);
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`desktop-builds:${creditOwnerLockValue(payer)}`}))`,
			);
			// A parallel retry of the same click shares the hold of its first
			// row, so it must answer that row and never `payer_limit`.
			const [existing] = await tx
				.select()
				.from(desktopBuilds)
				.where(
					and(
						eq(desktopBuilds.projectId, build.projectId),
						eq(desktopBuilds.requestKey, build.requestKey),
					),
				)
				.limit(1);
			if (existing !== undefined) {
				return { kind: "request_exists", row: existing };
			}
			// Same payer split as `AppBackendsRepository.countActiveForOwner`: a
			// personal count must not see the rows of an org the user created.
			const [live] = await tx
				.select({ total: sql<number>`count(*)::int` })
				.from(desktopBuilds)
				// A build of a deleted project never blocks a new one: nobody can
				// cancel it, and its task cancels it at the next stop check.
				.innerJoin(
					projects,
					and(
						eq(projects.id, desktopBuilds.projectId),
						isNull(projects.deletedAt),
					),
				)
				.where(
					and(
						payer.type === "org"
							? eq(desktopBuilds.organizationId, payer.organizationId)
							: and(
									eq(desktopBuilds.userId, payer.userId),
									isNull(desktopBuilds.organizationId),
								),
						inArray(desktopBuilds.status, [...liveDesktopBuildStatuses]),
					),
				);
			if ((live?.total ?? 0) >= MAX_LIVE_DESKTOP_BUILDS_PER_PAYER) {
				return { kind: "payer_limit" };
			}
			if (firstApp !== null) {
				// A parallel first build may insert the app first. Its key pair
				// then stays, and this one is dropped before anyone uses it.
				await tx
					.insert(desktopApps)
					.values({
						binaryName: firstApp.binaryName,
						organizationId: firstApp.organizationId,
						productName: firstApp.productName,
						projectId: firstApp.projectId,
						updaterKeyId: firstApp.updaterKeyId,
						updaterKeyVersion: firstApp.updaterPrivateKey.keyVersion,
						updaterPrivateKeyCiphertext: firstApp.updaterPrivateKey.ciphertext,
						updaterPublicKey: firstApp.updaterPublicKey,
						userId: firstApp.userId,
					})
					.onConflictDoNothing();
			}
			// The row lock queues the creates of one project, so each create
			// reads the release number of the one before it.
			const [app] = await tx
				.select({ productName: desktopApps.productName })
				.from(desktopApps)
				.where(eq(desktopApps.projectId, build.projectId))
				.for("update");
			if (!app) {
				throw new Error(
					`desktop_apps row of project ${build.projectId} is missing`,
				);
			}
			const [last] = await tx
				.select({
					releaseNumber: sql<
						number | null
					>`max(${desktopBuilds.releaseNumber})`,
				})
				.from(desktopBuilds)
				.where(eq(desktopBuilds.projectId, build.projectId));
			// LIMIT: 65,535 builds per project (the check constraint, because NSIS
			// packs each version part in 16 bits). Upgrade: a 1.<minor>.<patch> scheme.
			const releaseNumber = (last?.releaseNumber ?? 0) + 1;
			const [row] = await tx
				.insert(desktopBuilds)
				.values({
					...build,
					productName: app.productName,
					releaseNumber,
					status: "queued",
					version: desktopVersion(releaseNumber),
				})
				.returning();
			if (!row) {
				throw new Error("desktop_builds insert did not return a row");
			}
			return { kind: "created", row };
		});
	}
}

// The rows that the cancel route may stop. A `signing` build normally ends
// in minutes, and its CI minutes are spent, so a cancel there would make a
// signed installer free (security audit A1). Only a run that crashed leaves
// the row in `signing` past DESKTOP_SIGNING_STUCK_AFTER_MS.
function userCancelWhere() {
	return or(
		inArray(desktopBuilds.status, [...userCancelableDesktopBuildStatuses]),
		and(
			eq(desktopBuilds.status, "signing"),
			lt(
				desktopBuilds.updatedAt,
				new Date(Date.now() - DESKTOP_SIGNING_STUCK_AFTER_MS),
			),
		),
	);
}

// The new status and the other columns that one status change writes.
function transitionColumns(
	change: DesktopBuildTransition,
): Partial<typeof desktopBuilds.$inferInsert> {
	switch (change.to) {
		case "preparing":
			return { status: "preparing", triggerRunId: change.triggerRunId };
		case "building":
			return { ciRunId: change.ciRunId, status: "building" };
		case "signing":
			return { status: "signing" };
		case "ready":
			return {
				completedAt: new Date(),
				installerBytes: change.installerBytes,
				installerKey: change.installerKey,
				installerSha256: change.installerSha256,
				status: "ready",
				updateArchiveKey: change.updateArchiveKey,
				updaterSignature: change.updaterSignature,
			};
		case "failed":
			return {
				completedAt: new Date(),
				errorCode: change.errorCode,
				errorMessage: change.errorMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH),
				status: "failed",
			};
		case "blocked":
			return {
				completedAt: new Date(),
				findings: change.findings,
				status: "blocked",
			};
		case "canceled":
			return { completedAt: new Date(), status: "canceled" };
	}
}
