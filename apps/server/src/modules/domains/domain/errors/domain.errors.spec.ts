import { describe, expect, it } from "vitest";

import { DomainsNotConfiguredError } from "./domain.errors";

describe("domain errors", () => {
	it("does not expose missing provider env-var names in not-configured responses", () => {
		const error = new DomainsNotConfiguredError("NAMECOM_API_TOKEN");

		expect(error.getResponse()).toEqual({
			code: "DOMAINS_NOT_CONFIGURED",
			message: "Custom domains are not configured",
		});
		expect(JSON.stringify(error.getResponse())).not.toContain(
			"NAMECOM_API_TOKEN",
		);
	});
});
