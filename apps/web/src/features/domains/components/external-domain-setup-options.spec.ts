import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RequiredDomainRecord } from "../api/domains.dto";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			const leaf = key.split(".").at(-1) ?? key;
			return params ? `${leaf}(${Object.values(params).join(",")})` : leaf;
		},
	}),
}));

const setupOptionsModule = "./external-domain-setup-options.tsx";
const { ExternalDomainSetupOptions } = await import(setupOptionsModule);

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
	value: "ownership-token",
};
const nameserverRecords: RequiredDomainRecord[] = [
	{
		name: "@",
		purpose: "nameserver",
		type: "NS",
		value: "ada.ns.cloudflare.com",
	},
	{
		name: "@",
		purpose: "nameserver",
		type: "NS",
		value: "bob.ns.cloudflare.com",
	},
];

function count(html: string, needle: string) {
	return html.split(needle).length - 1;
}

describe("ExternalDomainSetupOptions", () => {
	it("renders the routing note and one records table when no zone exists", () => {
		const html = renderToStaticMarkup(
			createElement(ExternalDomainSetupOptions, {
				name: "example.com",
				records: [wwwRecord, ownershipRecord],
				diagnostics: [],
				onRefresh: vi.fn(),
			}),
		);

		expect(html).toContain("externalServedAt");
		expect(html).toContain("externalApexRedirect");
		expect(html).not.toContain("externalApexAutomatic");
		expect(html).not.toContain("externalOptionNsTitle");
		expect(html).not.toContain("externalOptionRecordsTitle");
		expect(count(html, "<table")).toBe(1);
		expect(count(html, "refreshDns")).toBe(1);
		expect(html).toContain("customers.wandit.app");
		expect(html).toContain("ownership-token");
	});

	it("renders both options with the nameservers first and one refresh button", () => {
		const html = renderToStaticMarkup(
			createElement(ExternalDomainSetupOptions, {
				name: "example.com",
				records: [wwwRecord, ...nameserverRecords, ownershipRecord],
				diagnostics: [],
				onRefresh: vi.fn(),
			}),
		);

		expect(html).toContain("externalApexAutomatic");
		expect(html).toContain("externalOptionNsTitle");
		expect(html).toContain(
			"externalOptionNsDescription(example.com,www.example.com)",
		);
		expect(html).toContain("externalOptionNsMail");
		expect(html).toContain("externalOptionNsDnssec");
		expect(html).toContain("externalOptionRecordsTitle");
		expect(html).toContain(
			"externalOptionRecordsDescription(example.com,https://www.example.com,www.example.com)",
		);
		expect(count(html, "<table")).toBe(2);
		expect(count(html, "refreshDns")).toBe(1);
		expect(count(html, "dnsPurposeNameserver")).toBe(2);
		expect(count(html, "dnsStatus<")).toBe(2);

		const [nsTable, manualTable] = html.split("externalOptionRecordsTitle");

		expect(nsTable).toContain("ada.ns.cloudflare.com");
		expect(nsTable).toContain("bob.ns.cloudflare.com");
		expect(nsTable).not.toContain("customers.wandit.app");
		expect(manualTable).toContain("customers.wandit.app");
		expect(manualTable).toContain("ownership-token");
		expect(manualTable).not.toContain("ns.cloudflare.com");
	});

	it("keeps the status column on both tables before diagnostics load", () => {
		const html = renderToStaticMarkup(
			createElement(ExternalDomainSetupOptions, {
				name: "example.com",
				records: [wwwRecord, ...nameserverRecords],
				onRefresh: vi.fn(),
			}),
		);

		expect(count(html, "dnsStatus<")).toBe(2);
		expect(count(html, "dnsUnknown")).toBe(3);
	});
});
