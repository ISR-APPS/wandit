/**
 * Action names of the V2 audit trail (WANDIT-181). `AuditEventsService` in
 * the app-builder module writes one `audit_events` row per action. The turn
 * API and task, the publish API and task, the restore route, the admin
 * suspend routes, the project GitHub routes, and the MCP server call it.
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
	"desktop.build",
	"desktop.cancel",
	"desktop.release",
	"project.suspend",
	"project.unsuspend",
	"github.link",
	"github.unlink",
	"github.pull",
	// One write, builder, or deploy tool call of an external coding agent. Metadata: tool, clientId, outcome.
	"mcp.tool_call",
	// A user accepts the consent page of a coding agent (OAuth client).
	"mcp.consent_granted",
	// A user revokes a coding agent. Its refresh and access tokens are deleted too.
	"mcp.consent_revoked",
] as const;

/** One value of `auditActions`. */
export type AuditAction = (typeof auditActions)[number];
