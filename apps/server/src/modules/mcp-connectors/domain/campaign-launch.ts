/**
 * Detects the successful ads writes that start delivery.
 *
 * Approval is deliberately broader than launch: budget changes and deletes
 * require approval too, but neither starts a campaign. This predicate stays
 * pure so the execution recorder can apply it to the exact provider arguments.
 */

import { levelFromToolName } from "./ads-target-entity";
import { normalizeConnectorToolName } from "./connector-generation-metering";
import { classifyToolName, READ_VERBS } from "./mcp-tool-classification";

const ADS_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);

const ACTIVATING_NAME_TOKENS = new Set([
	"activate",
	"boost",
	"enable",
	"launch",
	"publish",
	"reactivate",
	"resume",
	"start",
	"unpause",
]);

const CREATE_NAME_TOKENS = new Set([
	"add",
	"clone",
	"copy",
	"create",
	"duplicate",
]);

const DESTRUCTIVE_NAME_TOKENS = new Set([
	"archive",
	"delete",
	"remove",
	"terminate",
]);

const ACTIVATING_STATUS_VALUES = new Set(["ACTIVE", "ENABLE", "ENABLED"]);
const DESTRUCTIVE_STATUS_VALUES = new Set([
	"ARCHIVE",
	"ARCHIVED",
	"DELETE",
	"DELETED",
]);
const DELIVERY_STATUS_KEYS: Record<string, ReadonlySet<string>> = {
	"meta-ads": new Set(["configured_status", "status", "status_option"]),
	"tiktok-ads": new Set(["operation_status", "opt_status"]),
};

const CREATIVE_TOKENS = new Set(["creative", "creatives"]);
const MAX_DEPTH = 3;

/**
 * True only when this ads operation turns campaign, ad-set/ad-group, or ad
 * delivery on. Create-like writes require an explicit activating status on a
 * connector-specific delivery-status field.
 */
export function isCampaignLaunch(
	connectorSlug: string,
	toolName: string,
	args: unknown,
): boolean {
	if (!ADS_CONNECTOR_SLUGS.has(connectorSlug)) {
		return false;
	}

	const tokens = toolTokens(toolName);
	if (
		levelFromToolName(toolName) === null ||
		tokens.some((token) => CREATIVE_TOKENS.has(token))
	) {
		return false;
	}

	const statuses = collectStatusValues(args, () => true);
	if (
		tokens.some((token) => DESTRUCTIVE_NAME_TOKENS.has(token)) ||
		statuses.some((status) => DESTRUCTIVE_STATUS_VALUES.has(status))
	) {
		return false;
	}

	const isCreate = tokens.some((token) => CREATE_NAME_TOKENS.has(token));
	if (isCreate) {
		const deliveryStatusKeys = DELIVERY_STATUS_KEYS[connectorSlug];
		const deliveryStatuses = deliveryStatusKeys
			? collectStatusValues(args, (key) => deliveryStatusKeys.has(key))
			: [];

		return deliveryStatuses.some((status) =>
			ACTIVATING_STATUS_VALUES.has(status),
		);
	}

	if (!isWriteLikeStatusOperation(toolName, tokens)) {
		return false;
	}

	return (
		tokens.some((token) => ACTIVATING_NAME_TOKENS.has(token)) ||
		statuses.some((status) => ACTIVATING_STATUS_VALUES.has(status))
	);
}

function isWriteLikeStatusOperation(
	toolName: string,
	tokens: readonly string[],
): boolean {
	if (classifyToolName(toolName) === "write") {
		return true;
	}

	// Some providers call a status setter simply `campaign_status`, which the
	// generic classifier reads as a query. Treat that bare shape as a setter,
	// while `campaign_status_get/list/...` remains read-only.
	return (
		tokens.includes("status") &&
		!tokens.some((token) => token !== "status" && READ_VERBS.has(token))
	);
}

function toolTokens(toolName: string): string[] {
	const normalized = normalizeConnectorToolName(toolName);
	return normalized ? normalized.split("_") : [];
}

function collectStatusValues(
	args: unknown,
	keyFilter: (key: string) => boolean,
): string[] {
	const values: string[] = [];

	walkRecords(args, 0, (record) => {
		for (const [key, value] of Object.entries(record)) {
			const normalizedKey = key.toLowerCase();
			if (
				normalizedKey.includes("status") &&
				keyFilter(normalizedKey) &&
				typeof value === "string"
			) {
				values.push(value.trim().toUpperCase());
			}
		}
	});

	return values;
}

function walkRecords(
	value: unknown,
	depth: number,
	visit: (record: Record<string, unknown>) => void,
): void {
	if (depth > MAX_DEPTH || typeof value !== "object" || value === null) {
		return;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			walkRecords(entry, depth + 1, visit);
		}
		return;
	}

	const record = value as Record<string, unknown>;
	visit(record);
	for (const nested of Object.values(record)) {
		walkRecords(nested, depth + 1, visit);
	}
}
