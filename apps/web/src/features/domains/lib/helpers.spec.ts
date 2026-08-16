import { describe, expect, it } from "vitest";

import type { Domain } from "../api/domains.dto";
import { domainLiveUrl, hasTransitionalDomains } from "./helpers";

describe("domainLiveUrl", () => {
	it("uses the provisioned www hostname for an external domain", () => {
		expect(domainLiveUrl({ name: "example.com", source: "external" })).toBe(
			"https://www.example.com",
		);
	});

	it("keeps the apex URL for a purchased domain", () => {
		expect(domainLiveUrl({ name: "example.com", source: "purchased" })).toBe(
			"https://example.com",
		);
	});
});

describe("hasTransitionalDomains", () => {
	it("stops background polling after external verification stalls", () => {
		expect(
			hasTransitionalDomains([
				domain({
					dns: {
						externalVerification: {
							attempts: 101,
							stalledAt: "2026-08-12T10:00:00.000Z",
						},
						records: [],
					},
				}),
			]),
		).toBe(false);
	});

	it("resumes background polling after the stalled marker is cleared", () => {
		expect(hasTransitionalDomains([domain({ dns: { records: [] } })])).toBe(
			true,
		);
	});
});

function domain(overrides: Partial<Domain> = {}): Domain {
	return {
		autoRenew: false,
		createdAt: "2026-08-12T10:00:00.000Z",
		dns: { records: [] },
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-222222222222",
		isPrimary: false,
		name: "example.com",
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: null,
		registrant: null,
		source: "external",
		status: "configuring",
		tld: "com",
		updatedAt: "2026-08-12T10:00:00.000Z",
		userId: "user_1",
		whoisPrivacy: false,
		...overrides,
	};
}
