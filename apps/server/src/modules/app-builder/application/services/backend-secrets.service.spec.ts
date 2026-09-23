import { describe, expect, it } from "vitest";

import type { BackendRef } from "../../infrastructure/supabase/supabase-management.client";
import { BackendSecretsService } from "./backend-secrets.service";

const BACKEND: BackendRef = {
	projectId: "project-1",
	ref: "abcdefghijklmnopqrst",
};
const NOW = new Date("2026-09-23T10:15:00.000Z");
// The clock after the read; a stamp with this time came too late.
const AFTER_READ = new Date("2026-09-23T10:15:05.000Z");

function setup(options: { stored: string | null; failPush?: boolean }) {
	const pushes: { name: string; value: string }[][] = [];
	const syncs: { projectId: string; name: string; at: Date }[] = [];
	// The read moves the clock, so a stamp time taken after it shows.
	let clock = NOW;
	const service = new BackendSecretsService({
		client: {
			bulkCreateSecrets: async (_backend, secrets) => {
				if (options.failPush === true) {
					throw new Error("upstream down");
				}
				pushes.push(secrets);
			},
		},
		now: () => clock,
		secrets: {
			readValue: async () => {
				clock = AFTER_READ;
				return options.stored;
			},
		},
		secretsRepo: {
			markSynced: async (projectId, name, at) => {
				syncs.push({ at, name, projectId });
			},
		},
	});
	return { pushes, service, syncs };
}

describe("BackendSecretsService.push", () => {
	it("sends the stored value once and stamps it with the time before the read", async () => {
		const { pushes, service, syncs } = setup({ stored: "sk_test_1" });

		expect(await service.push(BACKEND, "STRIPE_SECRET_KEY")).toBe("synced");
		expect(pushes).toEqual([
			[{ name: "STRIPE_SECRET_KEY", value: "sk_test_1" }],
		]);
		expect(syncs).toEqual([
			{ at: NOW, name: "STRIPE_SECRET_KEY", projectId: "project-1" },
		]);
	});

	it("answers missing and sends nothing without a stored value", async () => {
		const { pushes, service, syncs } = setup({ stored: null });

		expect(await service.push(BACKEND, "STRIPE_SECRET_KEY")).toBe("missing");
		expect(pushes).toEqual([]);
		expect(syncs).toEqual([]);
	});

	it("does not stamp the row when the push fails", async () => {
		const { service, syncs } = setup({ failPush: true, stored: "sk_test_1" });

		await expect(service.push(BACKEND, "STRIPE_SECRET_KEY")).rejects.toThrow(
			"upstream down",
		);
		expect(syncs).toEqual([]);
	});
});
