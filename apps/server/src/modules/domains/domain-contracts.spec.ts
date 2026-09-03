import {
	attachExternalDomainBodySchema,
	catalogFor,
	DOMAIN_RETAIL_MARGIN_USD_CENTS,
	DOMAIN_TLD_CATALOG,
	dnsRecordDiagnosticSchema,
	domainDnsSchema,
	domainNameSchema,
	domainPriceSnapshotSchema,
	domainRetailUsdCentsFromWholesale,
	domainSchema,
	domainTlds,
	externalDomainNameSchema,
	isReservedDomainName,
	isSupportedTld,
	parseDomainName,
	parseExternalDomainName,
	registrantSchema,
	requiredDomainRecordSchema,
	searchDomainsResultSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const validRegistrant = {
	firstName: "Zack",
	lastName: "Belaid",
	email: "zack@example.com",
	phone: "+213555123456",
	address: {
		street: "12 Rue Didouche Mourad",
		city: "Algiers",
		wilaya: "Alger",
		zip: "16000",
	},
};

describe("domain name contracts", () => {
	it("accepts supported sld.tld names", () => {
		for (const name of [
			"example.com",
			"a.net",
			"my-shop.shop",
			"store123.store",
			"fresh.online",
			"landing.site",
		]) {
			expect(parseDomainName(name)?.name).toBe(name);
			expect(domainNameSchema.safeParse(name).success).toBe(true);
		}
	});

	it("normalizes uppercase user input at the schema boundary", () => {
		expect(domainNameSchema.parse("Example.COM")).toBe("example.com");
		expect(domainNameSchema.parse("My-Store.SHOP")).toBe("my-store.shop");
	});

	it("rejects bad characters and hyphen edge labels", () => {
		for (const name of [
			"bad_name.com",
			"bad name.com",
			"bad!.com",
			"-bad.com",
			"bad-.com",
			"exa_mple.net",
		]) {
			expect(parseDomainName(name)).toBeNull();
			expect(domainNameSchema.safeParse(name).success).toBe(false);
		}
	});

	it("rejects length caps, unsupported TLDs, and subdomain-style input", () => {
		for (const name of [
			`${"a".repeat(64)}.com`,
			"example.dz",
			"example.app",
			"shop.example.com",
			"example",
			".com",
		]) {
			expect(parseDomainName(name)).toBeNull();
			expect(domainNameSchema.safeParse(name).success).toBe(false);
		}
	});

	it("rejects blocklisted Wandit-owned names", () => {
		for (const name of [
			"wandit.app",
			"www.wandit.app",
			"wandit.dev",
			"wandit-preview.com",
		]) {
			expect(isReservedDomainName(name)).toBe(true);
			expect(parseDomainName(name)).toBeNull();
			expect(domainNameSchema.safeParse(name).success).toBe(false);
		}
	});

	it("accepts BYO domains outside the purchase catalog without loosening purchase names", () => {
		expect(parseExternalDomainName("Example.DZ")?.name).toBe("example.dz");
		expect(externalDomainNameSchema.parse("Boutique.ORG")).toBe("boutique.org");
		expect(
			attachExternalDomainBodySchema.parse({ name: "brand.fr" }).name,
		).toBe("brand.fr");
		expect(
			domainSchema.parse(domainDto({ name: "brand.fr", tld: "fr" })).tld,
		).toBe("fr");

		expect(parseDomainName("brand.fr")).toBeNull();
		expect(domainNameSchema.safeParse("brand.fr").success).toBe(false);
		expect(externalDomainNameSchema.safeParse("shop.example.com").success).toBe(
			false,
		);
	});
});

describe("domain TLD catalog", () => {
	it("exports the launch TLD set and positive wholesale safety ceilings", () => {
		expect(domainTlds).toEqual([
			"com",
			"net",
			"shop",
			"store",
			"online",
			"site",
		]);

		for (const tld of domainTlds) {
			const catalog = DOMAIN_TLD_CATALOG[tld];

			expect(catalog.wholesaleCeilingUsd).toBeGreaterThan(0);
			expect(catalogFor(tld)).toEqual(catalog);
		}

		expect(
			Object.fromEntries(
				domainTlds.map((tld) => [
					tld,
					DOMAIN_TLD_CATALOG[tld].wholesaleCeilingUsd,
				]),
			),
		).toEqual({
			com: 24,
			net: 28,
			online: 32,
			shop: 36,
			site: 30,
			store: 36,
		});
	});

	it("adds the fixed USD-cents retail margin to the rounded wholesale quote", () => {
		expect(DOMAIN_RETAIL_MARGIN_USD_CENTS).toBe(200);
		expect(domainRetailUsdCentsFromWholesale(12.99)).toBe(1_499);
		expect(domainRetailUsdCentsFromWholesale(12.994)).toBe(1_499);
		expect(domainRetailUsdCentsFromWholesale(12.995)).toBe(1_500);
	});

	it("identifies unsupported TLDs", () => {
		expect(isSupportedTld("com")).toBe(true);
		expect(isSupportedTld(".shop")).toBe(true);
		expect(isSupportedTld("dz")).toBe(false);
		expect(catalogFor("dz")).toBeNull();
	});

	it("accepts Name.com as the provider for newly purchased domains", () => {
		const domain = domainSchema.parse({
			...domainDto(),
			provider: "namecom",
			source: "purchased",
			status: "active",
		});

		expect(domain.provider).toBe("namecom");
		expect(domain).not.toHaveProperty("priceSnapshot");
	});

	it("requires an explicit USD price or null in domain search results", () => {
		expect(
			searchDomainsResultSchema.parse({
				availability: "available",
				name: "example.com",
				registrationPriceUsd: 30,
				tld: "com",
			}),
		).toMatchObject({ registrationPriceUsd: 30 });

		expect(
			searchDomainsResultSchema.parse({
				availability: "unavailable",
				name: "example.net",
				registrationPriceUsd: null,
				tld: "net",
			}),
		).toMatchObject({ registrationPriceUsd: null });

		expect(
			searchDomainsResultSchema.safeParse({
				availability: "available",
				name: "example.com",
				tld: "com",
			}).success,
		).toBe(false);
	});

	it("freezes charged pricing facts in the order price snapshot", () => {
		const snapshot = domainPriceSnapshotSchema.parse({
			chargedAmountCents: 3000,
			chargedCurrency: "usd",
			quotedWholesaleUsd: 11.06,
			tld: "com",
			wholesaleCeilingUsd: 24,
		});

		expect(snapshot.chargedAmountCents).toBe(3000);
		expect(snapshot.quotedWholesaleUsd).toBe(11.06);

		expect(
			domainPriceSnapshotSchema.parse({
				chargedAmountCents: 3000,
				chargedCurrency: "usd",
				quotedWholesaleUsd: null,
				tld: "com",
				wholesaleCeilingUsd: 24,
			}).quotedWholesaleUsd,
		).toBeNull();

		// The legacy credits-era shape no longer parses.
		expect(
			domainPriceSnapshotSchema.safeParse({
				registrationCredits: 120,
				renewalCredits: 120,
				tld: "com",
				wholesaleCeilingUsd: 15,
			}).success,
		).toBe(false);
	});
});

describe("domain DNS contracts", () => {
	it("exposes an additive stalled external-verification marker", () => {
		const dns = domainDnsSchema.parse({
			externalVerification: {
				attempts: 101,
				stalledAt: "2026-08-12T10:00:00.000Z",
			},
			records: [],
		});

		expect(dns.externalVerification).toEqual({
			attempts: 101,
			stalledAt: "2026-08-12T10:00:00.000Z",
		});
	});

	it("accepts NS nameserver records and the apex zone state of purchased and external domains", () => {
		expect(
			requiredDomainRecordSchema.parse({
				name: "@",
				purpose: "nameserver",
				type: "NS",
				value: "art.ns.cloudflare.com",
			}).type,
		).toBe("NS");
		expect(
			requiredDomainRecordSchema.safeParse({
				name: "@",
				purpose: "traffic",
				type: "ANAME",
				value: "customers.wandit.app",
			}).success,
		).toBe(false);

		const dns = domainDnsSchema.parse({
			apexConfigured: true,
			apexCustomHostnameId: "cf_apex",
			apexCustomHostnameNudged: true,
			apexCustomHostnameStatus: "active",
			apexError: "Cloudflare zone request failed",
			records: [],
			zoneActive: true,
			zoneCreated: true,
			zoneDelegated: true,
			zoneId: "zone_1",
			zoneNameServers: ["art.ns.cloudflare.com", "savanna.ns.cloudflare.com"],
			zoneScanRecordsAdded: 3,
			zoneScanned: true,
			zoneStatus: "active",
		});

		expect(dns).toMatchObject({
			apexConfigured: true,
			apexCustomHostnameId: "cf_apex",
			apexCustomHostnameNudged: true,
			apexCustomHostnameStatus: "active",
			apexError: "Cloudflare zone request failed",
			zoneActive: true,
			zoneCreated: true,
			zoneDelegated: true,
			zoneId: "zone_1",
			zoneNameServers: ["art.ns.cloudflare.com", "savanna.ns.cloudflare.com"],
			zoneScanRecordsAdded: 3,
			zoneScanned: true,
			zoneStatus: "active",
		});
		expect(
			domainDnsSchema.safeParse({ apexConfigured: "yes", records: [] }).success,
		).toBe(false);
		expect(
			domainDnsSchema.safeParse({ records: [], zoneNameServers: "art" })
				.success,
		).toBe(false);
		// The external DNS-import markers are optional and strictly typed.
		expect(
			domainDnsSchema.safeParse({ records: [], zoneScanRecordsAdded: -1 })
				.success,
		).toBe(false);
		expect(
			domainDnsSchema.safeParse({ records: [], zoneScanned: "done" }).success,
		).toBe(false);
	});

	it("parses per-record DNS diagnostic results", () => {
		expect(
			dnsRecordDiagnosticSchema.parse({
				name: "www",
				observedValues: ["elsewhere.example.net"],
				purpose: "traffic",
				status: "mismatch",
				type: "CNAME",
				value: "customers.wandit.app",
			}),
		).toMatchObject({
			observedValues: ["elsewhere.example.net"],
			status: "mismatch",
		});
	});
});

describe("registrant contract", () => {
	it("accepts E.164 phone numbers and defaults the country code to DZ", () => {
		const registrant = registrantSchema.parse(validRegistrant);

		expect(registrant.phone).toBe("+213555123456");
		expect(registrant.address.countryCode).toBe("DZ");
	});

	it("rejects non-E.164 or too-short phone numbers", () => {
		for (const phone of [
			"0555123456",
			"+0123",
			"+213 555123456",
			"+abc",
			"+1234567",
		]) {
			expect(
				registrantSchema.safeParse({
					...validRegistrant,
					phone,
				}).success,
			).toBe(false);
		}
	});

	it("requires wilaya in the address", () => {
		expect(
			registrantSchema.safeParse({
				...validRegistrant,
				address: {
					street: "12 Rue Didouche Mourad",
					city: "Algiers",
					zip: "16000",
					countryCode: "DZ",
				},
			}).success,
		).toBe(false);
	});
});

function domainDto(overrides: Partial<ReturnType<typeof baseDomainDto>> = {}) {
	return {
		...baseDomainDto(),
		...overrides,
	};
}

function baseDomainDto() {
	return {
		autoRenew: false,
		createdAt: "2026-07-04T00:00:00.000Z",
		dns: { records: [] },
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-000000000001",
		isPrimary: false,
		name: "brand.com",
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: null,
		registrant: null,
		source: "external",
		status: "configuring",
		tld: "com",
		updatedAt: "2026-07-04T00:00:00.000Z",
		userId: "user_1",
		whoisPrivacy: false,
	};
}
