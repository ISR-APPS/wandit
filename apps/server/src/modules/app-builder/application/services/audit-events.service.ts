/**
 * Writes one `audit_events` row per V2 action (WANDIT-181) and masks every
 * key of the secret scanner rules in the metadata first. The turn API, the
 * turn task, the publish API and task, the restore route, and the admin
 * suspend routes call it. It calls `AuditEventsRepository`.
 */
import type { AuditAction } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import { redactSecrets } from "../../domain/publish-gate/secret-rules";
import type {
	AuditEventInput,
	AuditEventsRepository,
} from "../../infrastructure/persistence/audit-events.repository";

/** One action to record. The same fields as a row, with a typed action name. */
export type AuditRecord = Omit<AuditEventInput, "action"> & {
	action: AuditAction;
};

/**
 * Records audit rows. Not a Nest `@Injectable`: the module builds it with a
 * factory, and a Trigger task builds it by hand with `Sentry.logger`.
 */
export class AuditEventsService {
	constructor(
		private readonly repository: Pick<AuditEventsRepository, "insert">,
		/** `Sentry.logger` in production; the spec records lines. */
		private readonly logger: Pick<SandboxLogger, "error">,
	) {}

	/**
	 * Writes the row. A failed write never fails the action that called it:
	 * the action already happened, and the row is a trace, not a lock. The
	 * error goes to the log with the action and the project.
	 */
	async record(event: AuditRecord): Promise<void> {
		try {
			await this.repository.insert({
				...event,
				metadata:
					event.metadata === null ? null : redactMetadata(event.metadata),
			});
		} catch (error) {
			this.logger.error("audit.write-failed", {
				action: event.action,
				error: getErrorMessage(error),
				projectId: event.projectId ?? "none",
			});
		}
	}
}

// Security: a note or an error text can quote a key. Only string values can
// hold one; numbers, booleans, and null pass unchanged.
function redactMetadata(
	metadata: NonNullable<AuditEventInput["metadata"]>,
): NonNullable<AuditEventInput["metadata"]> {
	return Object.fromEntries(
		Object.entries(metadata).map(([name, value]) => [
			name,
			typeof value === "string" ? redactSecrets(value) : value,
		]),
	);
}
