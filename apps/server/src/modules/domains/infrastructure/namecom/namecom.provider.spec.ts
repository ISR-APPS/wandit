import { Logger } from "@nestjs/common";
import type { Registrant } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainProviderError } from "../../domain/errors/domain.errors";
import { NamecomProvider } from "./namecom.provider";

const SANDBOX_BASE_URL = "https://api.dev.name.com";
const SANDBOX_USERNAME = "wandit-test";
const SANDBOX_TOKEN = "sandbox-token";

const registrant = {
	address: {
		city: "Algiers",
		countryCode: "DZ",
		street: "12 Rue Didouche Mourad",
		wilaya: "Alger",
		zip: "16000",
	},
	email: "zack@example.com",
	firstName: "Zack",
	lastName: "Belaid",
	phone: "+213555123456",
} satisfies Registrant;

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function fetchCall(
	mock: FetchMock,
	index: number,
): { init: RequestInit; url: string } {
	const call = mock.mock.calls[index];

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

	return { init, url };
}

function jsonBody(init: RequestInit): Record<string, unknown> {
	if (typeof init.body !== "string") {
		throw new Error("Expected a JSON request body");
	}

	return JSON.parse(init.body) as Record<string, unknown>;
}

beforeEach(() => {
	vi.stubEnv("NAMECOM_ENVIRONMENT", "sandbox");
	vi.stubEnv("NAMECOM_USERNAME", SANDBOX_USERNAME);
	vi.stubEnv("NAMECOM_API_TOKEN", SANDBOX_TOKEN);

	fetchMock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", fetchMock);
	vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("NamecomProvider", () => {
	it("uses the sandbox base URL and Basic auth while restoring caller order for availability", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				results: [
					{
						domainName: "second.com",
						purchasable: false,
						purchaseType: "registration",
					},
					{
						domainName: "first.com",
						premium: true,
						purchasable: true,
						purchasePrice: 18.5,
						purchaseType: "registration",
						renewalPrice: 19.5,
					},
				],
			}),
		);
		const provider = new NamecomProvider();

		const result = await provider.checkAvailability([
			"First.COM",
			"second.com",
		]);

		expect(result).toEqual([
			{
				available: true,
				name: "First.COM",
				premium: true,
				renewalPriceUsd: 19.5,
				wholesalePriceUsd: 18.5,
			},
			{
				available: false,
				name: "second.com",
				premium: false,
				renewalPriceUsd: undefined,
				wholesalePriceUsd: undefined,
			},
		]);

		const request = fetchCall(fetchMock, 0);
		const headers = new Headers(request.init.headers);

		expect(request.url).toBe(
			`${SANDBOX_BASE_URL}/core/v1/domains:checkAvailability`,
		);
		expect(request.init.method).toBe("POST");
		expect(headers.get("Authorization")).toBe(
			`Basic ${Buffer.from(`${SANDBOX_USERNAME}:${SANDBOX_TOKEN}`).toString(
				"base64",
			)}`,
		);
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(jsonBody(request.init)).toEqual({
			domainNames: ["First.COM", "second.com"],
			purchaseType: "registration",
		});
	});

	it("sends the caller's stable idempotency key and disables registrar autorenew", async () => {
		fetchMock.mockImplementation(async () =>
			jsonResponse({
				domain: {
					domainName: "Example.COM",
					expireDate: "2027-07-24T00:00:00Z",
					transferLockExpiresAt: "2026-09-22T00:00:00Z",
				},
				order: 123,
				totalPaid: 12.99,
			}),
		);
		const provider = new NamecomProvider();
		const options = {
			idempotencyKey: "domain-order-123",
			privacy: true,
			years: 1,
		};

		const first = await provider.register("example.com", registrant, options);
		const replay = await provider.register("example.com", registrant, options);

		expect(first).toEqual({
			expiresAt: new Date("2027-07-24T00:00:00Z"),
			providerDomainId: "example.com",
			providerOrderId: "123",
			totalPaidUsd: 12.99,
			transferLockExpiresAt: new Date("2026-09-22T00:00:00Z"),
		});
		expect(replay).toEqual(first);

		const expectedContact = {
			address1: "12 Rue Didouche Mourad",
			city: "Algiers",
			country: "DZ",
			email: "zack@example.com",
			firstName: "Zack",
			lastName: "Belaid",
			phone: "+213555123456",
			state: "Alger",
			zip: "16000",
		};

		for (const index of [0, 1]) {
			const request = fetchCall(fetchMock, index);
			const headers = new Headers(request.init.headers);

			expect(request.url).toBe(`${SANDBOX_BASE_URL}/core/v1/domains`);
			expect(request.init.method).toBe("POST");
			expect(headers.get("X-Idempotency-Key")).toBe("domain-order-123");
			expect(jsonBody(request.init)).toEqual({
				domain: {
					autorenewEnabled: false,
					contacts: {
						admin: expectedContact,
						billing: expectedContact,
						registrant: expectedContact,
						tech: expectedContact,
					},
					domainName: "example.com",
					locked: true,
					privacyEnabled: true,
				},
				purchaseType: "registration",
				years: 1,
			});
		}
	});

	it("includes companyName in contacts only when the registrant supplies it", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				domain: {
					domainName: "example.com",
				},
			}),
		);
		const provider = new NamecomProvider();

		await provider.register(
			"example.com",
			{ ...registrant, companyName: "Wandit Inc." },
			{
				idempotencyKey: "domain-order-company",
				privacy: true,
				years: 1,
			},
		);

		const body = jsonBody(fetchCall(fetchMock, 0).init);
		const domain = body.domain as Record<string, unknown>;
		const contacts = domain.contacts as Record<string, Record<string, unknown>>;

		expect(contacts.admin?.companyName).toBe("Wandit Inc.");
		expect(contacts.billing?.companyName).toBe("Wandit Inc.");
		expect(contacts.registrant?.companyName).toBe("Wandit Inc.");
		expect(contacts.tech?.companyName).toBe("Wandit Inc.");
	});

	it("returns null when domain lookup receives 404", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
		const provider = new NamecomProvider();

		await expect(provider.getDomainInfo("missing.com")).resolves.toBeNull();

		const request = fetchCall(fetchMock, 0);
		expect(request.url).toBe(`${SANDBOX_BASE_URL}/core/v1/domains/missing.com`);
		expect(request.init.method).toBe("GET");
	});

	it.each([
		[429, true],
		[500, true],
		[502, true],
		[504, true],
		[400, false],
		[401, false],
		[409, false],
		[422, false],
	] as const)("maps upstream status %i to retryable=%s", async (status, retryable) => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ message: "Registrar rejected request" }, status),
		);
		const provider = new NamecomProvider();

		await expect(
			provider.checkAvailability(["example.com"]),
		).rejects.toMatchObject({
			retryable,
			upstreamStatus: status,
		} satisfies Partial<DomainProviderError>);
	});

	it("treats network failures as retryable provider errors", async () => {
		fetchMock.mockRejectedValueOnce(new Error("socket closed"));
		const provider = new NamecomProvider();

		await expect(
			provider.checkAvailability(["example.com"]),
		).rejects.toMatchObject({
			retryable: true,
			upstreamStatus: undefined,
		} satisfies Partial<DomainProviderError>);
	});

	it("reconciles managed DNS records without modifying unrelated records", async () => {
		fetchMock.mockImplementation(async (_input, init) => {
			if (init?.method === "GET") {
				return jsonResponse({
					records: [
						{
							answer: "mail.example.net",
							host: "",
							id: 10,
							priority: 10,
							ttl: 3600,
							type: "MX",
						},
						{
							answer: "old-origin.example.net",
							host: "www",
							id: 11,
							ttl: 300,
							type: "CNAME",
						},
						{
							answer: "customer-verification-token",
							host: "_verification",
							id: 12,
							ttl: 300,
							type: "TXT",
						},
					],
				});
			}

			return jsonResponse({});
		});
		const provider = new NamecomProvider();

		await provider.setDnsRecords("example.com", [
			{
				name: "www.example.com",
				type: "CNAME",
				value: "customers.wandit.app",
			},
			{
				name: "example.com",
				type: "A",
				value: "192.0.2.10",
			},
		]);

		const requests = fetchMock.mock.calls.map((_, index) =>
			fetchCall(fetchMock, index),
		);

		expect(requests.map(({ init, url }) => [init.method, url])).toEqual([
			[
				"GET",
				`${SANDBOX_BASE_URL}/core/v1/domains/example.com/records?perPage=1000`,
			],
			["PUT", `${SANDBOX_BASE_URL}/core/v1/domains/example.com/records/11`],
			["POST", `${SANDBOX_BASE_URL}/core/v1/domains/example.com/records`],
		]);
		expect(jsonBody(requests[1]?.init ?? {})).toEqual({
			answer: "customers.wandit.app",
			host: "www",
			ttl: 300,
			type: "CNAME",
		});
		expect(jsonBody(requests[2]?.init ?? {})).toEqual({
			answer: "192.0.2.10",
			host: "",
			ttl: 300,
			type: "A",
		});
		expect(requests.every(({ init }) => init.method !== "DELETE")).toBe(true);
		expect(requests.some(({ url }) => url.endsWith("/records/10"))).toBe(false);
		expect(requests.some(({ url }) => url.endsWith("/records/12"))).toBe(false);
	});

	it("creates the apex forwarding with an empty host when none exists", async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ urlForwarding: [] }))
			.mockResolvedValueOnce(jsonResponse({}));
		const provider = new NamecomProvider();

		await provider.setUrlForwarding("example.com", "https://www.example.com");

		const createRequest = fetchCall(fetchMock, 1);

		expect(createRequest.url).toBe(
			`${SANDBOX_BASE_URL}/core/v1/domains/example.com/url/forwarding`,
		);
		expect(createRequest.init.method).toBe("POST");
		expect(jsonBody(createRequest.init)).toEqual({
			forwardsTo: "https://www.example.com",
			host: "",
			type: "redirect",
		});
	});

	it.each([
		["an @ host", { host: "@" }],
		["a full-domain host", { host: "example.com" }],
		["a missing host", {}],
	])("recognizes an apex forwarding entry with %s and does not duplicate it", async (_label, hostField) => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({
				urlForwarding: [
					{
						forwardsTo: "https://www.example.com",
						id: 7,
						type: "redirect",
						...hostField,
					},
				],
			}),
		);
		const provider = new NamecomProvider();

		await provider.setUrlForwarding("example.com", "https://www.example.com");

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("updates an empty-host apex forwarding entry with a complete PATCH body", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					urlForwarding: [
						{
							forwardsTo: "https://old.example.com",
							host: "",
							id: 42,
							type: "masked",
						},
					],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({}));
		const provider = new NamecomProvider();

		await provider.setUrlForwarding("example.com", "https://www.example.com");

		const listRequest = fetchCall(fetchMock, 0);
		const updateRequest = fetchCall(fetchMock, 1);

		expect(listRequest.url).toBe(
			`${SANDBOX_BASE_URL}/core/v1/urlforwarding/example.com?perPage=1000`,
		);
		expect(listRequest.init.method).toBe("GET");
		expect(updateRequest.url).toBe(
			`${SANDBOX_BASE_URL}/core/v1/urlforwarding/example.com/42`,
		);
		expect(updateRequest.init.method).toBe("PATCH");
		expect(jsonBody(updateRequest.init)).toEqual({
			forwardsTo: "https://www.example.com",
			host: "",
			type: "redirect",
		});
	});
});
