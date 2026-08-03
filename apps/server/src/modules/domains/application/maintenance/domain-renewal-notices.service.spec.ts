import { describe, expect, it, vi } from "vitest";

import {
	type DomainRenewalNoticeCandidate,
	DomainRenewalNoticesService,
	type DomainRenewalNoticesStore,
} from "./domain-renewal-notices.service";

const DAY_MS = 24 * 60 * 60 * 1000;

function candidate(
	id: string,
	expiresAt: Date | null,
	overrides: Partial<DomainRenewalNoticeCandidate> = {},
): DomainRenewalNoticeCandidate {
	return {
		expiresAt,
		id,
		source: "purchased",
		status: "active",
		...overrides,
	};
}

function setup(candidates: readonly DomainRenewalNoticeCandidate[]) {
	const store = {
		findExpiringPurchased: vi.fn(async () => candidates),
		recordRenewalNotice: vi.fn(async () => undefined),
	} satisfies DomainRenewalNoticesStore;

	return {
		service: new DomainRenewalNoticesService(store),
		store,
	};
}

describe("DomainRenewalNoticesService", () => {
	it("records T-30 notices and clamps expired domains to zero days", async () => {
		const now = new Date("2027-01-01T00:00:00.000Z");
		const due = candidate("domain_due", new Date(now.getTime() + 20 * DAY_MS));
		const expired = candidate(
			"domain_expired",
			new Date(now.getTime() - 2 * DAY_MS),
			{ status: "expired" },
		);
		const { service, store } = setup([due, expired]);

		await expect(service.execute(now)).resolves.toEqual({
			noticed: 2,
			processed: true,
		});
		expect(store.findExpiringPurchased).toHaveBeenCalledWith(now);
		expect(store.recordRenewalNotice).toHaveBeenNthCalledWith(
			1,
			due.id,
			"Domain expires in 20 day(s); automatic renewal is not available yet",
		);
		expect(store.recordRenewalNotice).toHaveBeenNthCalledWith(
			2,
			expired.id,
			"Domain expires in 0 day(s); automatic renewal is not available yet",
		);
	});

	it("defensively skips missing expiries and candidates outside the notice window", async () => {
		const now = new Date("2027-01-01T00:00:00.000Z");
		const { service, store } = setup([
			candidate("domain_missing_expiry", null),
			candidate("domain_too_early", new Date(now.getTime() + 30 * DAY_MS + 1)),
		]);

		await expect(service.execute(now)).resolves.toEqual({
			noticed: 0,
			processed: true,
		});
		expect(store.recordRenewalNotice).not.toHaveBeenCalled();
	});

	it("includes expiring domains when auto-renew was never enabled", async () => {
		const now = new Date("2027-01-01T00:00:00.000Z");
		const expiring = {
			autoRenew: false,
			...candidate(
				"domain_no_autorenew",
				new Date(now.getTime() + 10 * DAY_MS),
			),
		};
		const { service, store } = setup([expiring]);

		await expect(service.execute(now)).resolves.toEqual({
			noticed: 1,
			processed: true,
		});
		expect(store.recordRenewalNotice).toHaveBeenCalledWith(
			expiring.id,
			expect.stringContaining("expires in 10"),
		);
	});

	it("excludes failed and external domains from the notice scan", async () => {
		const now = new Date("2027-01-01T00:00:00.000Z");
		const expiresAt = new Date(now.getTime() + 10 * DAY_MS);
		const { service, store } = setup([
			candidate("domain_failed", expiresAt, { status: "failed" }),
			candidate("domain_external", expiresAt, { source: "external" }),
		]);

		await expect(service.execute(now)).resolves.toEqual({
			noticed: 0,
			processed: true,
		});
		expect(store.findExpiringPurchased).toHaveBeenCalledWith(now);
		expect(store.recordRenewalNotice).not.toHaveBeenCalled();
	});
});
