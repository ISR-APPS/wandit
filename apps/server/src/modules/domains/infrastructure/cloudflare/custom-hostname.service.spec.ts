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
