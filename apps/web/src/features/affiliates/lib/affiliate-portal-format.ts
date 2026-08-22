import type { AffiliateProgram } from "@wandit/contracts";

export type AffiliateProgramTermsParts =
	| {
			kind: "percentage_recurring";
			rateBps: number;
			durationMonths: number | null;
			holdDays?: number;
	  }
	| {
			kind: "fixed_one_time";
			amountCents: number;
			currency: string;
			durationMonths: number | null;
			holdDays?: number;
	  };

export function formatAffiliateMoney(
	cents: number,
	currency: string,
	locale: string,
): string {
	const amount = cents / 100;
	const fractionDigits = Number.isInteger(amount) ? 0 : 2;

	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: currency.toUpperCase(),
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(amount);
}

export function formatAffiliateRate(bps: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 2,
	}).format(bps / 10_000);
}

export function buildAffiliateShareUrl(
	origin: string,
	landingPath: string,
	code: string,
): string {
	const hashIndex = landingPath.indexOf("#");
	const pathAndQuery =
		hashIndex === -1 ? landingPath : landingPath.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? "" : landingPath.slice(hashIndex);
	const separator = pathAndQuery.includes("?") ? "&" : "?";
	const normalizedOrigin = origin.replace(/\/+$/, "");

	return `${normalizedOrigin}${pathAndQuery}${separator}ref=${encodeURIComponent(code)}${fragment}`;
}

export function programTermsParts(
	program: AffiliateProgram,
): AffiliateProgramTermsParts {
	const commonParts = {
		durationMonths: program.commissionDurationMonths,
		holdDays: program.holdDays,
	};

	if (program.kind === "percentage_recurring") {
		return {
			...commonParts,
			kind: program.kind,
			rateBps: program.commissionRateBps,
		};
	}

	return {
		...commonParts,
		kind: program.kind,
		amountCents: program.fixedAmountCents,
		currency: program.fixedCurrency,
	};
}
