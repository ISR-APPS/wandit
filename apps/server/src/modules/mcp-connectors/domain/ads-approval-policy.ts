/**
 * Money-based approval policy for the ads connectors (Meta Ads, TikTok Ads).
 *
 * The verb heuristic showed a confirmation card on EVERY write, so launching
 * one campaign cost the user four to six approvals (create campaign, create
 * ad set, upload media, create ad, activate). The referential's rule is
 * "confirmation before SPEND", not "confirmation before every API call":
 * build steps run free, and the moment money can move keeps the card.
 *
 * A write needs the user's approval only when it can move money or destroy
 * work:
 *  - it turns delivery ON at the campaign or ad set / ad group level — an
 *    activating verb in the tool name, or an ACTIVE / ENABLE status value in
 *    the arguments. Single-AD activations run free: an ad carries no budget
 *    of its own, the money was approved when its ad set and campaign went
 *    live (their cards), so enabling an ad only spends an already-approved
 *    budget;
 *  - it creates (or copies) a campaign / ad set / ad WITHOUT the PLATFORM'S
 *    OWN delivery-status field explicitly paused — both platforms default a
 *    status-less create to live delivery, and a paused value under a key the
 *    platform ignores (the other platform's field name, a read-only field)
 *    pauses nothing, so only the real writable keys count;
 *  - it changes money (a budget / bid key in the name or arguments) outside
 *    a deliverable create — a paused campaign / ad set carries its budget
 *    for free because spend stays gated behind the later activation card,
 *    but an ancillary money create (budget schedule, bid rule) applies money
 *    to a live entity with no activation step, so it keeps the card;
 *  - it deletes or archives anything (name verb or status value).
 *
 * Everything else — paused creates, uploads, creatives, audiences, pixels,
 * renames, targeting edits, and every PAUSE / DISABLE — runs without a card.
 * The USD budget guard and the 72-hour change window still run at the
 * execution choke point for every call, approved or not.
 *
 * Pure — no Nest, no I/O.
 */

import { levelFromToolName } from "./ads-target-entity";
import { normalizeConnectorToolName } from "./connector-generation-metering";
import { classifyToolName } from "./mcp-tool-classification";

const ADS_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);

/** Connectors whose writes use the money-based approval policy. */
export function isAdsApprovalConnector(connectorSlug: string): boolean {
	return ADS_CONNECTOR_SLUGS.has(connectorSlug);
}

/** Name verbs that turn delivery on (or spend money by themselves). */
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

/** Name verbs that destroy work. */
const DESTRUCTIVE_NAME_TOKENS = new Set([
	"archive",
	"delete",
	"remove",
	"terminate",
]);

/** Name verbs that bring a deliverable entity into existence. */
const CREATE_NAME_TOKENS = new Set([
	"add",
	"clone",
	"copy",
	"create",
	"duplicate",
]);

/** Name tokens that change money on an existing entity. */
const MONEY_NAME_TOKENS = new Set(["bid", "bids", "budget", "budgets"]);

/** Status values that mean delivery goes (or may go) live. */
const ACTIVATING_STATUS_VALUES = new Set(["ACTIVE", "ENABLE", "ENABLED"]);

/** Status values that destroy work (TikTok deletes via operation_status). */
const DESTRUCTIVE_STATUS_VALUES = new Set([
	"ARCHIVE",
	"ARCHIVED",
	"DELETE",
	"DELETED",
]);

/** Status values that keep an entity off — the free build path. */
const PAUSED_STATUS_VALUES = new Set([
	"DISABLE",
	"DISABLED",
	"INACTIVE",
	"PAUSE",
	"PAUSED",
]);

/**
 * The platform's REAL writable delivery-status keys, per connector. Only a
 * paused value under one of these frees a create: "status: PAUSED" sent to
 * TikTok is an unknown field the platform ignores while it applies its
 * ENABLE default — the create would go live "paused". The broad substring
 * match stays in place for the ACTIVATING / DESTRUCTIVE checks, where
 * over-carding is the safe direction.
 */
const DELIVERY_STATUS_KEYS: Record<string, ReadonlySet<string>> = {
	"meta-ads": new Set(["configured_status", "status", "status_option"]),
	"tiktok-ads": new Set(["operation_status", "opt_status"]),
};

/** Argument keys that carry money (budgets, bids, caps). */
const MONEY_KEY_PATTERN = /budget|bid|spend_cap|spending_limit/;

/** Same nesting reach as the target-id extractor (TikTok bulk shapes). */
const MAX_DEPTH = 3;

/**
 * Approval verdict for one ads-connector tool call. `toolName` is the
 * EFFECTIVE (nested) tool name for catalog doors and generic wrappers;
 * `args` are the arguments that will reach the provider (undefined when the
 * caller only knows the name — a status-less create is then treated as
 * potentially live, which is the safe reading).
 */
export function classifyAdsToolApproval(
	connectorSlug: string,
	toolName: string,
	args: unknown,
): "not-applicable" | "user-approval" {
	const tokens = toolTokens(toolName);
	const statuses = collectStatusValues(args, () => true);

	if (
		tokens.some((token) => DESTRUCTIVE_NAME_TOKENS.has(token)) ||
		statuses.some((value) => DESTRUCTIVE_STATUS_VALUES.has(value))
	) {
		return "user-approval";
	}

	// Turning delivery on is the launch moment — carded at the campaign and
	// ad set levels (they hold the budgets). A pure AD-level activation runs
	// free: the money it spends was approved on its parents' cards. This
	// check runs BEFORE the read gate on purpose: a status-setter whose name
	// reads like a read ("campaign_status") must not slip through.
	if (
		(tokens.some((token) => ACTIVATING_NAME_TOKENS.has(token)) ||
			statuses.some((value) => ACTIVATING_STATUS_VALUES.has(value))) &&
		!isAdLevelOnlyName(tokens)
	) {
		return "user-approval";
	}

	if (classifyToolName(toolName) === "read") {
		return "not-applicable";
	}

	if (
		tokens.some((token) => CREATE_NAME_TOKENS.has(token)) &&
		createsDeliverableEntity(tokens)
	) {
		// A campaign / ad set / ad created (or copied) without the platform's
		// own delivery-status key explicitly paused may go live on the
		// platform default — that is a launch, so it keeps the card. With
		// the real paused status stated it is a free build step, budget
		// included: spend stays gated behind the later activation card.
		const pausedKeys = DELIVERY_STATUS_KEYS[connectorSlug];
		const pausedStatuses = pausedKeys
			? collectStatusValues(args, (key) => pausedKeys.has(key))
			: [];

		return pausedStatuses.some((value) => PAUSED_STATUS_VALUES.has(value))
			? "not-applicable"
			: "user-approval";
	}

	// Non-deliverable creates fall through: a create of a budget schedule or
	// bid rule applies money to a live entity with no later activation step.
	if (
		tokens.some((token) => MONEY_NAME_TOKENS.has(token)) ||
		hasMoneyKey(args)
	) {
		return "user-approval";
	}

	return "not-applicable";
}

/**
 * True when the write only turns delivery on: an activating name verb or
 * activating status values (and nothing else — no money, no destruction).
 * The 72-hour change window exempts these: an activation does not throw away
 * learning data, and the campaign / ad set activation always shows its own
 * confirmation card, so the user still gates it.
 */
export function isAdsActivationOnlyWrite(
	toolName: string,
	args: unknown,
): boolean {
	const tokens = toolTokens(toolName);

	if (
		tokens.some((token) => DESTRUCTIVE_NAME_TOKENS.has(token)) ||
		tokens.some((token) => MONEY_NAME_TOKENS.has(token)) ||
		hasMoneyKey(args)
	) {
		return false;
	}

	const statuses = collectStatusValues(args, () => true);

	if (statuses.some((value) => !ACTIVATING_STATUS_VALUES.has(value))) {
		return false;
	}

	return (
		statuses.length > 0 ||
		tokens.some((token) => ACTIVATING_NAME_TOKENS.has(token))
	);
}

/**
 * True when the created entity can deliver ads once live: campaign, ad set /
 * ad group, or ad. Creatives share the "ad" level in the target-id extractor
 * but never deliver by themselves, so they are excluded here.
 */
function createsDeliverableEntity(tokens: readonly string[]): boolean {
	if (tokens.some((token) => token === "creative" || token === "creatives")) {
		return false;
	}

	return levelFromToolName(tokens.join("_")) !== null;
}

const CAMPAIGN_LEVEL_TOKENS = new Set(["campaign", "campaigns"]);
const ADSET_LEVEL_TOKENS = new Set(["adset", "adsets", "adgroup", "adgroups"]);
/** "ad account", "ad set", "ad group": the "ad" token is a prefix, not the level. */
const AD_SUFFIX_DISQUALIFIERS = new Set([
	"account",
	"accounts",
	"group",
	"groups",
	"set",
	"sets",
]);

/**
 * True when the tool name targets ONLY the ad level — a bare "ad"/"ads"
 * token with no campaign / ad set token anywhere and no "ad set"/"ad group"
 * split-token pair. Deliberately stricter than levelFromToolName ("most
 * specific level wins" would call "ads_update_ad_set" an ad): a wrong "ad"
 * answer here would free an ad-set activation, which moves money.
 */
function isAdLevelOnlyName(tokens: readonly string[]): boolean {
	const body = tokens[0] === "ads" ? tokens.slice(1) : tokens;
	let sawAd = false;

	for (const [index, token] of body.entries()) {
		if (CAMPAIGN_LEVEL_TOKENS.has(token) || ADSET_LEVEL_TOKENS.has(token)) {
			return false;
		}

		if (token === "ad" || token === "ads") {
			const next = body[index + 1];

			if (next !== undefined && AD_SUFFIX_DISQUALIFIERS.has(next)) {
				return false;
			}

			sawAd = true;
		}
	}

	return sawAd;
}

function toolTokens(toolName: string): string[] {
	const normalized = normalizeConnectorToolName(toolName);
	return normalized ? normalized.split("_") : [];
}

/**
 * Every string value under a key containing "status" that also passes the
 * key filter, uppercased. The broad matches (activating / destructive) pass
 * every key; the paused-create exemption passes only the platform's real
 * delivery-status keys.
 */
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

function hasMoneyKey(args: unknown): boolean {
	let found = false;

	walkRecords(args, 0, (record) => {
		for (const key of Object.keys(record)) {
			if (MONEY_KEY_PATTERN.test(key.toLowerCase())) {
				found = true;
			}
		}
	});

	return found;
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
