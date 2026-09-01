import { afterEach, describe, expect, it, vi } from "vitest";

import {
	type ExternalDomainDelegationReminderCandidate,
	type ExternalDomainDelegationReminderEmailSender,
	type ExternalDomainDelegationReminderStore,
	ExternalDomainDelegationRemindersService,
	type ExternalDomainDelegationReminderZoneStatusReader,
} from "./external-domain-delegation-reminders.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2027-01-31T12:00:00.000Z");

function candidate(
	id: string,
	overrides: Partial<ExternalDomainDelegationReminderCandidate> = {},
): ExternalDomainDelegationReminderCandidate {
	return {
		createdAt: new Date(NOW.getTime() - 15 * DAY_MS),
		dns: {
			apexConfigured: true,
			zoneActive: false,
			zoneId: `zone_${id}`,
			zoneNameServers: ["Ada.NS.Cloudflare.com", "Bob.NS.Cloudflare.com"],
		},
		externalDelegationReminderSentAt: null,
		id,
		name: `${id}.example`,
		projectId: "project_1",
		source: "external",
		userId: `user_${id}`,
		...overrides,
	};
}

function setup(
	input: {
		batchSize?: number;
		candidates?: readonly ExternalDomainDelegationReminderCandidate[];
		findOwnerEmail?: (userId: string) => Promise<string | null>;
		getZoneStatus?: (id: string) => Promise<string | null>;
		markReminder?: (id: string) => Promise<boolean>;
		mergeDns?: ExternalDomainDelegationReminderStore["mergeDnsIfStatus"];
		resolveNameservers?: (name: string) => Promise<readonly string[]>;
		sendReminder?: ExternalDomainDelegationReminderEmailSender["sendExternalDomainDelegationReminder"];
	} = {},
) {
	const candidates = input.candidates ?? [];
	const store = {
		findExternalDelegationReminderCandidates: vi.fn(async () => candidates),
		findOwnerEmail: vi.fn(
			input.findOwnerEmail ?? (async () => "owner@example.com"),
		),
		markExternalDelegationReminderSent: vi.fn(
			input.markReminder ?? (async () => true),
		),
		mergeDnsIfStatus: vi.fn(
			input.mergeDns ?? (async () => ({ id: "persisted" })),
		),
	} satisfies ExternalDomainDelegationReminderStore;
	const email = {
		sendExternalDomainDelegationReminder: vi.fn(
			input.sendReminder ?? (async () => undefined),
		),
	} satisfies ExternalDomainDelegationReminderEmailSender;
	const customerZones = {
		getZoneStatus: vi.fn(input.getZoneStatus ?? (async () => "pending")),
	} satisfies ExternalDomainDelegationReminderZoneStatusReader;
	const logger = { warn: vi.fn() };
	const resolveNameservers = vi.fn(
		input.resolveNameservers ??
			(async () => ["old-ns1.registrar.example", "old-ns2.registrar.example"]),
	);

	return {
		customerZones,
		email,
		logger,
		resolveNameservers,
		service: new ExternalDomainDelegationRemindersService(
			store,
			email,
			customerZones,
			{
				batchSize: input.batchSize ?? 25,
				dashboardOrigin: "https://app.wandit.test",
				logger,
				resolveNameservers,
			},
		),
		store,
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe("ExternalDomainDelegationRemindersService", () => {
	it("uses nameserver exposure age, falls back to createdAt, and skips incomplete or pre-zone rows", async () => {
		const eligible = candidate("eligible");
		const cutoff = new Date(NOW.getTime() - 14 * DAY_MS);
		const { customerZones, email, resolveNameservers, service, store } = setup({
			candidates: [
				eligible,
				candidate("purchased", { source: "purchased" }),
				candidate("already_active", {
					dns: {
						apexConfigured: true,
						zoneActive: true,
						zoneId: "zone_active",
						zoneNameServers: ["ada.ns.cloudflare.com"],
					},
				}),
				candidate("missing_zone", {
					dns: {
						apexConfigured: true,
						zoneNameServers: ["ada.ns.cloudflare.com"],
						zoneNameserversExposedAt: new Date(
							NOW.getTime() - 15 * DAY_MS,
						).toISOString(),
					},
				}),
				candidate("freshly_unlocked", {
					dns: {
						apexConfigured: true,
						zoneActive: false,
						zoneId: "zone_freshly_unlocked",
						zoneNameServers: ["ada.ns.cloudflare.com"],
						zoneNameserversExposedAt: new Date(
							NOW.getTime() - DAY_MS,
						).toISOString(),
					},
				}),
				candidate("already_sent", {
					externalDelegationReminderSentAt: new Date(
						"2027-01-20T00:00:00.000Z",
					),
				}),
				candidate("exactly_fourteen_days", { createdAt: cutoff }),
				candidate("incomplete_zone", {
					dns: {
						zoneActive: false,
						zoneId: "zone_incomplete",
						zoneNameServers: ["ada.ns.cloudflare.com"],
					},
				}),
				candidate("missing_nameservers", {
					dns: {
						apexConfigured: true,
						zoneActive: false,
						zoneId: "zone_without_nameservers",
					},
				}),
			],
		});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 1,
		});
		expect(store.findExternalDelegationReminderCandidates).toHaveBeenCalledWith(
			{
				createdBefore: cutoff,
				limit: 25,
			},
		);
		expect(customerZones.getZoneStatus).toHaveBeenCalledExactlyOnceWith(
			`zone_${eligible.id}`,
		);
		expect(resolveNameservers).toHaveBeenCalledExactlyOnceWith(eligible.name);
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledOnce();
		expect(
			store.markExternalDelegationReminderSent,
		).toHaveBeenCalledExactlyOnceWith(eligible.id);
	});

	it("paginates past skipped rows so they cannot starve later candidates", async () => {
		const first = candidate("first", {
			createdAt: new Date("2026-12-01T00:00:00.000Z"),
		});
		const inconclusive = candidate("inconclusive", {
			createdAt: new Date("2026-12-02T00:00:00.000Z"),
		});
		const later = candidate("later", {
			createdAt: new Date("2026-12-03T00:00:00.000Z"),
		});
		const { email, service, store } = setup({
			batchSize: 2,
			resolveNameservers: async (name) => {
				if (name === first.name) {
					return ["bob.ns.cloudflare.com.", "ada.ns.cloudflare.com."];
				}

				if (name === inconclusive.name) {
					throw new Error("SERVFAIL");
				}

				return ["old-ns1.registrar.example", "old-ns2.registrar.example"];
			},
		});
		store.findExternalDelegationReminderCandidates
			.mockResolvedValueOnce([first, inconclusive])
			.mockResolvedValueOnce([later]);

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 1,
		});
		expect(
			store.findExternalDelegationReminderCandidates,
		).toHaveBeenNthCalledWith(2, {
			after: { createdAt: inconclusive.createdAt, id: inconclusive.id },
			createdBefore: new Date(NOW.getTime() - 14 * DAY_MS),
			limit: 2,
		});
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledOnce();
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledWith(
			expect.objectContaining({ domainId: later.id }),
		);
	});

	it("skips a domain whose live nameservers match after DNS normalization", async () => {
		const delegated = candidate("delegated");
		const { email, service, store } = setup({
			candidates: [delegated],
			resolveNameservers: async () => [
				"bob.ns.cloudflare.com.",
				"ADA.NS.CLOUDFLARE.COM.",
			],
		});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		expect(email.sendExternalDomainDelegationReminder).not.toHaveBeenCalled();
		expect(store.findOwnerEmail).not.toHaveBeenCalled();
		expect(store.markExternalDelegationReminderSent).not.toHaveBeenCalled();
	});

	it("skips and logs a candidate whose Cloudflare zone no longer exists", async () => {
		const stale = candidate("deleted_zone");
		const { customerZones, email, logger, resolveNameservers, service, store } =
			setup({
				candidates: [stale],
				getZoneStatus: async () => null,
			});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		expect(customerZones.getZoneStatus).toHaveBeenCalledExactlyOnceWith(
			"zone_deleted_zone",
		);
		expect(logger.warn).toHaveBeenCalledWith(
			`External domain delegation reminder skipped for ${stale.id}`,
			"Cloudflare zone zone_deleted_zone no longer exists",
		);
		expect(resolveNameservers).not.toHaveBeenCalled();
		expect(email.sendExternalDomainDelegationReminder).not.toHaveBeenCalled();
		expect(store.markExternalDelegationReminderSent).not.toHaveBeenCalled();
	});

	it("persists a remotely active zone so later sweeps stop selecting it", async () => {
		const active = candidate("remotely_active");
		let zoneActivePersisted = false;
		const { customerZones, email, resolveNameservers, service, store } = setup({
			candidates: [active],
			getZoneStatus: async () => "active",
			mergeDns: async () => {
				zoneActivePersisted = true;

				return active;
			},
		});
		store.findExternalDelegationReminderCandidates.mockImplementation(
			async () => (zoneActivePersisted ? [] : [active]),
		);

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		expect(customerZones.getZoneStatus).toHaveBeenCalledOnce();
		expect(store.mergeDnsIfStatus).toHaveBeenCalledExactlyOnceWith(
			active.id,
			["configuring", "active"],
			{ zoneActive: true },
		);
		expect(resolveNameservers).not.toHaveBeenCalled();
		expect(email.sendExternalDomainDelegationReminder).not.toHaveBeenCalled();
		expect(store.markExternalDelegationReminderSent).not.toHaveBeenCalled();
	});

	it("skips this sweep when the remote zone lookup fails", async () => {
		const lookupFailure = new Error("Cloudflare unavailable");
		const pending = candidate("zone_lookup_failure");
		const { email, logger, resolveNameservers, service, store } = setup({
			candidates: [pending],
			getZoneStatus: async () => {
				throw lookupFailure;
			},
		});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		expect(logger.warn).toHaveBeenCalledWith(
			`External domain delegation reminder zone lookup failed for ${pending.id}`,
			lookupFailure.message,
		);
		expect(resolveNameservers).not.toHaveBeenCalled();
		expect(email.sendExternalDomainDelegationReminder).not.toHaveBeenCalled();
		expect(store.markExternalDelegationReminderSent).not.toHaveBeenCalled();
	});

	it("emails the canonical owner and marks a conclusive nameserver mismatch", async () => {
		const pending = candidate("pending");
		const { email, service, store } = setup({ candidates: [pending] });

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 1,
		});
		expect(store.findOwnerEmail).toHaveBeenCalledExactlyOnceWith(
			pending.userId,
		);
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledWith({
			dashboardUrl: "https://app.wandit.test/p/project_1?tab=settings",
			domainId: pending.id,
			domainName: pending.name,
			idempotencyKey: `external-domain-delegation-reminder:${pending.id}`,
			nameServers: ["Ada.NS.Cloudflare.com", "Bob.NS.Cloudflare.com"],
			to: "owner@example.com",
		});
		expect(
			email.sendExternalDomainDelegationReminder.mock.invocationCallOrder[0],
		).toBeLessThan(
			store.markExternalDelegationReminderSent.mock.invocationCallOrder[0] ?? 0,
		);
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledWith(
			pending.id,
		);
	});

	it("skips inconclusive DNS failures and empty resolver answers", async () => {
		const failedLookup = candidate("dns_failure");
		const emptyLookup = candidate("dns_empty");
		const { email, service, store } = setup({
			candidates: [failedLookup, emptyLookup],
			resolveNameservers: async (name) => {
				if (name === failedLookup.name) {
					throw new Error("SERVFAIL");
				}

				return [];
			},
		});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		expect(email.sendExternalDomainDelegationReminder).not.toHaveBeenCalled();
		expect(store.markExternalDelegationReminderSent).not.toHaveBeenCalled();
	});

	it("treats a three-second DNS timeout as inconclusive", async () => {
		vi.useFakeTimers();
		const { email, service, store } = setup({
			candidates: [candidate("dns_timeout")],
			resolveNameservers: () => new Promise(() => undefined),
		});
		const execution = service.execute(NOW);

		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(3_000);

		await expect(execution).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 0,
		});
		expect(email.sendExternalDomainDelegationReminder).not.toHaveBeenCalled();
		expect(store.markExternalDelegationReminderSent).not.toHaveBeenCalled();
	});

	it("leaves an email failure unmarked, logs it, and continues the batch", async () => {
		const broken = candidate("broken");
		const healthy = candidate("healthy");
		const { email, logger, service, store } = setup({
			candidates: [broken, healthy],
			sendReminder: async (input) => {
				if (input.domainId === broken.id) {
					throw new Error("Resend unavailable");
				}
			},
		});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 1,
			processed: true,
			reminded: 1,
		});
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledTimes(2);
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledOnce();
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledWith(
			healthy.id,
		);
		expect(logger.warn).toHaveBeenCalledWith(
			`External domain delegation reminder failed for ${broken.id}`,
			"Resend unavailable",
		);
	});

	it("uses the persisted CAS marker to keep a later sweep from sending again", async () => {
		const pending = candidate("once");
		let reminderSent = false;
		const { email, service, store } = setup({
			candidates: [pending],
			markReminder: async () => {
				if (reminderSent) {
					return false;
				}

				reminderSent = true;
				return true;
			},
		});
		store.findExternalDelegationReminderCandidates.mockImplementation(
			async () => (reminderSent ? [] : [pending]),
		);

		await expect(service.execute(NOW)).resolves.toMatchObject({ reminded: 1 });
		await expect(service.execute(NOW)).resolves.toMatchObject({ reminded: 0 });

		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledOnce();
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledOnce();
	});

	it("retries thrown and false post-send CAS attempts until the row is marked", async () => {
		const pending = candidate("cas_retry");
		let markAttempts = 0;
		const { email, service, store } = setup({
			candidates: [pending],
			markReminder: async () => {
				markAttempts += 1;

				if (markAttempts === 1) {
					throw new Error("database connection reset");
				}

				return markAttempts > 2;
			},
		});

		await expect(service.execute(NOW)).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 1,
		});
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledOnce();
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledTimes(3);
	});

	it("processes later rows before rejecting a permanently failed post-send CAS", async () => {
		const broken = candidate("cas_broken");
		const healthy = candidate("cas_healthy");
		const { email, logger, service, store } = setup({
			candidates: [broken, healthy],
			markReminder: async (id) => {
				return id !== broken.id;
			},
		});

		await expect(service.execute(NOW)).rejects.toThrow(
			`External domain delegation reminder CAS did not mark ${broken.id}`,
		);
		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledTimes(2);
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledTimes(4);
		expect(store.markExternalDelegationReminderSent).toHaveBeenLastCalledWith(
			healthy.id,
		);
		expect(logger.warn).toHaveBeenCalledWith(
			`External domain delegation reminder mark failed for ${broken.id}`,
			`External domain delegation reminder CAS did not mark ${broken.id}`,
		);
	});

	it("reuses the same email idempotency key when Trigger reruns after a CAS failure", async () => {
		const pending = candidate("cas_rerun");
		let markAttempts = 0;
		const { email, service, store } = setup({
			candidates: [pending],
			markReminder: async () => {
				markAttempts += 1;

				return markAttempts > 3;
			},
		});

		await expect(service.execute(NOW)).rejects.toThrow(
			`External domain delegation reminder CAS did not mark ${pending.id}`,
		);
		await expect(
			service.execute(new Date(NOW.getTime() + 60_000)),
		).resolves.toEqual({
			failed: 0,
			processed: true,
			reminded: 1,
		});

		expect(email.sendExternalDomainDelegationReminder).toHaveBeenCalledTimes(2);
		const firstInput =
			email.sendExternalDomainDelegationReminder.mock.calls[0]?.[0];
		const retryInput =
			email.sendExternalDomainDelegationReminder.mock.calls[1]?.[0];
		expect(firstInput?.idempotencyKey).toBe(
			`external-domain-delegation-reminder:${pending.id}`,
		);
		expect(retryInput?.idempotencyKey).toBe(firstInput?.idempotencyKey);
		expect(store.markExternalDelegationReminderSent).toHaveBeenCalledTimes(4);
	});
});
