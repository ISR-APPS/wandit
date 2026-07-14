import { describe, expect, it, vi } from "vitest";

import { DomainProviderError } from "../../domain/errors/domain.errors";
import type { DomainsRepository } from "../persistence/domains.repository";
import { DomainRoutingService } from "./domain-routing.service";

describe("DomainRoutingService", () => {
	it("treats KV DELETE 404 as success so detach retries stay idempotent", async () => {
		const service = new DomainRoutingService({} as DomainsRepository);
		(service as unknown as { requiredEnv: () => string }).requiredEnv = vi.fn(
			() => "configured",
		);
		(
			service as unknown as {
				resolveAccountId: () => Promise<string>;
			}
		).resolveAccountId = vi.fn(async () => "account_1");
		(
			service as unknown as {
				fetchWithTimeout: () => Promise<Response>;
			}
		).fetchWithTimeout = vi.fn(async () => new Response(null, { status: 404 }));

		await expect(
			service.deleteDomainPointer("example.com"),
		).resolves.toBeUndefined();
	});

	it("maps Cloudflare KV timeouts to domain provider errors", async () => {
		const service = new DomainRoutingService({} as DomainsRepository);
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
