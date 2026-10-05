/**
 * In-memory `SandboxSessionsRepository` for provider and sweep specs.
 * Specs pass it where a `SandboxSessionsRepository` is expected; it mirrors
 * the live-status set and the one-live-row-per-project rule without a
 * database.
 */
import {
	type InsertSandboxSessionInput,
	LIVE_STATUSES,
	type MarkSandboxRunningInput,
	type SandboxSessionRow,
} from "./sandbox-sessions.repository";

function isLive(row: SandboxSessionRow): boolean {
	return LIVE_STATUSES.some((status) => status === row.status);
}

/**
 * Spec double for `SandboxSessionsRepository`. A second `insertCreating`
 * for the same project throws, matching `sandbox_sessions_live_project_uq`.
 */
export class FakeSandboxSessionsRepository {
	readonly rows = new Map<string, SandboxSessionRow>();
	private sequence = 0;

	findLiveByProjectId(projectId: string): Promise<SandboxSessionRow | null> {
		for (const row of this.rows.values()) {
			if (row.projectId === projectId && isLive(row)) {
				return Promise.resolve(row);
			}
		}
		return Promise.resolve(null);
	}

	insertCreating(input: InsertSandboxSessionInput): Promise<SandboxSessionRow> {
		for (const row of this.rows.values()) {
			if (row.projectId === input.projectId && isLive(row)) {
				return Promise.reject(new Error("duplicate live sandbox_sessions row"));
			}
		}
		const now = new Date();
		this.sequence += 1;
		const row: SandboxSessionRow = {
			createdAt: now,
			error: null,
			expiresAt: null,
			id: `row-${this.sequence}`,
			image: null,
			lastActiveAt: null,
			lastSnapshotAt: null,
			networkPolicyHash: null,
			organizationId: input.organizationId,
			previewHost: null,
			projectId: input.projectId,
			provider: input.provider,
			providerSandboxId: null,
			status: "creating",
			updatedAt: now,
			userId: input.userId,
		};
		this.rows.set(row.id, row);
		return Promise.resolve(row);
	}

	markRunning(id: string, input: MarkSandboxRunningInput): Promise<boolean> {
		const row = this.rows.get(id);
		if (!row || !isLive(row)) {
			return Promise.resolve(false);
		}
		row.error = null;
		row.expiresAt = input.expiresAt;
		row.image = input.image;
		row.lastActiveAt = new Date();
		row.previewHost = input.previewHost;
		row.providerSandboxId = input.providerSandboxId;
		row.status = "running";
		return Promise.resolve(true);
	}

	markStopped(id: string, lastSnapshotAt: Date): Promise<void> {
		const row = this.rows.get(id);
		if (row && isLive(row)) {
			row.lastSnapshotAt = lastSnapshotAt;
			row.status = "stopped";
		}
		return Promise.resolve();
	}

	markDestroyed(id: string): Promise<void> {
		const row = this.rows.get(id);
		if (row && isLive(row)) {
			row.status = "destroyed";
		}
		return Promise.resolve();
	}

	markNetworkPolicyHash(id: string, hash: string): Promise<void> {
		const row = this.rows.get(id);
		if (row && isLive(row)) {
			row.networkPolicyHash = hash;
		}
		return Promise.resolve();
	}

	markError(id: string, error: string): Promise<void> {
		const row = this.rows.get(id);
		if (row && isLive(row)) {
			row.error = error;
			row.status = "error";
		}
		return Promise.resolve();
	}

	touchActivity(projectId: string): Promise<void> {
		for (const row of this.rows.values()) {
			if (row.projectId === projectId && isLive(row)) {
				row.lastActiveAt = new Date();
			}
		}
		return Promise.resolve();
	}

	listIdleSince(cutoff: Date): Promise<SandboxSessionRow[]> {
		const idle: SandboxSessionRow[] = [];
		for (const row of this.rows.values()) {
			if (
				row.status === "running" &&
				row.lastActiveAt !== null &&
				row.lastActiveAt < cutoff
			) {
				idle.push(row);
			}
		}
		return Promise.resolve(idle);
	}
}
