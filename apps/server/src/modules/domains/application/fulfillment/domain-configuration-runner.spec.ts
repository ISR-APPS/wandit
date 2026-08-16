import { describe, expect, it, vi } from "vitest";
import { DomainActivationTransientError } from "./domain-activation.step";
import {
	DomainConfigurationRunner,
	domainConfigurationDelaySeconds,
} from "./domain-configuration-runner";
import type {
	DomainConfigurationCursor,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import { buildDomainPurchaseNonce } from "./domain-fulfillment.contracts";
import { domainFailureSummary } from "./domain-fulfillment.errors";

const domainId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const purchaseNonce = buildDomainPurchaseNonce(orderId);

function domain(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_1",
		dns: null,
		error: null,
		expiresAt: null,
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: orderId,
		projectId: "33333333-3333-4333-8333-333333333333",
		provider: "namecom",
		providerDomainId: "example.com",
		providerOrderId: null,
		providerTotalPaidUsd: "8.00",
		registrant: null,
		source: "purchased",
		status: "configuring",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-08-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function setup(
	input: {
		cursor?: DomainConfigurationCursor | null;
		now?: Date;
		row?: DomainFulfillmentRow | null;
	} = {},
) {
	let now = input.now ?? new Date("2026-08-01T00:00:00.000Z");
	let row = input.row === undefined ? domain() : input.row;
	let cursor = input.cursor === undefined ? null : input.cursor;
	let loseNextAdvance = false;
	const waits: Date[] = [];
	const probes: string[] = [];
	const verificationResults: Array<
		{ status: "active" | "pending" } | { error: unknown; status: "transient" }
	> = [];
	const activationResults: Array<
		| Error
		| { processed: false; reason: "detached" | "state_changed" }
		| { processed: true; row: DomainFulfillmentRow; status: "active" }
	> = [];
	const terminalErrors: unknown[] = [];
	const initializeCursor = vi.fn(
		async (
			_id: string,
			options: { adoptExistingNonce: boolean; nonce: string },
		) => {
			if (
				cursor &&
				(options.adoptExistingNonce || cursor.nonce === options.nonce)
			) {
				return cursor;
			}

			cursor = { nextAttempt: 0, nextProbeAt: null, nonce: options.nonce };
			return cursor;
		},
	);
	const advanceCursor = vi.fn(
		async (
			_id: string,
			advance: {
				expectedAttempt: number;
				nextAttempt: number;
				nextProbeAt: Date;
				nonce: string;
			},
		) => {
			if (loseNextAdvance) {
				loseNextAdvance = false;
				return false;
			}

			if (
				!cursor ||
				row?.status !== "configuring" ||
				cursor.nonce !== advance.nonce ||
				cursor.nextAttempt !== advance.expectedAttempt
			) {
				return false;
			}

			cursor = {
				nextAttempt: advance.nextAttempt,
				nextProbeAt: advance.nextProbeAt,
				nonce: advance.nonce,
			};

			return true;
		},
	);
	const clearCursor = vi.fn(async (_id: string, nonce: string) => {
		if (!cursor || cursor.nonce !== nonce) {
			return false;
		}

		cursor = null;
		return true;
	});
	const markExternalVerificationStalled = vi.fn(
		async (
			_id: string,
			input: {
				attempts: number;
				expectedAttempt: number;
				nonce: string;
				stalledAt: Date;
			},
		) => {
			if (
				row?.source !== "external" ||
				row.status !== "configuring" ||
				!cursor ||
				cursor.nonce !== input.nonce ||
				cursor.nextAttempt !== input.expectedAttempt
			) {
				return false;
			}

			row = {
				...row,
				dns: {
					externalVerification: {
						attempts: input.attempts,
						stalledAt: input.stalledAt.toISOString(),
					},
				},
			};

			return true;
		},
	);
	const waitUntil = vi.fn(async ({ date }: { date: Date }) => {
		waits.push(date);
		now = date;
	});
	const terminalFailure = vi.fn(
		async (failedRow: DomainFulfillmentRow, error: unknown) => {
			terminalErrors.push(error);
			row = {
				...failedRow,
				error: domainFailureSummary(error),
				status: "failed",
			};
		},
	);
	const activation = vi.fn(async (activeRow: DomainFulfillmentRow) => {
		const result = activationResults.shift();

		if (result instanceof Error) {
			throw result;
		}

		if (result) {
			return result;
		}

		row = { ...activeRow, status: "active" };

		return {
			processed: true as const,
			row,
			status: "active" as const,
		};
	});
	const verification = vi.fn(async (id: string) => {
		probes.push(id);

		return verificationResults.shift() ?? { status: "pending" as const };
	});
	const runner = new DomainConfigurationRunner({
		activation: { execute: activation },
		cursors: {
			advanceCursor,
			clearCursor,
			findDomain: vi.fn(async () => row),
			initializeCursor,
			markExternalVerificationStalled,
			readCursor: vi.fn(async () => cursor),
		},
		now: () => now,
		terminalFailure: { execute: terminalFailure },
		verification: { execute: verification },
		wait: { until: waitUntil },
	});

	return {
		activation,
		activationResults,
		advanceCursor,
		clearCursor,
		get cursor() {
			return cursor;
		},
		initializeCursor,
		markExternalVerificationStalled,
		loseNextAdvance() {
			loseNextAdvance = true;
		},
		probes,
		runner,
		set row(value: DomainFulfillmentRow | null) {
			row = value;
		},
		terminalErrors,
		terminalFailure,
		verification,
		verificationResults,
		waitUntil,
		waits,
	};
}

describe("DomainConfigurationRunner", () => {
	it("uses the exact exponential delay series and 15-minute cap", () => {
		expect(
			Array.from({ length: 10 }, (_, attempt) =>
				domainConfigurationDelaySeconds(attempt),
			),
		).toEqual([30, 60, 120, 240, 480, 900, 900, 900, 900, 900]);
	});

	it("persists 100 windows before 101 probes and terminalizes a purchased timeout", async () => {
		const fixture = setup();

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).resolves.toEqual({
			processed: false,
			reason: "timed_out",
			terminalized: true,
		});

		expect(fixture.probes).toHaveLength(101);
		expect(fixture.waits).toHaveLength(100);
		expect(fixture.advanceCursor).toHaveBeenCalledTimes(100);
		const delays = fixture.advanceCursor.mock.calls.map((call, index) => {
			const next = call[1].nextProbeAt.getTime();
			const previous =
				index === 0
					? new Date("2026-08-01T00:00:00.000Z").getTime()
					: (fixture.waits[index - 1]?.getTime() ?? 0);

			return (next - previous) / 1000;
		});
		expect(delays.slice(0, 7)).toEqual([30, 60, 120, 240, 480, 900, 900]);
		expect(delays.reduce((total, delay) => total + delay, 0)).toBe(86_430);
		expect(fixture.terminalFailure).toHaveBeenCalledTimes(1);
		expect(fixture.markExternalVerificationStalled).not.toHaveBeenCalled();
		expect(domainFailureSummary(fixture.terminalErrors[0])).toBe(
			"Domain registration failed",
		);
		expect(fixture.cursor).toBeNull();
	});

	it("marks an exhausted external domain while leaving it pending", async () => {
		const fixture = setup({
			row: domain({ paymentOrderId: null, source: "external" }),
		});

		await expect(
			fixture.runner.execute({ domainId, nonce: "manual:1" }),
		).resolves.toEqual({
			processed: false,
			reason: "external_still_pending",
			terminalized: false,
		});

		expect(fixture.probes).toHaveLength(101);
		expect(fixture.waits).toHaveLength(100);
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
		expect(fixture.markExternalVerificationStalled).toHaveBeenCalledWith(
			domainId,
			{
				attempts: 101,
				expectedAttempt: 100,
				nonce: "manual:1",
				stalledAt: new Date("2026-08-02T00:00:30.000Z"),
			},
		);
		expect(fixture.cursor).toMatchObject({
			nextAttempt: 100,
			nonce: "manual:1",
		});
	});

	it("activates on an exact active probe and clears only its cursor", async () => {
		const fixture = setup();
		fixture.verificationResults.push({ status: "active" });

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).resolves.toEqual({
			processed: true,
			status: "active",
			terminalized: false,
		});

		expect(fixture.activation).toHaveBeenCalledTimes(1);
		expect(fixture.waitUntil).not.toHaveBeenCalled();
		expect(fixture.clearCursor).toHaveBeenCalledWith(domainId, purchaseNonce);
		expect(fixture.cursor).toBeNull();
	});

	it.each([
		{
			error: new Error("Cloudflare unavailable"),
			status: "transient" as const,
		},
		{ status: "pending" as const },
	])("advances and durably waits after $status verification", async (first) => {
		const fixture = setup();
		fixture.verificationResults.push(first, { status: "active" });

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).resolves.toEqual({
			processed: true,
			status: "active",
			terminalized: false,
		});

		expect(fixture.advanceCursor).toHaveBeenCalledBefore(fixture.waitUntil);
		expect(fixture.waits).toEqual([new Date("2026-08-01T00:00:30.000Z")]);
		expect(fixture.probes).toHaveLength(2);
	});

	it("uses the same persisted wait policy for a transient KV activation failure", async () => {
		const fixture = setup();
		fixture.verificationResults.push(
			{ status: "active" },
			{ status: "active" },
		);
		fixture.activationResults.push(
			new DomainActivationTransientError(new Error("KV unavailable")),
		);

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).resolves.toEqual({
			processed: true,
			status: "active",
			terminalized: false,
		});

		expect(fixture.activation).toHaveBeenCalledTimes(2);
		expect(fixture.waits).toEqual([new Date("2026-08-01T00:00:30.000Z")]);
	});

	it("propagates database or order-completion activation errors to task retry", async () => {
		const fixture = setup();
		const error = new Error("order completion unavailable");
		fixture.verificationResults.push({ status: "active" });
		fixture.activationResults.push(error);

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).rejects.toBe(error);

		expect(fixture.advanceCursor).not.toHaveBeenCalled();
		expect(fixture.waitUntil).not.toHaveBeenCalled();
		expect(fixture.cursor).toMatchObject({ nextAttempt: 0 });
	});

	it("resumes a same-nonce future deadline without resetting its attempt", async () => {
		const deadline = new Date("2026-08-01T00:10:00.000Z");
		const fixture = setup({
			cursor: { nextAttempt: 7, nextProbeAt: deadline, nonce: "manual:resume" },
			row: domain({ paymentOrderId: null, source: "external" }),
		});
		fixture.verificationResults.push({ status: "active" });

		await expect(
			fixture.runner.execute({ domainId, nonce: "manual:resume" }),
		).resolves.toEqual({
			processed: true,
			status: "active",
			terminalized: false,
		});

		expect(fixture.initializeCursor).toHaveBeenCalledWith(domainId, {
			adoptExistingNonce: false,
			nonce: "manual:resume",
		});
		expect(fixture.waits).toEqual([deadline]);
		expect(fixture.probes).toHaveLength(1);
	});

	it("adopts a cutover-seeded nonce for a purchased row", async () => {
		const fixture = setup({
			cursor: {
				nextAttempt: 100,
				nextProbeAt: null,
				nonce: "legacy-bull-chain",
			},
		});

		await fixture.runner.execute({
			domainId,
			nonce: purchaseNonce,
		});

		expect(fixture.initializeCursor).toHaveBeenCalledWith(domainId, {
			adoptExistingNonce: true,
			nonce: purchaseNonce,
		});
		expect(fixture.clearCursor).toHaveBeenCalledWith(
			domainId,
			"legacy-bull-chain",
		);
	});

	it("starts a fresh cursor for a deliberate external nonce", async () => {
		const fixture = setup({
			cursor: { nextAttempt: 100, nextProbeAt: null, nonce: "old-manual" },
			row: domain({ paymentOrderId: null, source: "external" }),
		});
		fixture.verificationResults.push({ status: "active" });

		await fixture.runner.execute({ domainId, nonce: "new-manual" });

		expect(fixture.initializeCursor).toHaveBeenCalledWith(domainId, {
			adoptExistingNonce: false,
			nonce: "new-manual",
		});
		expect(fixture.probes).toHaveLength(1);
	});

	it("starts a fresh cursor for manual verification of a purchased row", async () => {
		const fixture = setup({
			cursor: {
				nextAttempt: 100,
				nextProbeAt: null,
				nonce: "purchase:old-run",
			},
		});
		fixture.verificationResults.push({ status: "active" });

		await fixture.runner.execute({
			domainId,
			nonce: "manual:new-verification",
		});

		expect(fixture.initializeCursor).toHaveBeenCalledWith(domainId, {
			adoptExistingNonce: false,
			nonce: "manual:new-verification",
		});
		expect(fixture.probes).toHaveLength(1);
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
	});

	it("stops after a cursor advance CAS loss without waiting or advancing twice", async () => {
		const fixture = setup();
		fixture.loseNextAdvance();

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).resolves.toEqual({
			processed: false,
			reason: "state_changed",
			terminalized: false,
		});

		expect(fixture.probes).toHaveLength(1);
		expect(fixture.advanceCursor).toHaveBeenCalledTimes(1);
		expect(fixture.waitUntil).not.toHaveBeenCalled();
	});

	it("propagates a durable-wait crash after the cursor has advanced", async () => {
		const fixture = setup();
		fixture.waitUntil.mockRejectedValueOnce(
			new Error("checkpoint unavailable"),
		);

		await expect(
			fixture.runner.execute({ domainId, nonce: purchaseNonce }),
		).rejects.toThrow("checkpoint unavailable");

		expect(fixture.cursor).toMatchObject({ nextAttempt: 1 });
		expect(fixture.probes).toHaveLength(1);
	});

	it("short-circuits missing, failed, and active rows without probing", async () => {
		const missing = setup({ row: null });
		await expect(
			missing.runner.execute({ domainId, nonce: "missing" }),
		).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
			terminalized: false,
		});

		const failed = setup({
			row: domain({ error: "Already failed", status: "failed" }),
		});
		await expect(
			failed.runner.execute({ domainId, nonce: "failed" }),
		).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
			terminalized: true,
		});
		expect(failed.terminalFailure).toHaveBeenCalledTimes(1);

		const active = setup({ row: domain({ status: "active" }) });
		await expect(
			active.runner.execute({ domainId, nonce: "active" }),
		).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
			terminalized: false,
		});
		expect(active.activation).toHaveBeenCalledTimes(1);

		expect(missing.verification).not.toHaveBeenCalled();
		expect(failed.verification).not.toHaveBeenCalled();
		expect(active.verification).not.toHaveBeenCalled();
	});

	it("terminalizes a purchased row with no Cloudflare id but leaves an external row retryable", async () => {
		const purchased = setup({ row: domain({ cfCustomHostnameId: null }) });

		await expect(
			purchased.runner.execute({ domainId, nonce: purchaseNonce }),
		).resolves.toEqual({
			processed: false,
			reason: "missing_cf_hostname",
			terminalized: true,
		});
		expect(purchased.terminalFailure).toHaveBeenCalledTimes(1);
		expect(domainFailureSummary(purchased.terminalErrors[0])).toBe(
			"Domain registration failed",
		);

		const external = setup({
			row: domain({
				cfCustomHostnameId: null,
				paymentOrderId: null,
				source: "external",
			}),
		});
		await expect(
			external.runner.execute({ domainId, nonce: "external" }),
		).resolves.toEqual({
			processed: false,
			reason: "missing_cf_hostname",
			terminalized: false,
		});
		expect(external.terminalFailure).not.toHaveBeenCalled();
	});
});
