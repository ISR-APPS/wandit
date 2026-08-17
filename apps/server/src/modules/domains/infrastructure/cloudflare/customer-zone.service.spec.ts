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
