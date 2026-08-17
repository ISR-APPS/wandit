import type { RequiredDomainRecord } from "@wandit/contracts";

export const DOMAIN_VALIDATION_RECORD_PURPOSE =
	"ownership_or_ssl_validation" as const;

type ValidationRecord = Pick<RequiredDomainRecord, "name" | "type" | "value">;

type WholesaleQuote = {
	premium?: boolean;
	wholesalePriceUsd?: number;
};

export function validationRequiredDomainRecords(
	records: readonly ValidationRecord[],
): RequiredDomainRecord[] {
	return records.map((record) => ({
		name: record.name,
		purpose: DOMAIN_VALIDATION_RECORD_PURPOSE,
		type: record.type,
		value: record.value,
	}));
}

export function requiredDomainRecordMergeKey(
	record: Pick<RequiredDomainRecord, "name" | "type" | "value">,
): string {
	return `${record.type}:${record.name}:${record.value}`;
}

export function mergeRequiredDomainRecords(
	...recordSets: ReadonlyArray<readonly RequiredDomainRecord[]>
): RequiredDomainRecord[] {
	const records = new Map<string, RequiredDomainRecord>();

	for (const record of recordSets.flat()) {
		records.set(requiredDomainRecordMergeKey(record), record);
	}

	return [...records.values()];
}

export function wwwCnameTrafficRecord(
	fallbackOrigin: string,
): RequiredDomainRecord {
	return {
		name: "www",
		purpose: "traffic",
		type: "CNAME",
		value: fallbackOrigin,
	};
}

export function wholesaleQuoteBlockReason(
	quote: WholesaleQuote,
	wholesaleCeilingUsd: number,
	options: { rejectNonPositive?: boolean } = {},
): "premium" | "unsafe_price" | null {
	const price = quote.wholesalePriceUsd;

	if (quote.premium === true) {
		return "premium";
	}

	if (
		typeof price !== "number" ||
		!Number.isFinite(price) ||
		(options.rejectNonPositive === true && price <= 0) ||
		price > wholesaleCeilingUsd
	) {
		return "unsafe_price";
	}

	return null;
}
