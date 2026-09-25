/**
 * Read and write of the `project_secrets` rows of one project (WANDIT-185).
 * Callers: `ProjectSecretsService` (set, remove, list, read), the rotation,
 * `BackendSecretsService.markSynced` (WANDIT-186), and the project delete
 * and the pause sweep (`deleteAllForProject`, WANDIT-184). Every method
 * moves ciphertext only; the crypto lives in `secret-crypto.ts`.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { ProjectSecretKind } from "@wandit/contracts";
import { and, asc, eq, gt, lt, lte, sql } from "@wandit/db";
import { projectSecrets } from "@wandit/db/schema/project-secrets";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** The columns the list route answers. Never the ciphertext. */
export type ProjectSecretSummaryRow = {
	name: string;
	kind: ProjectSecretKind;
	createdAt: Date;
	updatedAt: Date;
};

/** The columns a decrypt needs. `projectId` and `name` are the AAD. */
export type ProjectSecretCipherRow = {
	id: string;
	projectId: string;
	name: string;
	/** Base64 of the IV, the auth tag, and the encrypted value. */
	ciphertext: string;
	/** The `APP_SECRETS_ENCRYPTION_KEY` version that encrypted the row. */
	keyVersion: number;
};

/** What `upsert` writes; the service encrypts before it builds this. */
export type ProjectSecretUpsertInput = {
	projectId: string;
	name: string;
	ciphertext: string;
	keyVersion: number;
	kind: ProjectSecretKind;
	/** Owner pair of the project, as on `projects`. Written on insert only. */
	userId: string;
	organizationId: string | null;
	/** The acting user; null for a `system` row. Written on insert only. */
	createdBy: string | null;
};

/** Answer of `deleteUserSecret`; the service maps it to 204, 409, or 404. */
export type DeleteUserSecretOutcome =
	| { outcome: "deleted"; id: string }
	| { outcome: "system" }
	| { outcome: "missing" };

// The columns a decrypt and a rotation read. The list route never selects
// `ciphertext`.
const CIPHER_COLUMNS = {
	ciphertext: projectSecrets.ciphertext,
	id: projectSecrets.id,
	keyVersion: projectSecrets.keyVersion,
	name: projectSecrets.name,
	projectId: projectSecrets.projectId,
};

@Injectable()
export class ProjectSecretsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts the row or replaces its ciphertext, version, and kind. Answers
	 * the row id, or null when a `user` write met a `system` row: the
	 * `setWhere` guard skips that update in the same statement, so no read
	 * before the write can race.
	 */
	async upsert(input: ProjectSecretUpsertInput): Promise<string | null> {
		const [row] = await this.db
			.insert(projectSecrets)
			.values({
				ciphertext: input.ciphertext,
				createdBy: input.createdBy,
				keyVersion: input.keyVersion,
				kind: input.kind,
				name: input.name,
				organizationId: input.organizationId,
				projectId: input.projectId,
				userId: input.userId,
			})
			.onConflictDoUpdate({
				target: [projectSecrets.projectId, projectSecrets.name],
				set: {
					ciphertext: input.ciphertext,
					keyVersion: input.keyVersion,
					kind: input.kind,
					updatedAt: new Date(),
					// A replaced value is not on the backend yet; the next push must run.
					syncedToBackendAt: null,
				},
				// A user never replaces a system row; server code replaces any row.
				...(input.kind === "user"
					? { setWhere: eq(projectSecrets.kind, "user") }
					: {}),
			})
			.returning({ id: projectSecrets.id });

		return row?.id ?? null;
	}

	/**
	 * Deletes one `user` row. A `system` row stays and answers `system`;
	 * no row answers `missing`. The kind guard sits in the delete itself,
	 * so a row that turns `system` between two calls is never removed.
	 */
	async deleteUserSecret(
		projectId: string,
		name: string,
	): Promise<DeleteUserSecretOutcome> {
		const [deleted] = await this.db
			.delete(projectSecrets)
			.where(
				and(
					eq(projectSecrets.projectId, projectId),
					eq(projectSecrets.name, name),
					eq(projectSecrets.kind, "user"),
				),
			)
			.returning({ id: projectSecrets.id });
		if (deleted !== undefined) {
			return { id: deleted.id, outcome: "deleted" };
		}

		const [row] = await this.db
			.select({ kind: projectSecrets.kind })
			.from(projectSecrets)
			.where(
				and(
					eq(projectSecrets.projectId, projectId),
					eq(projectSecrets.name, name),
				),
			)
			.limit(1);

		return row?.kind === "system"
			? { outcome: "system" }
			: { outcome: "missing" };
	}

	/**
	 * Deletes every row of one project, `user` and `system` kinds alike, and
	 * answers the count. The project delete calls it, and the pause sweep
	 * again before the Supabase delete: a soft delete cascades nothing.
	 */
	async deleteAllForProject(projectId: string): Promise<number> {
		const rows = await this.db
			.delete(projectSecrets)
			.where(eq(projectSecrets.projectId, projectId))
			.returning({ id: projectSecrets.id });

		return rows.length;
	}

	/** The names, kinds, and dates of one project, sorted by name. */
	async listSummaries(projectId: string): Promise<ProjectSecretSummaryRow[]> {
		// LIMIT: no page; a project holds a few dozen names. Upgrade: a cursor on `name`.
		return this.db
			.select({
				createdAt: projectSecrets.createdAt,
				kind: projectSecrets.kind,
				name: projectSecrets.name,
				updatedAt: projectSecrets.updatedAt,
			})
			.from(projectSecrets)
			.where(eq(projectSecrets.projectId, projectId))
			.orderBy(asc(projectSecrets.name));
	}

	/** The ciphertext row of one name, or null. Only `readValue` calls it. */
	async findCipherByName(
		projectId: string,
		name: string,
	): Promise<ProjectSecretCipherRow | null> {
		const [row] = await this.db
			.select(CIPHER_COLUMNS)
			.from(projectSecrets)
			.where(
				and(
					eq(projectSecrets.projectId, projectId),
					eq(projectSecrets.name, name),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * Stamps the push of a value to the Supabase function secrets.
	 * `BackendSecretsService.push` calls it after the bulk-create call, with
	 * `at` taken before it read the value. A row that changed after `at`, or
	 * a deleted row, gets no stamp; that is no error.
	 */
	async markSynced(projectId: string, name: string, at: Date): Promise<void> {
		await this.db
			.update(projectSecrets)
			.set({
				syncedToBackendAt: at,
				// `updatedAt` dates the last value change, which the Secrets panel
				// shows. A push changes no value, so it keeps the column as it is.
				updatedAt: sql`${projectSecrets.updatedAt}`,
			})
			.where(
				and(
					eq(projectSecrets.projectId, projectId),
					eq(projectSecrets.name, name),
					// A value written after the read is not on the backend yet.
					// LIMIT: the guard compares the task clock with the clock that
					// wrote `updatedAt`; a skew above the push time can hide a stamp.
					// Upgrade: `readValue` answers the row version, and the guard reads it.
					lte(projectSecrets.updatedAt, at),
				),
			);
	}

	/**
	 * One rotation page: rows below `keyVersion`, ordered by id, after
	 * `afterId` (null starts at the first row), at most `limit` rows. The
	 * id cursor makes a row that fails to rotate stay behind the walk.
	 */
	async listBelowKeyVersion(
		keyVersion: number,
		afterId: string | null,
		limit: number,
	): Promise<ProjectSecretCipherRow[]> {
		const belowVersion = lt(projectSecrets.keyVersion, keyVersion);
		return this.db
			.select(CIPHER_COLUMNS)
			.from(projectSecrets)
			.where(
				afterId === null
					? belowVersion
					: and(belowVersion, gt(projectSecrets.id, afterId)),
			)
			.orderBy(asc(projectSecrets.id))
			.limit(limit);
	}

	/**
	 * Writes a re-encrypted value only while the row still holds
	 * `expectedKeyVersion`. Answers false when a user write landed first:
	 * that write already carries the newest version and must survive.
	 */
	async replaceCipher(
		id: string,
		expectedKeyVersion: number,
		next: { ciphertext: string; keyVersion: number },
	): Promise<boolean> {
		const [row] = await this.db
			.update(projectSecrets)
			.set({ ciphertext: next.ciphertext, keyVersion: next.keyVersion })
			.where(
				and(
					eq(projectSecrets.id, id),
					eq(projectSecrets.keyVersion, expectedKeyVersion),
				),
			)
			.returning({ id: projectSecrets.id });

		return row !== undefined;
	}
}
