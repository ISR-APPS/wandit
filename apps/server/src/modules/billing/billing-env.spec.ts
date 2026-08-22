import { refineServerEnv } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";

describe("server env billing guard", () => {
	it("rejects GENERATION_BILLING_MODE=off in production only", () => {
		const production = { addIssue: vi.fn() };
		refineServerEnv(
			{ GENERATION_BILLING_MODE: "off", NODE_ENV: "production" },
			production,
		);
		expect(production.addIssue).toHaveBeenCalledWith(
			expect.objectContaining({
				message:
					"GENERATION_BILLING_MODE=off is not allowed when NODE_ENV=production",
				path: ["GENERATION_BILLING_MODE"],
			}),
		);

		const development = { addIssue: vi.fn() };
		refineServerEnv(
			{ GENERATION_BILLING_MODE: "off", NODE_ENV: "development" },
			development,
		);
		refineServerEnv(
			{ GENERATION_BILLING_MODE: "enforce", NODE_ENV: "production" },
			development,
		);
		expect(development.addIssue).not.toHaveBeenCalled();
	});
});
