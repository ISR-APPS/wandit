/**
 * Repository for `sandbox_sessions`, the lifecycle row of one provider
 * sandbox. The `SandboxProvider` writes it; the idle sweep and the preview
 * proxy read it. The partial unique index `sandbox_sessions_live_project_uq`
 * enforces at most one live row (creating/running/stopped) per project.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, lt } from "@wandit/db";
import { sandboxSessions } from "@wandit/db/schema/sandbox-sessions";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** One `sandbox_sessions` row as Drizzle returns it. */
export type SandboxSessionRow = typeof sandboxSessions.$inferSelect;

/** Statuses that count as live: the project still owns a sandbox. */
export const LIVE_STATUSES = ["creating", "running", "stopped"] as const;

/** Fields `insertCreating` needs; all come from `SandboxCreateOptions`. */
export type InsertSandboxSessionInput = {
	organizationId: string | null;
	projectId: string;
	provider: string;
	userId: string;
};

/** Columns `markRunning` writes once the vendor reports a live session. */
export type MarkSandboxRunningInput = {
	/** Vendor sandbox id — the sandbox `name` on Vercel. */
	providerSandboxId: string;
	/** Image the sandbox booted from. */
	image: string;
	/** Host that serves the app preview, from `sandbox.domain(devPort)`. */
	previewHost: string;
	/** Vendor session timeout, or null when the API returns none. */
	expiresAt: Date | null;
};

/**
 * Drizzle adapter around `sandbox_sessions`. Every live→dead transition
 * guards on a live status so a late write cannot resurrect a destroyed row.
 */
@Injectable()
export class SandboxSessionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The project's live row, or null when none exists. */
	async findLiveByProjectId(
		projectId: string,
	): Promise<SandboxSessionRow | null> {
		const rows = await this.db
			.select()
			.from(sandboxSessions)
			.where(
				and(
					eq(sandboxSessions.projectId, projectId),
					inArray(sandboxSessions.status, [...LIVE_STATUSES]),
				),
			)
			.limit(1);
		return rows.at(0) ?? null;
	}

	/** Inserts a `creating` row; the unique index rejects a second live one. */
	async insertCreating(
		input: InsertSandboxSessionInput,
	): Promise<SandboxSessionRow> {
		const [row] = await this.db
			.insert(sandboxSessions)
			.values({
				organizationId: input.organizationId,
				projectId: input.projectId,
				provider: input.provider,
				userId: input.userId,
			})
			.returning();
		if (!row) {
			throw new Error("sandbox_sessions insert did not return a row");
		}
		return row;
	}

	/**
	 * CAS: writes the vendor fields and flips a live row to `running`.
	 * `running` stays in the set on purpose: a rebuild or a resume of a
	 * running row must still refresh `expiresAt` and `previewHost`.
	 * Returns false when the row already left the live set — a destroy or
	 * an error won. `lastActiveAt` resets here because a start is activity;
	 * a running row without it would look idle forever.
	 */
	async markRunning(
		id: string,
		input: MarkSandboxRunningInput,
	): Promise<boolean> {
		const rows = await this.db
			.update(sandboxSessions)
			.set({
				error: null,
				expiresAt: input.expiresAt,
				image: input.image,
				lastActiveAt: new Date(),
				previewHost: input.previewHost,
				providerSandboxId: input.providerSandboxId,
				status: "running",
			})
			.where(
				and(
					eq(sandboxSessions.id, id),
					inArray(sandboxSessions.status, [...LIVE_STATUSES]),
				),
			)
			.returning({ id: sandboxSessions.id });
		return rows.length > 0;
	}

	/** Marks the row stopped; ignored when the row already left a live state. */
	async markStopped(id: string, lastSnapshotAt: Date): Promise<void> {
		await this.db
			.update(sandboxSessions)
			.set({ lastSnapshotAt, status: "stopped" })
			.where(
				and(
					eq(sandboxSessions.id, id),
					inArray(sandboxSessions.status, [...LIVE_STATUSES]),
				),
			);
	}

	/** Marks the row destroyed; ignored when the row already left live. */
	async markDestroyed(id: string): Promise<void> {
		await this.db
			.update(sandboxSessions)
			.set({ status: "destroyed" })
			.where(
				and(
					eq(sandboxSessions.id, id),
					inArray(sandboxSessions.status, [...LIVE_STATUSES]),
				),
			);
	}

	/** Records a lifecycle failure; the row leaves the live set. */
	async markError(id: string, error: string): Promise<void> {
		await this.db
			.update(sandboxSessions)
			.set({ error, status: "error" })
			.where(
				and(
					eq(sandboxSessions.id, id),
					inArray(sandboxSessions.status, [...LIVE_STATUSES]),
				),
			);
	}

	/** Stamps activity on the live row; turn start/end and preview heartbeats call it. */
	async touchActivity(projectId: string): Promise<void> {
		await this.db
			.update(sandboxSessions)
			.set({ lastActiveAt: new Date() })
			.where(
				and(
					eq(sandboxSessions.projectId, projectId),
					inArray(sandboxSessions.status, [...LIVE_STATUSES]),
				),
			);
	}

	/** Running rows whose last activity predates the cutoff — idle sweep targets. */
	async listIdleSince(cutoff: Date): Promise<SandboxSessionRow[]> {
		return this.db
			.select()
			.from(sandboxSessions)
			.where(
				and(
					eq(sandboxSessions.status, "running"),
					lt(sandboxSessions.lastActiveAt, cutoff),
				),
			);
	}
}

/**
 * The repository surface minus its private `db` handle. Consumers declare
 * this type so a spec can pass `FakeSandboxSessionsRepository` without a
 * cast; Nest still injects by the `SandboxSessionsRepository` token.
 */
export type SandboxSessionsStore = Pick<
	SandboxSessionsRepository,
	| "findLiveByProjectId"
	| "insertCreating"
	| "listIdleSince"
	| "markDestroyed"
	| "markError"
	| "markRunning"
	| "markStopped"
	| "touchActivity"
>;
