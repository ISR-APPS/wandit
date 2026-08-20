/**
 * Finds the platform entities an ads write targets (campaign, ad set / ad
 * group, ad) in the tool arguments, so the change-window guard can look up
 * when Wandit last touched them. Pure — no Nest, no I/O.
 *
 * Only Meta Ads and TikTok Ads are inspected. Explicit id keys (singular and
 * plural, e.g. adgroup_ids on TikTok bulk updates) win over the generic "id"
 * keys Meta-style single-object tools use; when several levels are present
 * every id of the most specific one (ad > ad set > campaign) is returned,
 * because those are the entities whose learning a change would reset — a
 * campaign id next to an ad set id is the parent, not the target.
 *
 * Also parses the provider RESULT of a create call for the new entity's id,
 * so "created less than 72 h ago" can be recorded even though the arguments
 * of a create carry no id.
 */

import { normalizeConnectorToolName } from "./connector-generation-metering";

const AD_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);
const MAX_DEPTH = 3;

export type AdsEntityLevel = "ad" | "adset" | "campaign";

/** Explicit id keys (singular and plural) with the level they name. */
const EXPLICIT_ID_KEYS: ReadonlyMap<string, AdsEntityLevel> = new Map([
	["ad_id", "ad"],
	["ad_ids", "ad"],
	["creative_id", "ad"],
	["creative_ids", "ad"],
	["adset_id", "adset"],
	["adset_ids", "adset"],
	["adgroup_id", "adset"],
	["adgroup_ids", "adset"],
	["ad_group_id", "adset"],
	["ad_group_ids", "adset"],
	["campaign_id", "campaign"],
	["campaign_ids", "campaign"],
]);

/** Generic keys Meta-style single-object tools use (update_adset({ id })). */
const GENERIC_ID_KEYS = new Set(["id", "object_id", "node_id"]);

const LEVEL_RANK: Record<AdsEntityLevel, number> = {
	ad: 3,
	adset: 2,
	campaign: 1,
};

const AD_TOKENS = new Set(["ad", "creative", "creatives"]);
const ADSET_TOKENS = new Set(["adset", "adsets", "adgroup", "adgroups"]);
const CAMPAIGN_TOKENS = new Set(["campaign", "campaigns"]);
const ACCOUNT_TOKENS = new Set(["account", "accounts"]);

/** Creating a new entity never resets learning on an existing one. */
const CREATE_VERBS = new Set(["create", "add", "upload", "publish"]);

/** Result keys a create may report the new entity under, below data.*. */
const RESULT_CONTAINER_KEYS = ["data", "result", "list"];

type LeveledIds = Map<AdsEntityLevel, string[]>;

/** First target id, or null. Thin wrapper kept for single-id call sites. */
export function extractAdsTargetEntityId(
	connectorSlug: string,
	toolName: string,
	args: unknown,
): string | null {
	return extractAdsTargetEntityIds(connectorSlug, toolName, args)[0] ?? null;
}

/** Every target id (unique, in order of discovery) at the most specific level. */
export function extractAdsTargetEntityIds(
	connectorSlug: string,
	toolName: string,
	args: unknown,
): string[] {
	return extractAdsTargetEntities(connectorSlug, toolName, args)?.ids ?? [];
}

export function extractAdsTargetEntities(
	connectorSlug: string,
	toolName: string,
	args: unknown,
): { ids: string[]; level: AdsEntityLevel } | null {
	if (!AD_CONNECTOR_SLUGS.has(connectorSlug)) {
		return null;
	}

	const explicit = pickMostSpecific(collectExplicitIds(args));
	if (explicit) {
		return explicit;
	}

	const level = levelFromToolName(toolName);
	if (!level) {
		return null;
	}

	const generic = unique(collectGenericIds(args));
	return generic.length > 0 ? { ids: generic, level } : null;
}

/**
 * Ids of the entity a create call produced, read from the provider result
 * ({ content: [{ type: "text", text: "<json>" }] } or a plain object). Empty
 * for non-ads connectors, non-create tools, and platform-level failures.
 */
export function extractAdsCreatedEntityIds(
	connectorSlug: string,
	toolName: string,
	result: unknown,
): string[] {
	if (
		!AD_CONNECTOR_SLUGS.has(connectorSlug) ||
		!isAdsCreateToolName(toolName)
	) {
		return [];
	}

	const payloads = resultPayloads(result);
	const explicit: LeveledIds = new Map();
	const generic: string[] = [];

	for (const payload of payloads) {
		if (adsPlatformError(connectorSlug, payload)) {
			continue;
		}

		for (const candidate of resultCandidates(payload)) {
			collectExplicitIdsFromRecord(candidate, explicit);
			for (const key of GENERIC_ID_KEYS) {
				const id = asId(candidate[key]);
				if (id) {
					generic.push(id);
				}
			}
		}
	}

	return pickMostSpecific(explicit)?.ids ?? unique(generic);
}

/** Token-based: create / add / upload / publish anywhere in the name. */
export function isAdsCreateToolName(toolName: string): boolean {
	return toolTokens(toolName).some((token) => CREATE_VERBS.has(token));
}

/**
 * Platform-level failure hidden in a successful transport response:
 * TikTok answers { code: <non-zero>, message }, Meta { error: { code, ... } }.
 * Returns the error code (as a string) or null when the payload is fine.
 */
export function adsPlatformError(
	connectorSlug: string,
	payload: unknown,
): { errorCode: string | null } | null {
	if (!AD_CONNECTOR_SLUGS.has(connectorSlug)) {
		return null;
	}

	const record = asRecord(payload, 0);
	if (!record) {
		return null;
	}

	if (connectorSlug === "tiktok-ads") {
		const code = record.code;
		if (typeof code === "number" && Number.isFinite(code) && code !== 0) {
			return { errorCode: String(code) };
		}

		return null;
	}

	const error = asRecord(record.error, 0);
	if (!error) {
		return null;
	}

	const code = error.code;
	return {
		errorCode:
			typeof code === "number" || typeof code === "string"
				? String(code)
				: null,
	};
}

/** JSON payloads carried by a provider result (content text or the object). */
export function resultPayloads(result: unknown): unknown[] {
	const record = asRecord(result, 0);
	if (!record) {
		return [];
	}

	if (!Array.isArray(record.content)) {
		return [record];
	}

	const payloads: unknown[] = [];
	for (const item of record.content) {
		const text = asRecord(item, 0)?.text;
		if (typeof text !== "string") {
			continue;
		}

		try {
			payloads.push(JSON.parse(text));
		} catch {
			// Plain text content carries no ids.
		}
	}

	return payloads;
}

/**
 * Entity level named by the tool (update_adset, campaign_update, ad/update/).
 * A leading "ads" token is the Meta tool prefix, not a level; "ad account(s)"
 * is an account, not an ad.
 */
export function levelFromToolName(toolName: string): AdsEntityLevel | null {
	const tokens = toolTokens(toolName);
	const body = tokens[0] === "ads" ? tokens.slice(1) : tokens;
	let best: AdsEntityLevel | null = null;
	let sawPluralAds = false;

	for (const [index, token] of body.entries()) {
		if (token === "ads") {
			sawPluralAds = true;
			continue;
		}

		const next = body[index + 1];
		const level =
			AD_TOKENS.has(token) && !(next !== undefined && ACCOUNT_TOKENS.has(next))
				? "ad"
				: ADSET_TOKENS.has(token)
					? "adset"
					: CAMPAIGN_TOKENS.has(token)
						? "campaign"
						: null;

		if (level && (!best || LEVEL_RANK[level] > LEVEL_RANK[best])) {
			best = level;
		}
	}

	return best ?? (sawPluralAds ? "ad" : null);
}

function toolTokens(toolName: string): string[] {
	const normalized = normalizeConnectorToolName(toolName);
	return normalized ? normalized.split("_") : [];
}

function pickMostSpecific(
	found: LeveledIds,
): { ids: string[]; level: AdsEntityLevel } | null {
	let best: { ids: string[]; level: AdsEntityLevel } | null = null;

	for (const [level, ids] of found) {
		const uniqueIds = unique(ids);
		if (
			uniqueIds.length > 0 &&
			(!best || LEVEL_RANK[level] > LEVEL_RANK[best.level])
		) {
			best = { ids: uniqueIds, level };
		}
	}

	return best;
}

function collectExplicitIds(value: unknown): LeveledIds {
	const found: LeveledIds = new Map();
	walk(value, 0, (record) => collectExplicitIdsFromRecord(record, found));
	return found;
}

function collectExplicitIdsFromRecord(
	record: Record<string, unknown>,
	found: LeveledIds,
): void {
	for (const [key, value] of Object.entries(record)) {
		const level = EXPLICIT_ID_KEYS.get(key);
		if (!level) {
			continue;
		}

		for (const id of asIds(value)) {
			const bucket = found.get(level);
			if (bucket) {
				bucket.push(id);
			} else {
				found.set(level, [id]);
			}
		}
	}
}

function collectGenericIds(value: unknown): string[] {
	const ids: string[] = [];
	walk(value, 0, (record) => {
		for (const key of GENERIC_ID_KEYS) {
			const id = asId(record[key]);
			if (id) {
				ids.push(id);
			}
		}
	});
	return ids;
}

/** Visits every record reachable through records and arrays, depth-limited. */
function walk(
	value: unknown,
	depth: number,
	visit: (record: Record<string, unknown>) => void,
): void {
	if (depth > MAX_DEPTH || value === null || typeof value !== "object") {
		return;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			walk(entry, depth + 1, visit);
		}
		return;
	}

	const record = value as Record<string, unknown>;
	visit(record);
	for (const entry of Object.values(record)) {
		walk(entry, depth + 1, visit);
	}
}

/** Top level, data, data.list[0], data.* — where create results report ids. */
function resultCandidates(payload: unknown): Record<string, unknown>[] {
	const root = asRecord(payload, 0);
	if (!root) {
		return [];
	}

	const candidates = [root];
	for (const containerKey of RESULT_CONTAINER_KEYS) {
		const container = root[containerKey];
		if (Array.isArray(container)) {
			const first = asRecord(container[0], 0);
			if (first) {
				candidates.push(first);
			}
			continue;
		}

		const record = asRecord(container, 0);
		if (!record) {
			continue;
		}

		candidates.push(record);
		for (const entry of Object.values(record)) {
			if (Array.isArray(entry)) {
				const first = asRecord(entry[0], 0);
				if (first) {
					candidates.push(first);
				}
				continue;
			}

			const nested = asRecord(entry, 0);
			if (nested) {
				candidates.push(nested);
			}
		}
	}

	return candidates;
}

function asRecord(
	value: unknown,
	depth: number,
): Record<string, unknown> | null {
	if (
		depth > MAX_DEPTH ||
		value === null ||
		typeof value !== "object" ||
		Array.isArray(value)
	) {
		return null;
	}

	return value as Record<string, unknown>;
}

/** A single id or a plural array of ids; anything else yields nothing. */
function asIds(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => {
			const id = asId(entry);
			return id ? [id] : [];
		});
	}

	const id = asId(value);
	return id ? [id] : [];
}

/** Platform ids are numeric strings or numbers; anything else is not an id. */
function asId(value: unknown): string | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	}

	return null;
}

function unique(ids: string[]): string[] {
	return [...new Set(ids)];
}
