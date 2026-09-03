import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DomainProviderError,
	DomainsNotConfiguredError,
} from "../../domain/errors/domain.errors";
import { CustomerZoneService } from "./customer-zone.service";

const API = "https://api.cloudflare.com/client/v4";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function fetchCall(index: number): {
	body: Record<string, unknown> | null;
	method: string | undefined;
	url: string;
} {
	const call = fetchMock.mock.calls[index];

	if (!call) {
		throw new Error(`Expected fetch call ${index}`);
	}

	const [input, init = {}] = call;
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.toString()
				: input.url;

	return {
		body:
			typeof init.body === "string"
				? (JSON.parse(init.body) as Record<string, unknown>)
				: null,
		method: init.method,
		url,
	};
}

function zoneResult(overrides: Record<string, unknown> = {}) {
	return {
		id: "zone_1",
		name: "example.com",
		name_servers: ["Art.ns.cloudflare.com", "savanna.ns.cloudflare.com"],
		status: "pending",
		...overrides,
	};
}

beforeEach(() => {
	vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
	vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account_1");
	fetchMock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", fetchMock);
	vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("CustomerZoneService", () => {
	it("creates a full zone in the configured account and maps id, nameservers, and status", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ result: zoneResult(), success: true }),
		);
		const service = new CustomerZoneService();

		await expect(service.createZone("Example.com")).resolves.toEqual({
			id: "zone_1",
			nameServers: ["art.ns.cloudflare.com", "savanna.ns.cloudflare.com"],
			status: "pending",
		});

		const request = fetchCall(0);
		expect(request.url).toBe(`${API}/zones`);
		expect(request.method).toBe("POST");
		expect(request.body).toEqual({
			account: { id: "account_1" },
			name: "example.com",
			type: "full",
		});
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.headers).toMatchObject({ Authorization: "Bearer cf-token" });
	});

	it("refuses to create a zone without CLOUDFLARE_ACCOUNT_ID before calling Cloudflare", async () => {
		vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
		const service = new CustomerZoneService();

		await expect(service.createZone("example.com")).rejects.toBeInstanceOf(
			DomainsNotConfiguredError,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("finds a zone by exact name and returns null when the account has none", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					result: [
						zoneResult({ id: "zone_other", name: "sub.example.com" }),
						zoneResult({ id: "zone_1", name: "EXAMPLE.com", status: "active" }),
					],
					success: true,
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ result: [], success: true }));
		const service = new CustomerZoneService();

		await expect(service.findZoneByName("example.com")).resolves.toEqual({
			id: "zone_1",
			nameServers: ["art.ns.cloudflare.com", "savanna.ns.cloudflare.com"],
			status: "active",
		});
		await expect(service.findZoneByName("example.com")).resolves.toBeNull();

		expect(fetchCall(0).url).toBe(`${API}/zones?name=example.com`);
		expect(fetchCall(0).method).toBe("GET");
	});

	it("reads the zone status and re-runs the activation check with PUT", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					result: zoneResult({ status: "active" }),
					success: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "zone_1" }, success: true }),
			);
		const service = new CustomerZoneService();

		await expect(service.getZoneStatus("zone_1")).resolves.toBe("active");
		await expect(
			service.requestActivationCheck("zone_1"),
		).resolves.toBeUndefined();

		expect(fetchCall(0)).toMatchObject({
			method: "GET",
			url: `${API}/zones/zone_1`,
		});
		expect(fetchCall(1)).toMatchObject({
			body: null,
			method: "PUT",
			url: `${API}/zones/zone_1/activation_check`,
		});
	});

	it("reports a zone that no longer exists as null instead of a provider error", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				{
					errors: [{ code: 7003, message: "Could not route" }],
					success: false,
				},
				404,
			),
		);
		const service = new CustomerZoneService();

		await expect(service.getZoneStatus("zone_gone")).resolves.toBeNull();
		expect(fetchCall(0)).toMatchObject({
			method: "GET",
			url: `${API}/zones/zone_gone`,
		});
	});

	it("gives the record scan its own longer timeout and keeps the shared one elsewhere", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					result: { recs_added: 2, total_records_parsed: 5 },
					success: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: zoneResult(), success: true }),
			);
		const service = new CustomerZoneService();

		await service.scanDnsRecords("zone_1");
		await service.getZoneStatus("zone_1");

		expect(timeout).toHaveBeenNthCalledWith(1, 60_000);
		expect(timeout).toHaveBeenNthCalledWith(2, 10_000);
	});

	it("creates a missing DNS record as DNS-only with automatic TTL", async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ result: [], success: true }))
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "rec_1" }, success: true }),
			);
		const service = new CustomerZoneService();

		await expect(
			service.upsertDnsRecord("zone_1", {
				content: "customers.wandit.app",
				name: "Example.com",
				type: "CNAME",
			}),
		).resolves.toBe("created");

		expect(fetchCall(0)).toMatchObject({
			method: "GET",
			url: `${API}/zones/zone_1/dns_records?type=CNAME&name=example.com`,
		});
		expect(fetchCall(1)).toMatchObject({
			body: {
				content: "customers.wandit.app",
				name: "example.com",
				proxied: false,
				ttl: 1,
				type: "CNAME",
			},
			method: "POST",
			url: `${API}/zones/zone_1/dns_records`,
		});
	});

	it("patches an existing record whose content differs and leaves an equal one alone", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					result: [
						{
							content: "old-origin.example",
							id: "rec_1",
							name: "www.example.com",
							proxied: false,
							type: "CNAME",
						},
					],
					success: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "rec_1" }, success: true }),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					result: [
						{
							content: '"apex-token"',
							id: "rec_2",
							name: "_cf-custom-hostname.example.com",
							proxied: false,
							type: "TXT",
						},
					],
					success: true,
				}),
			);
		const service = new CustomerZoneService();

		await expect(
			service.upsertDnsRecord("zone_1", {
				content: "customers.wandit.app",
				name: "www.example.com",
				proxied: false,
				type: "CNAME",
			}),
		).resolves.toBe("updated");
		expect(fetchCall(1)).toMatchObject({
			body: {
				content: "customers.wandit.app",
				name: "www.example.com",
				proxied: false,
				ttl: 1,
				type: "CNAME",
			},
			method: "PATCH",
			url: `${API}/zones/zone_1/dns_records/rec_1`,
		});

		// Cloudflare returns TXT content quoted; that is still the same record.
		await expect(
			service.upsertDnsRecord("zone_1", {
				content: "apex-token",
				name: "_cf-custom-hostname.example.com",
				type: "TXT",
			}),
		).resolves.toBe("unchanged");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("imports the domain's public DNS with a bodiless scan POST and maps the counters", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				errors: [],
				messages: [
					{
						code: 81053,
						message:
							"www.example.com: An A, AAAA, or CNAME record with that host already exists.",
					},
				],
				result: {
					recs_added: 1,
					recs_added_by_type: { TXT: 1 },
					total_records_parsed: 8,
				},
				success: true,
			}),
		);
		const service = new CustomerZoneService();

		await expect(service.scanDnsRecords("zone_1")).resolves.toEqual({
			recordsAdded: 1,
			recordsParsed: 8,
		});
		expect(fetchCall(0)).toMatchObject({
			body: null,
			method: "POST",
			url: `${API}/zones/zone_1/dns_records/scan`,
		});
	});

	it("tolerates a scan result without counters", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ result: {}, success: true }),
		);
		const service = new CustomerZoneService();

		await expect(service.scanDnsRecords("zone_1")).resolves.toEqual({
			recordsAdded: 0,
			recordsParsed: 0,
		});
	});

	it("turns every proxied address record DNS-only across pages and leaves the rest alone", async () => {
		const page = (records: unknown[], pageNumber: number, totalPages: number) =>
			jsonResponse({
				result: records,
				result_info: { page: pageNumber, total_pages: totalPages },
				success: true,
			});
		const firstPage = Array.from({ length: 100 }, (_, index) => ({
			content: `192.0.2.${index}`,
			id: `rec_${index}`,
			name: `host${index}.example.com`,
			proxied: index === 7,
			type: "A",
		}));
		fetchMock
			.mockResolvedValueOnce(page(firstPage, 1, 2))
			.mockResolvedValueOnce(
				page(
					[
						{
							content: "shop.example.com",
							id: "rec_cname",
							name: "www.example.com",
							proxied: true,
							type: "CNAME",
						},
						{
							content: "mail.example.com",
							id: "rec_mx",
							name: "example.com",
							proxied: true,
							type: "MX",
						},
						{
							content: "v=spf1 -all",
							id: "rec_txt",
							name: "example.com",
							proxied: false,
							type: "TXT",
						},
					],
					2,
					2,
				),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "rec_7" }, success: true }),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "rec_cname" }, success: true }),
			);
		const service = new CustomerZoneService();

		await expect(service.disableProxyOnAllRecords("zone_1")).resolves.toBe(2);

		expect(fetchCall(0)).toMatchObject({
			method: "GET",
			url: `${API}/zones/zone_1/dns_records?per_page=100&page=1`,
		});
		expect(fetchCall(1)).toMatchObject({
			method: "GET",
			url: `${API}/zones/zone_1/dns_records?per_page=100&page=2`,
		});
		expect(fetchCall(2)).toMatchObject({
			body: { proxied: false },
			method: "PATCH",
			url: `${API}/zones/zone_1/dns_records/rec_7`,
		});
		expect(fetchCall(3)).toMatchObject({
			body: { proxied: false },
			method: "PATCH",
			url: `${API}/zones/zone_1/dns_records/rec_cname`,
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("deletes the address records at one exact name except a CNAME that already points at the kept content", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					result: [
						{
							content: "192.0.2.10",
							id: "rec_a",
							name: "example.com",
							proxied: false,
							type: "A",
						},
						{
							content: "2001:db8::1",
							id: "rec_aaaa",
							name: "example.com",
							proxied: false,
							type: "AAAA",
						},
						{
							content: "v=spf1 -all",
							id: "rec_txt",
							name: "example.com",
							proxied: false,
							type: "TXT",
						},
						{
							content: "192.0.2.11",
							id: "rec_other_name",
							name: "sub.example.com",
							proxied: false,
							type: "A",
						},
					],
					result_info: { page: 1, total_pages: 1 },
					success: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "rec_a" }, success: true }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(
				jsonResponse({
					result: [
						{
							content: "Customers.wandit.app.",
							id: "rec_ours",
							name: "www.example.com",
							proxied: false,
							type: "CNAME",
						},
					],
					result_info: { page: 1, total_pages: 1 },
					success: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					result: [
						{
							content: "old-host.example",
							id: "rec_stale",
							name: "www.example.com",
							proxied: true,
							type: "CNAME",
						},
					],
					result_info: { page: 1, total_pages: 1 },
					success: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({ result: { id: "rec_stale" }, success: true }),
			);
		const service = new CustomerZoneService();

		await expect(
			service.deleteDnsRecords("zone_1", {
				keepContent: "customers.wandit.app",
				name: "Example.com",
				types: ["A", "AAAA", "CNAME"],
			}),
		).resolves.toBe(2);
		expect(fetchCall(0)).toMatchObject({
			method: "GET",
			url: `${API}/zones/zone_1/dns_records?per_page=100&page=1&name=example.com`,
		});
		expect(fetchCall(1)).toMatchObject({
			method: "DELETE",
			url: `${API}/zones/zone_1/dns_records/rec_a`,
		});
		// A record that vanished meanwhile (404) still counts as deleted.
		expect(fetchCall(2)).toMatchObject({
			method: "DELETE",
			url: `${API}/zones/zone_1/dns_records/rec_aaaa`,
		});

		// Our own CNAME (case/dot-insensitive) is kept; a foreign one goes.
		await expect(
			service.deleteDnsRecords("zone_1", {
				keepContent: "customers.wandit.app",
				name: "www.example.com",
				types: ["A", "AAAA", "CNAME"],
			}),
		).resolves.toBe(0);
		await expect(
			service.deleteDnsRecords("zone_1", {
				keepContent: "customers.wandit.app",
				name: "www.example.com",
				types: ["A", "AAAA", "CNAME"],
			}),
		).resolves.toBe(1);
		expect(fetchCall(5)).toMatchObject({
			method: "DELETE",
			url: `${API}/zones/zone_1/dns_records/rec_stale`,
		});
		expect(fetchMock).toHaveBeenCalledTimes(6);
	});

	it("treats a zone DELETE 404 as deleted", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
		const service = new CustomerZoneService();

		await expect(service.deleteZone("zone_gone")).resolves.toBeUndefined();
		expect(fetchCall(0)).toMatchObject({
			method: "DELETE",
			url: `${API}/zones/zone_gone`,
		});
	});

	it("maps Cloudflare failures, success:false payloads, and timeouts to provider errors", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse(
					{
						errors: [{ code: 1224, message: "once per hour" }],
						success: false,
					},
					429,
				),
			)
			.mockResolvedValueOnce(
				jsonResponse({ errors: [{ code: 1061 }], success: false }, 200),
			)
			.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
		const service = new CustomerZoneService();

		await expect(
			service.requestActivationCheck("zone_1"),
		).rejects.toBeInstanceOf(DomainProviderError);
		await expect(service.createZone("example.com")).rejects.toBeInstanceOf(
			DomainProviderError,
		);
		await expect(service.getZoneStatus("zone_1")).rejects.toBeInstanceOf(
			DomainProviderError,
		);
	});

	it("requires CLOUDFLARE_API_TOKEN for every request", async () => {
		vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
		const service = new CustomerZoneService();

		await expect(service.findZoneByName("example.com")).rejects.toBeInstanceOf(
			DomainsNotConfiguredError,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
