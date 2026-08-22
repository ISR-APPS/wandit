import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
	LEGAL_COMPANY,
	LEGAL_COMPANY_ADDRESS,
	LEGAL_COMPANY_REGISTERED_NAME,
	LEGAL_CONTACT_EMAIL,
	LEGAL_SITE_URL,
} from "./constants";

// Both Google (OAuth app verification) and Meta (business verification) crawl
// the raw HTML of this client-rendered SPA. The static fallback in index.html
// is the only legal-entity mention a crawler without JavaScript can read, and
// it is plain text, so this spec is what keeps it in step with the constants.
const indexHtml = readFileSync(
	fileURLToPath(new URL("../../../../index.html", import.meta.url)),
	"utf8",
);

function readOrganizationJsonLd(): Record<string, unknown> {
	const match = indexHtml.match(
		/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
	);
	if (!match?.[1]) {
		throw new Error("index.html has no ld+json block");
	}
	return JSON.parse(match[1]);
}

describe("LEGAL_COMPANY_REGISTERED_NAME", () => {
	it("is the same entity as LEGAL_COMPANY, as the licence spells it", () => {
		expect(LEGAL_COMPANY_REGISTERED_NAME).toBe(
			"SCALEMIND MARKETING CONSULTANCY L.L.C",
		);
		expect(LEGAL_COMPANY_REGISTERED_NAME.toLowerCase()).toBe(
			LEGAL_COMPANY.toLowerCase(),
		);
	});
});

describe("index.html legal fallback", () => {
	it("names the legal entity in the static, no-JS footer", () => {
		const fallback = indexHtml.match(
			/<footer id="legal-fallback"[\s\S]*?<\/footer>/,
		)?.[0];
		expect(fallback).toBeDefined();
		expect(fallback).toContain(LEGAL_COMPANY_REGISTERED_NAME);
	});

	it("names the legal entity in the static og:description", () => {
		const ogDescription = indexHtml.match(
			/<meta\s+property="og:description"\s+content="([^"]*)"/,
		)?.[1];
		expect(ogDescription).toContain(LEGAL_COMPANY_REGISTERED_NAME);
	});

	it("keeps the Organization structured data in step with LEGAL_*", () => {
		const org = readOrganizationJsonLd();
		expect(org["@type"]).toBe("Organization");
		expect(org.legalName).toBe(LEGAL_COMPANY_REGISTERED_NAME);
		expect(org.url).toBe(LEGAL_SITE_URL);
		expect(org.email).toBe(LEGAL_CONTACT_EMAIL);

		const address = org.address as Record<string, string>;
		expect(address["@type"]).toBe("PostalAddress");
		expect(LEGAL_COMPANY_ADDRESS).toContain(address.streetAddress);
		expect(LEGAL_COMPANY_ADDRESS).toContain(address.addressLocality);
		expect(address.addressCountry).toBe("AE");
	});
});
