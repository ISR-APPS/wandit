import {
	attachExternalDomainBodySchema,
	catalogFor,
	DOMAIN_TLD_CATALOG,
	domainNameSchema,
	domainSchema,
	domainTlds,
	externalDomainNameSchema,
	isReservedDomainName,
	isSupportedTld,
	parseDomainName,
	parseExternalDomainName,
	purchaseDomainBodySchema,
	registrantSchema,
	registrationPriceFor,
	renewalPriceFor,
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
		expect(
			purchaseDomainBodySchema.parse({
				name: "My-Store.SHOP",
				registrant: validRegistrant,
			}).name,
		).toBe("my-store.shop");
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
	it("exports the launch TLD set and positive catalog values", () => {
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

			expect(catalog.registrationCredits).toBeGreaterThan(0);
			expect(catalog.renewalCredits).toBeGreaterThan(0);
			expect(catalog.wholesaleCeilingUsd).toBeGreaterThan(0);
			expect(catalogFor(tld)).toEqual(catalog);
			expect(registrationPriceFor(`example.${tld}`)).toBe(
				catalog.registrationCredits,
			);
			expect(renewalPriceFor(`.${tld}`)).toBe(catalog.renewalCredits);
		}
	});

	it("identifies unsupported TLDs and invalid names", () => {
		expect(isSupportedTld("com")).toBe(true);
		expect(isSupportedTld(".shop")).toBe(true);
		expect(isSupportedTld("dz")).toBe(false);
		expect(catalogFor("dz")).toBeNull();
		expect(registrationPriceFor("example.dz")).toBeNull();
		expect(renewalPriceFor("dz")).toBeNull();
	});
});

describe("registrant contract", () => {
	it("accepts E.164 phone numbers and defaults the country code to DZ", () => {
		const registrant = registrantSchema.parse(validRegistrant);

		expect(registrant.phone).toBe("+213555123456");
		expect(registrant.address.countryCode).toBe("DZ");
	});

	it("rejects non-E.164 phone numbers", () => {
		for (const phone of ["0555123456", "+0123", "+213 555123456", "+abc"]) {
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
		priceSnapshot: null,
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
