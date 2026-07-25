import "reflect-metadata";
import { describe, expect, it } from "vitest";

import { DomainsController } from "./domains.controller";

const reflect = Reflect as typeof Reflect & {
	getMetadata: (metadataKey: string, target: unknown) => unknown;
};

describe("DomainsController rate limits", () => {
	it("rate-limits Cloudflare-mutating and registrar-touching domain routes", () => {
		expect(
			reflect.getMetadata(
				"domain_rate_limit",
				DomainsController.prototype.attachExternal,
			),
		).toEqual({
			limit: 5,
			windowMs: 60_000,
		});
		expect(
			reflect.getMetadata(
				"domain_rate_limit",
				DomainsController.prototype.transferUnlock,
			),
		).toEqual({
			limit: 3,
			windowMs: 60 * 60_000,
		});
	});

	it("no longer exposes the credits-era purchase and renew routes", () => {
		const prototype = DomainsController.prototype as unknown as Record<
			string,
			unknown
		>;

		expect(prototype.purchase).toBeUndefined();
		expect(prototype.renew).toBeUndefined();
	});
});
