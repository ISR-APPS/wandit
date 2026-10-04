/**
 * Action names of the V2 audit trail (WANDIT-181). `AuditEventsService` in
 * the app-builder module writes one `audit_events` row per action. The turn
 * API and task, the publish API and task, the restore route, and the admin
 * suspend routes call it.
 */

/** Every action that `AuditEventsService` records. Add a name here before a new call site. */
export const auditActions = [
	"turn.start",
	"turn.end",
	"turn.cancel",
	"publish.done",
	"publish.blocked",
	"publish.rollback",
	"publish.unpublish",
	"publish.gate_override",
	"version.restore",
	"project.suspend",
	"project.unsuspend",
] as const;

/** One value of `auditActions`. */
export type AuditAction = (typeof auditActions)[number];
