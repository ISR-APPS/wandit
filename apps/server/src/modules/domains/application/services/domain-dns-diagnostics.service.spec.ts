import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";
import { DomainDnsDiagnosticsService } from "./domain-dns-diagnostics.service";

const dnsMocks = vi.hoisted(() => ({
	resolve4: vi.fn<(hostname: string) => Promise<string[]>>(),
	resolve6: vi.fn<(hostname: string) => Promise<string[]>>(),
	resolveCname: vi.fn<(hostname: string) => Promise<string[]>>(),
	resolveTxt: vi.fn<(hostname: string) => Promise<string[][]>>(),
}));

vi.mock("node:dns/promises", () => dnsMocks);

const scope: ProjectScope = { kind: "personal", userId: "user_1" };

describe("DomainDnsDiagnosticsService", () => {
	afterEach(() => {
		vi.useRealTimers();
		for (const resolver of Object.values(dnsMocks)) {
			resolver.mockReset();
		}
	});

	it("classifies found, mismatch, missing, and unavailable lookups", async () => {
		const longTxtValue = "x".repeat(300);
		const row = domainRow({
			dns: {
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: "customers.wandit.app",
					},
					{
						name: "_cf-custom-hostname.brand.com.",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "expected-token",
					},
					{
						name: "_missing",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "missing-token",
					},
					{
						name: "@",
						purpose: "traffic",
						type: "A",
						value: "192.0.2.1",
					},
				],
			},
		});
		dnsMocks.resolveCname.mockResolvedValue(["CUSTOMERS.WANDIT.APP."]);
		dnsMocks.resolveTxt.mockImplementation(async (hostname) => {
			if (hostname === "_missing.brand.com") {
				throw Object.assign(new Error("queryTxt ENOTFOUND"), {
					code: "ENOTFOUND",
				});
			}

			return [[longTxtValue]];
		});
		dnsMocks.resolve4.mockRejectedValue(
			Object.assign(new Error("queryA ESERVFAIL"), { code: "ESERVFAIL" }),
		);

		const response = await serviceFor(row).getStatus(row.id, scope);

		expect(response.domain.id).toBe(row.id);
		expect(response.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(response.records).toEqual([
			expect.objectContaining({
				observedValues: ["CUSTOMERS.WANDIT.APP."],
				status: "found",
			}),
			expect.objectContaining({
				observedValues: [`${"x".repeat(253)}...`],
				status: "mismatch",
			}),
			expect.objectContaining({ observedValues: [], status: "missing" }),
			expect.objectContaining({ observedValues: [], status: "unknown" }),
		]);
		expect(dnsMocks.resolveCname).toHaveBeenCalledWith("www.brand.com");
		expect(dnsMocks.resolveTxt).toHaveBeenNthCalledWith(
			1,
			"_cf-custom-hostname.brand.com",
		);
		expect(dnsMocks.resolveTxt).toHaveBeenNthCalledWith(
			2,
			"_missing.brand.com",
		);
		expect(dnsMocks.resolve4).toHaveBeenCalledWith("brand.com");
	});

	it("shares one DNS query across records with the same name and type", async () => {
		const row = domainRow({
			dns: {
				records: [
					{
						name: "_validation",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "token-one",
					},
					{
						name: "_validation",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "token-two",
					},
				],
			},
		});
		dnsMocks.resolveTxt.mockResolvedValue([["token-one"], ["token-two"]]);

		const response = await serviceFor(row).getStatus(row.id, scope);

		expect(response.records.map((record) => record.status)).toEqual([
			"found",
			"found",
		]);
		expect(dnsMocks.resolveTxt).toHaveBeenCalledOnce();
	});

	it("reports flattened CNAME addresses as unknown instead of missing", async () => {
		const row = domainRow({
			dns: {
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: "customers.wandit.app",
					},
				],
			},
		});
		dnsMocks.resolveCname.mockRejectedValue(
			Object.assign(new Error("queryCname ENODATA"), { code: "ENODATA" }),
		);
		dnsMocks.resolve4.mockResolvedValue(["192.0.2.10"]);
		dnsMocks.resolve6.mockRejectedValue(
			Object.assign(new Error("queryAaaa ENODATA"), { code: "ENODATA" }),
		);

		await expect(
			serviceFor(row).getStatus(row.id, scope),
		).resolves.toMatchObject({
			records: [
				{
					observedValues: ["192.0.2.10"],
					status: "unknown",
				},
			],
		});
		expect(dnsMocks.resolve4).toHaveBeenCalledWith("www.brand.com");
		expect(dnsMocks.resolve6).toHaveBeenCalledWith("www.brand.com");
	});

	it("reports a timed-out query as unknown after three seconds", async () => {
		vi.useFakeTimers();
		const row = domainRow({
			dns: {
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "AAAA",
						value: "2001:db8::1",
					},
				],
			},
		});
		dnsMocks.resolve6.mockReturnValue(new Promise(() => undefined));

		const pending = serviceFor(row).getStatus(row.id, scope);
		await vi.advanceTimersByTimeAsync(3_000);

		await expect(pending).resolves.toMatchObject({
			records: [{ observedValues: [], status: "unknown" }],
		});
	});
});

function serviceFor(row: DomainRow) {
	const repository = {
		getByIdForScope: vi.fn(async () => row),
	};

	return new DomainDnsDiagnosticsService(
		repository as unknown as DomainsRepository,
	);
}

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
	const now = new Date("2026-08-12T10:00:00.000Z");

	return {
		autoRenew: false,
		cfCustomHostnameId: "cf_1",
		createdAt: now,
		dns: { records: [] },
		error: null,
		expiresAt: null,
		id: "22222222-2222-4222-8222-000000000001",
		isPrimary: false,
		name: "brand.com",
		paymentOrderId: null,
		priceSnapshot: null,
		projectId: "11111111-1111-4111-8111-111111111111",
		provider: null,
		providerDomainId: null,
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "external",
		status: "configuring",
		tld: "com",
		transferLockExpiresAt: null,
		updatedAt: now,
		userId: "user_1",
		whoisPrivacy: false,
		...overrides,
	};
}
