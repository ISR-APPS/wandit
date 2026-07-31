/**
 * Database helper for connector-generation attempts (background MCP media
 * generations, e.g. Higgsfield video). Two callers share it — the chat
 * agent's generation intercept (queue-time writes) and the HTTP read
 * endpoint. The Trigger.dev task does NOT use this class: it runs outside
 * Nest and talks to the same table through createDb(), like the other tasks.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, lt } from "@wandit/db";
import { connectorGenerationAttempts } from "@wandit/db/schema/connector-generation-attempts";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type ConnectorGenerationAttemptRow = {
	id: string;
	userId: string;
	connectorSlug: string;
	toolName: string;
	args: unknown;
	status: "queued" | "running" | "succeeded" | "failed";
	media: unknown;
	error: string | null;
	createdAt: Date;
	completedAt: Date | null;
};

// A run past this age can no longer be live (task maxDuration is shorter):
// reads self-heal the row to failed so cards never hang forever.
const STALE_ATTEMPT_MS = 35 * 60 * 1000;

@Injectable()
export class ConnectorGenerationsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	// One attempt row per intercepted generation call, born "queued".
	async insertAttempt(input: {
		userId: string;
		connectorSlug: string;
		toolName: string;
		args: unknown;
	}): Promise<{ id: string }> {
		const [row] = await this.db
			.insert(connectorGenerationAttempts)
			.values(input)
			.returning({ id: connectorGenerationAttempts.id });

		if (!row) {
			throw new Error("Connector generation insert did not return a row");
		}

		return row;
	}

	async markAttemptTriggered(
		attemptId: string,
		triggerRunId: string,
	): Promise<void> {
		await this.db
			.update(connectorGenerationAttempts)
			.set({ triggerRunId })
			.where(eq(connectorGenerationAttempts.id, attemptId));
	}

	async markAttemptFailed(attemptId: string, error: string): Promise<void> {
		await this.db
			.update(connectorGenerationAttempts)
			.set({ completedAt: new Date(), error, status: "failed" })
			.where(eq(connectorGenerationAttempts.id, attemptId));
	}

	// Ownership is by user id (the MCP connection is per-user). Missing and
	// not-owned are indistinguishable to the caller on purpose.
	async findOwnedAttempt(
		userId: string,
		attemptId: string,
	): Promise<ConnectorGenerationAttemptRow | null> {
		await this.settleStaleAttempt(attemptId);

		const [row] = await this.db
			.select()
			.from(connectorGenerationAttempts)
			.where(
				and(
					eq(connectorGenerationAttempts.id, attemptId),
					eq(connectorGenerationAttempts.userId, userId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	// Read-time janitor: a queued/running row this old is an orphaned run
	// (worker crash, lost handoff) — settle it so the card can conclude.
	private async settleStaleAttempt(attemptId: string): Promise<void> {
		await this.db
			.update(connectorGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: "The generation stopped before finishing.",
				status: "failed",
			})
			.where(
				and(
					eq(connectorGenerationAttempts.id, attemptId),
					inArray(connectorGenerationAttempts.status, ["queued", "running"]),
					lt(
						connectorGenerationAttempts.createdAt,
						new Date(Date.now() - STALE_ATTEMPT_MS),
					),
				),
			);
	}
}
