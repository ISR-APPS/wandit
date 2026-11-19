import { afterEach, describe, expect, it, vi } from "vitest";

import {
	CustomHostnameMissingError,
	DomainProviderError,
} from "../../domain/errors/domain.errors";
import { CustomHostnameService } from "./custom-hostname.service";

describe("CustomHostnameService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("keeps hostnames pending until SSL is active even when hostname validation is active", () => {
		const service = new CustomHostnameService();
		const status = (
			service as unknown as {
				statusFromResult: (result: Record<string, unknown>) => {
					hostnameStatus: string | null;
					sslStatus: string | null;
					status: string;
				};
			}
		).statusFromResult({
			ssl: { status: "pending_validation" },
			status: "active",
		});

		expect(status).toEqual({
			hostnameStatus: "active",
			sslStatus: "pending_validation",
			status: "pending_validation",
		});
	});

	it("makes no Cloudflare call on staging: create refuses and delete only logs", async () => {
		vi.stubEnv("SITES_SLUG_SUFFIX", "-stg");
		vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
		vi.stubEnv("CLOUDFLARE_ZONE_ID_WANDIT_APP", "zone_saas");
		const fetch = vi.spyOn(globalThis, "fetch");
		const service = new CustomHostnameService();

		await expect(
			service.findOrCreateCustomHostname("shop.com"),
		).rejects.toMatchObject({
			response: { code: "CUSTOM_DOMAINS_PRODUCTION_ONLY" },
		});
		await expect(
			service.deleteCustomHostname("cf_production"),
		).resolves.toBeUndefined();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("treats custom-hostname DELETE 404 as success", async () => {
		const service = new CustomHostnameService();
		(service as unknown as { requiredEnv: () => string }).requiredEnv = vi.fn(
			() => "configured",
		);
		(
			service as unknown as {
				fetchWithTimeout: () => Promise<Response>;
			}
		).fetchWithTimeout = vi.fn(async () => new Response(null, { status: 404 }));

		await expect(
			service.deleteCustomHostname("cf_deleted"),
		).resolves.toBeUndefined();
	});

	it.each([
		[
			"GET",
			(service: CustomHostnameService) =>
				service.getCustomHostnameStatus("cf_gone"),
		],
		[
			"PATCH",
			(service: CustomHostnameService) =>
				service.refreshCustomHostnameValidation("cf_gone"),
		],
	])("maps a %s 404 on a hostname id to CustomHostnameMissingError", async (_method, request) => {
		vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
		vi.stubEnv("CLOUDFLARE_ZONE_ID_WANDIT_APP", "zone_saas");
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			Response.json({ success: false }, { status: 404 }),
		);

		await expect(request(new CustomHostnameService())).rejects.toBeInstanceOf(
			CustomHostnameMissingError,
		);
	});

	it("creates the apex hostname with the bare name", async () => {
		const service = new CustomHostnameService();
		(service as unknown as { requiredEnv: () => string }).requiredEnv = vi.fn(
			() => "configured",
		);
		const fetchWithTimeout = vi.fn(async () =>
			Response.json({
				result: {
					id: "cf_apex",
					ownership_verification: {
						name: "_cf-custom-hostname.example.com",
						type: "txt",
						value: "apex-token",
					},
					ssl: { status: "pending_validation" },
					status: "pending",
				},
				success: true,
			}),
		);
		(
			service as unknown as {
				fetchWithTimeout: (url: string, init: RequestInit) => Promise<Response>;
			}
		).fetchWithTimeout = fetchWithTimeout;

		await expect(
			service.createApexCustomHostname("example.com"),
		).resolves.toEqual({
			hostnameStatus: "pending",
			id: "cf_apex",
			requiredRecords: [
				{
					name: "_cf-custom-hostname.example.com",
					type: "TXT",
					value: "apex-token",
				},
			],
			sslStatus: "pending_validation",
			status: "pending_validation",
		});

		const bodies = fetchWithTimeout.mock.calls.map(
			(call) =>
				JSON.parse(
					String((call as unknown as [string, RequestInit])[1].body),
				) as {
					hostname: string;
					ssl: { method: string; type: string };
				},
		);
		expect(bodies).toEqual([
			{ hostname: "example.com", ssl: { method: "http", type: "dv" } },
		]);
	});

	it.each([
		[
			"creates the www hostname when none exists",
			[],
			[
				["GET", null],
				[
					"POST",
					{ hostname: "www.example.com", ssl: { method: "http", type: "dv" } },
				],
			],
		],
		[
			"adopts an active www hostname as is",
			[
				{
					hostname: "www.example.com",
					id: "cf_www",
					ssl: { status: "active" },
					status: "active",
				},
			],
			[["GET", null]],
		],
		[
			"adopts a pending www hostname and restarts its validation",
			[
				{
					hostname: "www.example.com",
					id: "cf_www",
					ssl: { status: "pending_validation" },
					status: "pending",
				},
			],
			[
				["GET", null],
				["PATCH", { ssl: { method: "http", type: "dv" } }],
			],
		],
	])("%s", async (_label, found, expectedCalls) => {
		const service = new CustomHostnameService();
		const fetchWithTimeout = vi
			.fn<(url: string, init: RequestInit) => Promise<Response>>()
			.mockResolvedValueOnce(Response.json({ result: found, success: true }))
			.mockResolvedValueOnce(
				Response.json({
					result: { id: "cf_www", ssl: { status: "pending_validation" } },
					success: true,
				}),
			);
		// Replaces the private env read and network call: CI has no Cloudflare token.
		Object.assign(service, {
			fetchWithTimeout,
			requiredEnv: () => "configured",
		});

		await expect(
			service.findOrCreateCustomHostname("example.com"),
		).resolves.toMatchObject({ id: "cf_www" });

		expect(fetchWithTimeout.mock.calls[0]?.[0]).toMatch(
			/\/custom_hostnames\?hostname=www\.example\.com$/,
		);
		expect(
			fetchWithTimeout.mock.calls.map(([, init]) => [
				init.method,
				init.body ? JSON.parse(String(init.body)) : null,
			]),
		).toEqual(expectedCalls);
	});

	it("finds an existing hostname by exact name and returns null otherwise", async () => {
		const service = new CustomHostnameService();
		(service as unknown as { requiredEnv: () => string }).requiredEnv = vi.fn(
			() => "configured",
		);
		const fetchWithTimeout = vi
			.fn<(url: string, init: RequestInit) => Promise<Response>>()
			.mockResolvedValueOnce(
				Response.json({
					result: [
						{ hostname: "www.example.com", id: "cf_www", status: "active" },
						{
							hostname: "EXAMPLE.com",
							id: "cf_apex",
							ssl: { status: "active" },
							status: "active",
						},
					],
					success: true,
				}),
			)
			.mockResolvedValueOnce(Response.json({ result: [], success: true }));
		(
			service as unknown as {
				fetchWithTimeout: (url: string, init: RequestInit) => Promise<Response>;
			}
		).fetchWithTimeout = fetchWithTimeout;

		await expect(
			service.findCustomHostnameByName("example.com"),
		).resolves.toMatchObject({ id: "cf_apex", status: "active" });
		await expect(
			service.findCustomHostnameByName("example.com"),
		).resolves.toBeNull();

		expect(fetchWithTimeout.mock.calls[0]?.[0]).toMatch(
			/\/custom_hostnames\?hostname=example\.com$/,
		);
		expect(fetchWithTimeout.mock.calls[0]?.[1].method).toBe("GET");
	});

	it("re-sends the SSL settings with PATCH to nudge validation and maps the status", async () => {
		const service = new CustomHostnameService();
		(service as unknown as { requiredEnv: () => string }).requiredEnv = vi.fn(
			() => "configured",
		);
		const fetchWithTimeout = vi.fn(async () =>
			Response.json({
				result: {
					id: "cf_apex",
					ssl: { status: "active" },
					status: "active",
				},
				success: true,
			}),
		);
		(
			service as unknown as {
				fetchWithTimeout: (url: string, init: RequestInit) => Promise<Response>;
			}
		).fetchWithTimeout = fetchWithTimeout;

		await expect(
			service.refreshCustomHostnameValidation("cf_apex"),
		).resolves.toMatchObject({ id: "cf_apex", status: "active" });

		const [url, init] = fetchWithTimeout.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toMatch(/\/custom_hostnames\/cf_apex$/);
		expect(init.method).toBe("PATCH");
		expect(JSON.parse(String(init.body))).toEqual({
			ssl: { method: "http", type: "dv" },
		});
	});

	it("maps Cloudflare request timeouts to domain provider errors", async () => {
		const service = new CustomHostnameService();
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));

		await expect(
			(
				service as unknown as {
					fetchWithTimeout: (
						url: string,
						init: RequestInit,
					) => Promise<Response>;
				}
			).fetchWithTimeout("https://cloudflare.invalid", { method: "GET" }),
		).rejects.toBeInstanceOf(DomainProviderError);

		fetchSpy.mockRestore();
	});
});
