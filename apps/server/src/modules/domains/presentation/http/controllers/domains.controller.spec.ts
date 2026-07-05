import "reflect-metadata";
import { describe, expect, it } from "vitest";

import { DomainsController } from "./domains.controller";

const reflect = Reflect as typeof Reflect & {
	getMetadata: (metadataKey: string, target: unknown) => unknown;
};

describe("DomainsController rate limits", () => {
	it("rate-limits money and Cloudflare-mutating domain routes", () => {
		expect(
			reflect.getMetadata(
				"domain_rate_limit",
				DomainsController.prototype.purchase,
			),
		).toEqual({
			limit: 5,
			windowMs: 60_000,
		});
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
				DomainsController.prototype.renew,
			),
		).toEqual({
			limit: 5,
			windowMs: 60_000,
		});
	});
});
