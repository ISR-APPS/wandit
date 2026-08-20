/**
 * Read/write classification of connector tool names.
 *
 * Shared by the chat tools service (approval policy, retry policy, operation
 * feature) and the ads change-window guard. Pure — no Nest, no I/O.
 */

import { normalizeConnectorToolName } from "./connector-generation-metering";

export const WRITE_VERBS = new Set([
	"create",
	"update",
	"delete",
	"remove",
	"add",
	"set",
	"activate",
	"deactivate",
	"pause",
	"resume",
	"enable",
	"disable",
	"publish",
	"deploy",
	"boost",
	"schedule",
	"send",
	"upload",
	"buy",
	"purchase",
	"confirm",
	"cancel",
	"subscribe",
	"launch",
	"connect",
	"disconnect",
	"sync",
	"rename",
	"import",
	"invoke",
	"exec",
	"execute",
	"participate",
]);

export const READ_VERBS = new Set([
	"get",
	"list",
	"search",
	"read",
	"fetch",
	"query",
	"describe",
	"show",
	"check",
	"count",
	"view",
	"retrieve",
	"download",
	"export",
	"report",
	"preview",
	"status",
	"health",
	"explore",
	"insights",
	"balance",
	"transactions",
	"reveal",
	"display",
]);

/**
 * A tool is a write when any token is a write verb; a read when any token is
 * a read verb and none is a write verb; unknown names default to write.
 */
export function classifyToolName(toolName: string): "read" | "write" {
	const normalizedName = normalizeConnectorToolName(toolName);
	const tokens = normalizedName ? normalizedName.split("_") : [];

	if (tokens.some((token) => WRITE_VERBS.has(token))) {
		return "write";
	}

	return tokens.some((token) => READ_VERBS.has(token)) ? "read" : "write";
}
