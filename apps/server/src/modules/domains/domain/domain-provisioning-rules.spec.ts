import { describe, expect, it } from "vitest";

import {
	apexAnameTrafficRecord,
	DOMAIN_VALIDATION_RECORD_PURPOSE,
	mergeRequiredDomainRecords,
	requiredDomainRecordMergeKey,
	validationRequiredDomainRecords,
	wholesaleQuoteBlockReason,
	wwwCnameTrafficRecord,
} from "./domain-provisioning-rules";

describe("domain provisioning rules", () => {
	it("owns validation purpose mapping and merge identity", () => {
		const original = {
			name: "_cf.example.com",
			purpose: "legacy",
			type: "TXT" as const,
			value: "token",
		};
		const [validation] = validationRequiredDomainRecords([
			{ name: original.name, type: original.type, value: original.value },
		]);
		if (!validation) {
			throw new Error("Expected one mapped validation record");
		}

		expect(validation).toEqual({
			...original,
			purpose: DOMAIN_VALIDATION_RECORD_PURPOSE,
		});
		expect(requiredDomainRecordMergeKey(original)).toBe(
			"TXT:_cf.example.com:token",
		);
		expect(mergeRequiredDomainRecords([original], [validation])).toEqual([
			validation,
		]);
	});

	it("builds the shared www CNAME traffic record", () => {
		expect(wwwCnameTrafficRecord("customers.wandit.app")).toEqual({
			name: "www",
			purpose: "traffic",
			type: "CNAME",
			value: "customers.wandit.app",
		});
	});

	it("builds the apex ANAME traffic record for purchased domains", () => {
		expect(apexAnameTrafficRecord("customers.wandit.app")).toEqual({
			name: "@",
			purpose: "traffic",
			type: "ANAME",
			value: "customers.wandit.app",
		});
	});

	it.each([
		{
			label: "premium",
			quote: { premium: true, wholesalePriceUsd: 1 },
			reason: "premium",
		},
		{ label: "missing", quote: {}, reason: "unsafe_price" },
		{
			label: "non-finite",
			quote: { wholesalePriceUsd: Number.POSITIVE_INFINITY },
			reason: "unsafe_price",
		},
		{
			label: "over ceiling",
			quote: { wholesalePriceUsd: 10.01 },
			reason: "unsafe_price",
		},
		{
			label: "at ceiling",
			quote: { wholesalePriceUsd: 10 },
			reason: null,
		},
	])("classifies a $label wholesale quote", ({ quote, reason }) => {
		expect(wholesaleQuoteBlockReason(quote, 10)).toBe(reason);
	});

	it("preserves the API-only non-positive quote guard explicitly", () => {
		const quote = { wholesalePriceUsd: 0 };

		expect(wholesaleQuoteBlockReason(quote, 10)).toBeNull();
		expect(
			wholesaleQuoteBlockReason(quote, 10, { rejectNonPositive: true }),
		).toBe("unsafe_price");
	});
});
