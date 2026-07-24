import { describe, expect, it } from "vitest";

import {
	DomainPaymentsNotConfiguredError,
	DomainsNotConfiguredError,
} from "./domain.errors";

describe("domain errors", () => {
	it("does not expose missing provider env-var names in not-configured responses", () => {
		const error = new DomainsNotConfiguredError("OPENPROVIDER_PASSWORD");

		expect(error.getResponse()).toEqual({
			code: "DOMAINS_NOT_CONFIGURED",
			message: "Custom domains are not configured",
		});
		expect(JSON.stringify(error.getResponse())).not.toContain(
			"OPENPROVIDER_PASSWORD",
		);
	});

	it("returns a stable public error while domain payments are disconnected", () => {
		const error = new DomainPaymentsNotConfiguredError();

		expect(error.getStatus()).toBe(503);
		expect(error.getResponse()).toEqual({
			code: "DOMAIN_PAYMENTS_NOT_CONFIGURED",
			message: "Domain checkout is not connected yet",
		});
	});
});
