import { describe, expect, it, vi } from "vitest";

import { DomainProviderError } from "../../domain/errors/domain.errors";
import { CustomHostnameService } from "./custom-hostname.service";

describe("CustomHostnameService", () => {
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

	it("creates the apex hostname with the bare name while www stays canonical", async () => {
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
		await service.createCustomHostname("example.com");

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
			{ hostname: "www.example.com", ssl: { method: "http", type: "dv" } },
		]);
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
