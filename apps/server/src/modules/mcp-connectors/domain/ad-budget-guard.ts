/**
 * Last-line budget guard for outgoing ad-platform tool calls.
 *
 * The chat prompt already forbids DA/DZD ad budgets, but a prompt is not a
 * guarantee: if a dinar-denominated amount (or a non-USD currency field)
 * still reaches a Meta/TikTok call, launching it would spend the number AS
 * US DOLLARS — "3000 DA" becoming a 3000 USD campaign. This guard rejects
 * the call with an instructive error the model relays, and NEVER converts:
 * an exchange decision belongs to the user.
 *
 * Pure function on purpose — no Nest, no I/O — called from the single choke
 * point every connector execution passes through (executeInlineConnectorTool),
 * which covers direct namespaced tools, run_platform_tool catalog calls, and
 * TikTok hidden operations alike.
 */

const AD_CONNECTOR_SLUGS = new Set(["meta-ads", "tiktok-ads"]);

/** Argument keys that carry money for ad platforms. */
const MONEY_KEY_PATTERN = /budget|spend|bid/i;

/** Keys that name a currency (top-level or nested, e.g. budget_currency). */
const CURRENCY_KEY_PATTERN = /currency/i;

/**
 * Dinar markers in any script. Word-ish boundaries so "sunday" or "adapt"
 * can never match; Arabic needs no boundary because the letters cannot
 * appear inside an ASCII word.
 */
const DINAR_PATTERN = /(^|[^a-z])(da|dzd|dinars?)([^a-z]|$)|دج|دينار/i;

const MAX_DEPTH = 6;

export class AdBudgetCurrencyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AdBudgetCurrencyError";
	}
}

/**
 * Throws AdBudgetCurrencyError when the arguments carry a dinar-denominated
 * money field or a non-USD currency field. Silent for non-ad connectors.
 */
export function assertUsdAdBudgetArgs(
	connectorSlug: string,
	input: unknown,
): void {
	if (!AD_CONNECTOR_SLUGS.has(connectorSlug)) {
		return;
	}

	walk(input, 0);
}

function walk(value: unknown, depth: number): void {
	if (depth > MAX_DEPTH || value === null || typeof value !== "object") {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			walk(item, depth + 1);
		}

		return;
	}

	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		if (CURRENCY_KEY_PATTERN.test(key) && typeof entry === "string") {
			const currency = entry.trim().toUpperCase();

			if (currency !== "" && currency !== "USD") {
				throw new AdBudgetCurrencyError(
					`Ad budgets must be in USD, but "${key}" is "${entry}". Do not ` +
						"convert it yourself — ask the user for the amount in US " +
						"dollars (USD), then call the tool again with USD.",
				);
			}

			continue;
		}

		if (MONEY_KEY_PATTERN.test(key) && typeof entry === "string") {
			if (DINAR_PATTERN.test(entry)) {
				throw new AdBudgetCurrencyError(
					`Ad budgets must be in USD, but "${key}" ("${entry}") looks ` +
						"dinar-denominated. Do not convert it yourself — ask the user " +
						"for the amount in US dollars (USD), then call the tool again " +
						"with the plain USD number.",
				);
			}

			continue;
		}

		walk(entry, depth + 1);
	}
}
