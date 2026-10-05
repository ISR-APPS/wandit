/**
 * Repository for the `audit_events` table: the append-only trail of
 * sensitive V2 actions. The `delete-app-project` runtime, the
 * `request_network_host` tool, and `ProjectSecretsService` write rows
 * through it. Nothing here updates or deletes rows.
 */
import { Inject, Injectable } from "@nestjs/common";
import { auditEvents } from "@wandit/db/schema/audit-events";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** Fields of one audit row a V2 caller records. */
export type AuditEventInput = {
	/** Machine-readable action name, for example "project.deleted". */
	action: string;
	/** Acting user id; null means the system did it. */
	actorUserId: string | null;
	/** Pass-through JSON payload (before/after values, ids); never read back here. */
	metadata: Record<string, string | number | boolean | null> | null;
	/** Org workspace the action touched; null for a personal scope. */
	organizationId: string | null;
	/** Project the action touched; null keeps the event after the row goes. */
	projectId: string | null;
	/** Id of the touched object inside its table. */
	targetId: string | null;
	/** Kind of object the action touched, for example "project". */
	targetType: string;
	/** Client IP of the HTTP request that caused the action. Omit for a task. */
	ip?: string | null;
};

// A write that runs on the pool or inside the caller's open transaction.
type AuditEventsClient =
	| Database
	| Parameters<Parameters<Database["transaction"]>[0]>[0];

@Injectable()
export class AuditEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Appends one row. Audit is write-only on purpose: no update path.
	 * With the caller's transaction as `client`, the row rolls back with it.
	 */
	async insert(
		input: AuditEventInput,
		client: AuditEventsClient = this.db,
	): Promise<void> {
		await client.insert(auditEvents).values({
			action: input.action,
			actorUserId: input.actorUserId,
			ip: input.ip,
			metadata: input.metadata,
			organizationId: input.organizationId,
			projectId: input.projectId,
			targetId: input.targetId,
			targetType: input.targetType,
		});
	}
}
