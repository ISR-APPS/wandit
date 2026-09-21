import { describe, expect, it } from "vitest";

import { dedupeRecords, type LeadRecord } from "./lead-scrape-spec";

function record(phone: string | null, name = "Business"): LeadRecord {
	return {
		address: null,
		name,
		phone,
		source: "google-maps",
		website: null,
	};
}

describe("dedupeRecords", () => {
	it("drops a second record with the same phone number", () => {
		const records = [
			record("0551 23 45 67", "Iron Temple Gym"),
			record("0551-23-45-67", "Iron Temple Gym (duplicate)"),
		];

		expect(dedupeRecords(records)).toEqual([records[0]]);
	});

	it("keeps records with different phones", () => {
		const records = [record("0551 23 45 67"), record("0551 98 76 54")];

		expect(dedupeRecords(records)).toHaveLength(2);
	});

	it("keeps two records that both have no phone number", () => {
		expect(dedupeRecords([record(null, "A"), record(null, "B")])).toHaveLength(
			2,
		);
	});
});
