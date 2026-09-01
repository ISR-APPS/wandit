import { describe, expect, it, vi } from "vitest";

import { CustomHostnameVerificationStep } from "./custom-hostname-verification.step";

describe("CustomHostnameVerificationStep", () => {
	it("normalizes the exact active status to active with one probe", async () => {
		const provider = {
			getCustomHostnameStatus: vi.fn(async () => ({
				hostnameStatus: "active",
				sslStatus: "active",
			})),
		};
		const step = new CustomHostnameVerificationStep(provider);

		await expect(step.execute("cf_active")).resolves.toEqual({
			hostnameStatus: "active",
			sslStatus: "active",
			status: "active",
		});
		expect(provider.getCustomHostnameStatus).toHaveBeenCalledOnce();
		expect(provider.getCustomHostnameStatus).toHaveBeenCalledWith("cf_active");
	});

	it.each([
		["pending", "pending_validation"],
		["blocked", "active"],
		["", "active"],
		["ACTIVE", "active"],
		["active", "pending_validation"],
	] as const)("normalizes hostname %j and SSL %j to pending while preserving both", async (hostnameStatus, sslStatus) => {
		const provider = {
			getCustomHostnameStatus: vi.fn(async () => ({
				hostnameStatus,
				sslStatus,
			})),
		};
		const step = new CustomHostnameVerificationStep(provider);

		await expect(step.execute("cf_pending")).resolves.toEqual({
			hostnameStatus,
			sslStatus,
			status: "pending",
		});
		expect(provider.getCustomHostnameStatus).toHaveBeenCalledOnce();
	});

	it.each([
		new Error("Cloudflare timed out"),
		"network unavailable",
	])("returns a transient result for a thrown provider value", async (error) => {
		const provider = {
			getCustomHostnameStatus: vi.fn(async () => {
				throw error;
			}),
		};
		const step = new CustomHostnameVerificationStep(provider);

		await expect(step.execute("cf_transient")).resolves.toEqual({
			error,
			status: "transient",
		});
		expect(provider.getCustomHostnameStatus).toHaveBeenCalledOnce();
	});
});
