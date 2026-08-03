import { describe, expect, it, vi } from "vitest";

import {
	bestEffortDeleteCustomHostname,
	bestEffortDeleteDomainPointer,
} from "./domain-assets-cleanup";

function setup() {
	const dependencies = {
		deleteCustomHostname: vi.fn(async () => undefined),
		deleteDomainPointer: vi.fn(async () => undefined),
		logger: { error: vi.fn(), warn: vi.fn() },
	};
	const row = {
		cfCustomHostnameId: "cf_1",
		id: "11111111-1111-4111-8111-111111111111",
		name: "example.com",
		projectId: "22222222-2222-4222-8222-222222222222",
	};

	return { dependencies, row };
}

describe("domain asset cleanup", () => {
	it("deletes a custom hostname and project pointer", async () => {
		const { dependencies, row } = setup();

		await expect(
			bestEffortDeleteCustomHostname(row, dependencies),
		).resolves.toBe(true);
		await expect(
			bestEffortDeleteDomainPointer(row, dependencies),
		).resolves.toBeUndefined();
		expect(dependencies.deleteCustomHostname).toHaveBeenCalledWith("cf_1");
		expect(dependencies.deleteDomainPointer).toHaveBeenCalledWith(
			"example.com",
		);
	});

	it("skips assets absent from the row", async () => {
		const { dependencies, row } = setup();
		const withoutAssets = {
			...row,
			cfCustomHostnameId: null,
			projectId: null,
		};

		await expect(
			bestEffortDeleteCustomHostname(withoutAssets, dependencies),
		).resolves.toBe(false);
		await bestEffortDeleteDomainPointer(withoutAssets, dependencies);
		expect(dependencies.deleteCustomHostname).not.toHaveBeenCalled();
		expect(dependencies.deleteDomainPointer).not.toHaveBeenCalled();
	});

	it("logs provider failures without replacing the caller's outcome", async () => {
		const { dependencies, row } = setup();
		dependencies.deleteCustomHostname.mockRejectedValueOnce(
			new Error("hostname unavailable"),
		);
		dependencies.deleteDomainPointer.mockRejectedValueOnce(
			new Error("pointer unavailable"),
		);

		await expect(
			bestEffortDeleteCustomHostname(row, dependencies),
		).resolves.toBe(false);
		await expect(
			bestEffortDeleteDomainPointer(row, dependencies),
		).resolves.toBeUndefined();
		expect(dependencies.logger.warn).toHaveBeenNthCalledWith(
			1,
			"Failed to delete Cloudflare custom hostname for domain 11111111-1111-4111-8111-111111111111",
			"hostname unavailable",
		);
		expect(dependencies.logger.warn).toHaveBeenNthCalledWith(
			2,
			"Failed to delete domain routing pointer for 11111111-1111-4111-8111-111111111111",
			"pointer unavailable",
		);
	});
});
