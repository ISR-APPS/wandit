/**
 * 72-hour change-window guard for ads writes.
 *
 * Media-buying rule from the referential: no change on a campaign / ad set /
 * ad before 72 hours (or 3x the target CPA of cumulative spend) — a change
 * resets the platform's learning and throws away the data the user paid for.
 * The guard blocks a write that targets an entity Wandit created or changed
 * less than 72 hours ago, with a model-facing message that explains the rule
 * and asks the model to relay it. It never forbids: the user owns the account,
 * so an explicit insistence (acknowledged = true) lets the call through —
 * the insistence is the approval.
 *
 * A write may target several entities at once (TikTok bulk status / budget
 * updates): the guard blocks when ANY of them is inside the window, and
 * `lastWriteAt` is the most recent Wandit write across all of them, so the
 * earliest-allowed time it reports is the safe one.
 *
 * Pure — no Nest, no I/O — called from the single choke point every connector
 * execution passes through.
 */

import { isAdsActivationOnlyWrite } from "./ads-approval-policy";
import { isAdsCreateToolName, levelFromToolName } from "./ads-target-entity";
import { classifyToolName } from "./mcp-tool-classification";

export const ADS_CHANGE_WINDOW_HOURS = 72;

const AD_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);

const LEVEL_LABELS = {
	ad: "ad",
	adset: "ad set",
	campaign: "campaign",
} as const;

export type AdsChangeWindowVerdict =
	| { blocked: false }
	| {
			blocked: true;
			hoursRemaining: number;
			hoursSince: number;
			message: string;
	  };

export function evaluateAdsChangeWindow(input: {
	acknowledged: boolean;
	/** The arguments the provider will receive (activation detection). */
	args: unknown;
	connectorSlug: string;
	lastWriteAt: Date | null;
	now: Date;
	targetEntityIds: string[];
	toolName: string;
}): AdsChangeWindowVerdict {
	if (
		input.acknowledged ||
		!AD_CONNECTOR_SLUGS.has(input.connectorSlug) ||
		input.targetEntityIds.length === 0 ||
		input.lastWriteAt === null ||
		classifyToolName(input.toolName) !== "write" ||
		isAdsCreateToolName(input.toolName) ||
		// A pure activation is the LAUNCH of an entity built paused, not a
		// mid-learning edit — blocking it would refuse the flow the user just
		// approved. It stays gated by its own confirmation card (campaign /
		// ad set level), and an activation that also touches money is not
		// "activation only", so it stays inside the window.
		isAdsActivationOnlyWrite(input.toolName, input.args)
	) {
		return { blocked: false };
	}

	const elapsedMs = input.now.getTime() - input.lastWriteAt.getTime();
	const hoursSince = Math.max(0, elapsedMs / 3_600_000);

	if (hoursSince >= ADS_CHANGE_WINDOW_HOURS) {
		return { blocked: false };
	}

	const hoursRemaining = ADS_CHANGE_WINDOW_HOURS - hoursSince;
	const level = LEVEL_LABELS[levelFromToolName(input.toolName) ?? "adset"];
	const shownSince = formatHours(hoursSince);
	const shownRemaining = formatHours(hoursRemaining);
	const subject =
		input.targetEntityIds.length > 1
			? `at least one of these ${level}s (${input.targetEntityIds.join(", ")}) was`
			: `this ${level} was`;

	return {
		blocked: true,
		hoursRemaining,
		hoursSince,
		message:
			`Wandit change window: ${subject} created or changed by Wandit ` +
			`${shownSince} hours ago. Media-buying rule: no change on a ${level} ` +
			`before ${ADS_CHANGE_WINDOW_HOURS} hours (or 3x the target CPA in ` +
			"spend) — a change now resets learning and destroys the data you are " +
			"paying for. Explain this to the user in business terms and propose " +
			`the earliest sensible moment (${shownRemaining} h from now). Do NOT ` +
			"retry on your own. Only if the user explicitly insists, call the same " +
			"operation again once — it will then be allowed. Their insistence IS " +
			"the approval: their account, their budget, their final say.",
	};
}

/** Whole hours, but never "0" for a change made minutes ago. */
function formatHours(hours: number): string {
	if (hours < 1) {
		return "less than 1";
	}

	return String(Math.floor(hours));
}
