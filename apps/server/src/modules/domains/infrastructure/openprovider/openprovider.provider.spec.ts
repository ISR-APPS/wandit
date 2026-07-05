import { describe, expect, it, vi } from "vitest";

import { DomainProviderError } from "../../domain/errors/domain.errors";
import { OpenproviderProvider } from "./openprovider.provider";

describe("OpenproviderProvider", () => {
	it("correlates availability responses by returned domain name before falling back to index", async () => {
		const provider = new OpenproviderProvider();
		(provider as unknown as { request: () => Promise<unknown> }).request =
			vi.fn(async () => ({
				results: [
					{
						available: false,
						domain: { extension: "com", name: "second" },
						price: 8,
					},
					{
						domain: "first.com",
						is_available: true,
						is_premium: true,
						price_usd: 900,
					},
				],
			}));

		const results = await provider.checkAvailability([
			"first.com",
			"second.com",
		]);

		expect(results).toEqual([
			{
				available: true,
				name: "first.com",
				premium: true,
				wholesalePriceUsd: 900,
			},
			{
				available: false,
				name: "second.com",
				premium: false,
				wholesalePriceUsd: 8,
			},
		]);
	});

	it("treats HTTP 200 envelopes with non-zero Openprovider codes as failures", async () => {
		const provider = new OpenproviderProvider();
		(
			provider as unknown as {
				fetchWithToken: () => Promise<Response>;
			}
		).fetchWithToken = vi.fn(async () =>
			Response.json(
				{
					code: 350,
					data: {},
					desc: "logical failure",
				},
				{ status: 200 },
			),
		);

		await expect(
			(
				provider as unknown as {
					request: (
						method: "GET" | "POST" | "PUT",
						path: string,
					) => Promise<unknown>;
				}
			).request("PUT", "/v1beta/dns/zones/example.com/records"),
		).rejects.toBeInstanceOf(DomainProviderError);
	});
});
