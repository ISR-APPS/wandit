import { describe, expect, it } from "vitest";

import type { Domain, RequiredDomainRecord } from "../api/domains.dto";
import {
	dnsPurposeKey,
	domainLiveUrl,
	hasTransitionalDomains,
	splitExternalDomainRecords,
} from "./helpers";

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

describe("dnsPurposeKey", () => {
	it("explains nameserver records by type or purpose", () => {
		expect(
			dnsPurposeKey({
				name: "@",
				purpose: "nameserver",
				type: "NS",
				value: "ada.ns.cloudflare.com",
			}),
		).toBe("settings.domains.dnsPurposeNameserver");
		expect(
			dnsPurposeKey({
				name: "@",
				purpose: "Nameserver",
				type: "CNAME",
				value: "ada.ns.cloudflare.com",
			}),
		).toBe("settings.domains.dnsPurposeNameserver");
	});

	it("keeps the existing keys for the www records", () => {
		expect(dnsPurposeKey(wwwRecord)).toBe("settings.domains.dnsPurposeRouting");
		expect(dnsPurposeKey(ownershipRecord)).toBe(
			"settings.domains.dnsPurposeOwnership",
		);
	});
});

describe("splitExternalDomainRecords", () => {
	it("keeps rows without a zone on the manual path only", () => {
		expect(splitExternalDomainRecords([wwwRecord, ownershipRecord])).toEqual({
			manualRecords: [wwwRecord, ownershipRecord],
			nameserverRecords: [],
		});
		expect(splitExternalDomainRecords([])).toEqual({
			manualRecords: [],
			nameserverRecords: [],
		});
	});

	it("separates the nameserver records from the www records in order", () => {
		const nsRecords = [nameserverRecord("ada"), nameserverRecord("bob")];

		expect(
			splitExternalDomainRecords([
				wwwRecord,
				nsRecords[0] as RequiredDomainRecord,
				ownershipRecord,
				nsRecords[1] as RequiredDomainRecord,
			]),
		).toEqual({
			manualRecords: [wwwRecord, ownershipRecord],
			nameserverRecords: nsRecords,
		});
	});
});

const wwwRecord: RequiredDomainRecord = {
	name: "www",
	purpose: "traffic",
	type: "CNAME",
	value: "customers.wandit.app",
};

const ownershipRecord: RequiredDomainRecord = {
	name: "_cf-custom-hostname.www.example.com",
	purpose: "ownership_or_ssl_validation",
	type: "TXT",
	value: "token",
};

function nameserverRecord(host: string): RequiredDomainRecord {
	return {
		name: "@",
		purpose: "nameserver",
		type: "NS",
		value: `${host}.ns.cloudflare.com`,
	};
}

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
