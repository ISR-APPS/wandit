import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) => key.split(".").at(-1) ?? key,
	}),
}));

const dnsRecordsTableModule = "./dns-records-table.tsx";
const { DnsRecordsTable } = await import(dnsRecordsTableModule);

describe("DnsRecordsTable", () => {
	it("renders per-record diagnostics and the observed wrong value", () => {
		const diagnostics = [
			{
				name: "www",
				observedValues: ["customers.wandit.app."],
				purpose: "traffic",
				status: "found" as const,
				type: "CNAME" as const,
				value: "customers.wandit.app",
			},
			{
				name: "_validation",
				observedValues: ["old-token"],
				purpose: "ownership_or_ssl_validation",
				status: "mismatch" as const,
				type: "TXT" as const,
				value: "expected-token",
			},
			{
				name: "_missing",
				observedValues: [],
				purpose: "ownership_or_ssl_validation",
				status: "missing" as const,
				type: "TXT" as const,
				value: "another-token",
			},
			{
				name: "@",
				observedValues: [],
				purpose: "traffic",
				status: "unknown" as const,
				type: "A" as const,
				value: "192.0.2.1",
			},
		];
		const records = [
			...diagnostics,
			{
				name: "_new-validation",
				purpose: "ownership_or_ssl_validation",
				type: "TXT" as const,
				value: "new-token-not-yet-diagnosed",
			},
		];
		const html = renderToStaticMarkup(
			createElement(DnsRecordsTable, {
				records,
				diagnostics,
				onRefresh: vi.fn(),
			}),
		);

		expect(html).toContain("dnsFound");
		expect(html).toContain("dnsMismatch");
		expect(html).toContain("dnsMissing");
		expect(html).toContain("dnsUnknown");
		expect(html).toContain("dnsObserved");
		expect(html).toContain('<bdi dir="ltr" class="font-mono">old-token</bdi>');
		expect(html).toContain("new-token-not-yet-diagnosed");
		expect(html).not.toContain("dnsChecking");
		expect(html).toContain("refreshDns");
	});

	it("matches a diagnostic when its expected value has rotated", () => {
		const html = renderToStaticMarkup(
			createElement(DnsRecordsTable, {
				records: [
					{
						name: "_validation",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "new-token",
					},
				],
				diagnostics: [
					{
						name: "_validation",
						observedValues: ["old-token"],
						purpose: "ownership_or_ssl_validation",
						status: "mismatch",
						type: "TXT",
						value: "old-token",
					},
				],
				onRefresh: vi.fn(),
			}),
		);

		expect(html).toContain("dnsMismatch");
		expect(html).not.toContain("dnsUnknown");
	});

	it("shows checking only while diagnostics are loading", () => {
		const props = {
			records: [
				{
					name: "www",
					purpose: "traffic",
					type: "CNAME" as const,
					value: "customers.wandit.app",
				},
			],
			diagnostics: [],
			onRefresh: vi.fn(),
		};
		const loadedHtml = renderToStaticMarkup(
			createElement(DnsRecordsTable, props),
		);
		const loadingHtml = renderToStaticMarkup(
			createElement(DnsRecordsTable, { ...props, isRefreshing: true }),
		);

		expect(loadedHtml).toContain("dnsUnknown");
		expect(loadedHtml).not.toContain("dnsChecking");
		expect(loadingHtml).toContain("dnsChecking");
	});
});
