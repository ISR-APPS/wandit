import { describe, expect, it, vi } from "vitest";

import type {
	DomainFulfillmentOrder,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import {
	MissingDomainPaymentOrderError,
	TerminalDomainFulfillmentError,
} from "./domain-fulfillment.errors";
import { DomainTerminalFailureStep } from "./domain-terminal-failure.step";

const domainId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

function domain(
	status: DomainFulfillmentRow["status"] = "registering",
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_domain_1",
		dns: null,
		error: null,
		expiresAt: null,
		id: domainId,
		isPrimary: true,
		name: "example.com",
		paymentOrderId: orderId,
		projectId,
		provider: "namecom",
		providerDomainId: null,
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "purchased",
		status,
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-07-24T12:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function order(
	status: DomainFulfillmentOrder["status"] = "fulfilling",
	overrides: Partial<DomainFulfillmentOrder> = {},
): DomainFulfillmentOrder {
	return {
		fulfillmentError: null,
		id: orderId,
		refundStatus: null,
		status,
		...overrides,
	};
}

function setup(
	initialDomain: DomainFulfillmentRow,
	initialOrder: DomainFulfillmentOrder = order(),
) {
	let currentDomain = initialDomain;
	let currentOrder = initialOrder;
	let beforeFence: (() => void) | null = null;
	let fenceCalls = 0;
	const transaction = { id: "transaction_1" };
	const events: string[] = [];
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	};
	const dependencies = {
		deleteCustomHostname: vi.fn(async (id: string) => {
			events.push(`delete-hostname:${id}`);
		}),
		deleteDomainPointer: vi.fn(async (name: string) => {
			events.push(`delete-pointer:${name}`);
		}),
		deleteZone: vi.fn(async (id: string) => {
			events.push(`delete-zone:${id}`);
		}),
		dispatchRefund: vi.fn(async (_id: string, failureReason: string) => {
			events.push(`dispatch-refund:${failureReason}`);
		}),
		findDomainForUpdate: vi.fn(
			async (): Promise<DomainFulfillmentRow | null> => {
				events.push("lock-domain");

				return currentDomain;
			},
		),
		logger,
		markDomainFailed: vi.fn(async (_id: string, summary: string) => {
			events.push(`mark-domain-failed:${summary}`);
			currentDomain = {
				...currentDomain,
				error: summary,
				isPrimary: false,
				status: "failed",
			};

			return currentDomain;
		}),
		markOrderFailed: vi.fn(
			async (_id: string, summary: string, inputTransaction: unknown) => {
				events.push(`mark-order-failed:${summary}`);
				expect(inputTransaction).toBe(transaction);

				if (
					currentOrder.status !== "paid" &&
					currentOrder.status !== "fulfilling"
				) {
					return null;
				}

				currentOrder = {
					...currentOrder,
					fulfillmentError: summary,
					status: "failed",
				};

				return currentOrder;
			},
		),
		markOrderFulfilled: vi.fn(async () => {
			events.push("mark-order-fulfilled");

			if (currentOrder.status !== "fulfilling") {
				return null;
			}

			currentOrder = {
				...currentOrder,
				fulfillmentError:
					currentOrder.refundStatus === "partial"
						? currentOrder.fulfillmentError
						: null,
				status: "fulfilled",
			};

			return currentOrder;
		}),
		reportError: vi.fn(),
		updateDomainIfStatus: vi.fn(
			async (
				_id: string,
				statuses: DomainFulfillmentRow["status"][],
				patch: Partial<DomainFulfillmentRow>,
				inputTransaction: unknown,
			) => {
				events.push(`mark-domain-failed:${String(patch.error)}`);
				expect(inputTransaction).toBe(transaction);

				if (!statuses.includes(currentDomain.status)) {
					return null;
				}

				currentDomain = { ...currentDomain, ...patch };

				return currentDomain;
			},
		),
		withOrderFulfillmentFence: async <T>(
			_id: string,
			operation: (
				lockedOrder: DomainFulfillmentOrder,
				inputTransaction: unknown,
			) => Promise<T>,
		): Promise<T> => {
			fenceCalls += 1;
			events.push("fence-order");
			beforeFence?.();

			return operation(currentOrder, transaction);
		},
	};
	const step = new DomainTerminalFailureStep(dependencies);

	return {
		dependencies,
		events,
		get domain() {
			return currentDomain;
		},
		get fenceCalls() {
			return fenceCalls;
		},
		get order() {
			return currentOrder;
		},
		setDomain(next: DomainFulfillmentRow) {
			currentDomain = next;
		},
		setBeforeFence(operation: () => void) {
			beforeFence = operation;
		},
		step,
		transaction,
	};
}

describe("DomainTerminalFailureStep", () => {
	it.each([
		"paid",
		"fulfilling",
	] as const)("dispatches a %s order refund before either terminal database write", async (status) => {
		const fixture = setup(domain(), order(status));
		const failure = new TerminalDomainFulfillmentError(
			"Domain is not available",
		);

		await expect(
			fixture.step.execute(fixture.domain, failure),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.events).toEqual([
			"fence-order",
			"lock-domain",
			"dispatch-refund:Domain is not available",
			"mark-domain-failed:Domain is not available",
			"mark-order-failed:Domain is not available",
			"delete-hostname:cf_domain_1",
			"delete-pointer:example.com",
		]);
		expect(fixture.dependencies.dispatchRefund).toHaveBeenCalledWith(
			orderId,
			"Domain is not available",
		);
		expect(fixture.dependencies.updateDomainIfStatus).toHaveBeenCalledWith(
			domainId,
			["registering", "configuring"],
			{
				error: "Domain is not available",
				isPrimary: false,
				status: "failed",
			},
			fixture.transaction,
		);
		expect(fixture.dependencies.reportError).toHaveBeenCalledExactlyOnceWith(
			failure,
			{ domainId, orderId },
		);
		expect(fixture.domain.status).toBe("failed");
		expect(fixture.order.status).toBe("failed");
	});

	it("deletes the apex custom hostname alongside the www hostname after terminalization", async () => {
		const fixture = setup(
			domain("registering", {
				dns: { apexCustomHostnameId: "cf_apex", purchaseDnsConfigured: true },
			}),
			order("fulfilling"),
		);

		await expect(
			fixture.step.execute(
				fixture.domain,
				new TerminalDomainFulfillmentError("Domain is not available"),
			),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.events.slice(-3)).toEqual([
			"delete-hostname:cf_domain_1",
			"delete-hostname:cf_apex",
			"delete-pointer:example.com",
		]);
		expect(fixture.dependencies.deleteZone).not.toHaveBeenCalled();
	});

	it("deletes a pipeline-created zone whose nameservers never moved, but leaves a delegated one", async () => {
		const created = setup(
			domain("registering", {
				dns: { zoneCreated: true, zoneId: "zone_new" },
			}),
			order("fulfilling"),
		);

		await created.step.execute(
			created.domain,
			new TerminalDomainFulfillmentError("Domain is not available"),
		);

		expect(created.events.slice(-3)).toEqual([
			"delete-hostname:cf_domain_1",
			"delete-zone:zone_new",
			"delete-pointer:example.com",
		]);

		const delegated = setup(
			domain("configuring", {
				dns: { apexConfigured: true, zoneCreated: true, zoneId: "zone_live" },
			}),
			order("fulfilling"),
		);

		await delegated.step.execute(
			delegated.domain,
			new TerminalDomainFulfillmentError(
				"Cloudflare SSL verification timed out",
			),
		);

		expect(delegated.dependencies.deleteZone).not.toHaveBeenCalled();
		expect(delegated.dependencies.logger.warn).toHaveBeenCalledWith(
			`Leaving Cloudflare zone zone_live for domain ${domainId} in place`,
			"nameservers were already delegated to the zone",
		);
	});

	it("leaves a zone in place when the nameserver handover started but the apex marker never landed", async () => {
		// Window: setNameservers reached the registrar, then the final persist
		// lost the fence to a concurrent refund (or a DB error) before
		// apexConfigured was written. Only zoneDelegated is durable.
		const fixture = setup(
			domain("failed", {
				dns: { zoneCreated: true, zoneDelegated: true, zoneId: "zone_race" },
			}),
			order("refunded"),
		);

		await fixture.step.execute(
			fixture.domain,
			new TerminalDomainFulfillmentError("Order was refunded"),
		);

		expect(fixture.dependencies.deleteZone).not.toHaveBeenCalled();
		expect(fixture.dependencies.logger.warn).toHaveBeenCalledWith(
			`Leaving Cloudflare zone zone_race for domain ${domainId} in place`,
			"nameservers were already delegated to the zone",
		);
	});

	it("does not terminalize or clean up until durable refund dispatch succeeds", async () => {
		const fixture = setup(domain(), order("fulfilling"));
		const originalError = new TerminalDomainFulfillmentError(
			"Domain is not available",
		);
		fixture.dependencies.dispatchRefund.mockRejectedValueOnce(
			new Error("refund dispatcher unavailable"),
		);

		await expect(
			fixture.step.execute(fixture.domain, originalError),
		).rejects.toThrow("refund dispatcher unavailable");

		expect(fixture.domain.status).toBe("registering");
		expect(fixture.order.status).toBe("fulfilling");
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFailed).not.toHaveBeenCalled();
		expect(fixture.dependencies.reportError).toHaveBeenCalledExactlyOnceWith(
			originalError,
			{ domainId, orderId },
		);
		expect(fixture.dependencies.deleteCustomHostname).not.toHaveBeenCalled();
		expect(fixture.dependencies.deleteDomainPointer).not.toHaveBeenCalled();
	});

	it("re-dispatches an already-failed eligible order without rewriting terminal rows", async () => {
		const fixture = setup(
			domain("failed", { error: "Previous failure" }),
			order("failed", { fulfillmentError: "Previous failure" }),
		);

		await expect(
			fixture.step.execute(fixture.domain, new Error("sensitive details")),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.dependencies.dispatchRefund).toHaveBeenCalledWith(
			orderId,
			"Domain registration failed",
		);
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFailed).not.toHaveBeenCalled();
		expect(fixture.dependencies.reportError).not.toHaveBeenCalled();
		expect(fixture.dependencies.deleteCustomHostname).toHaveBeenCalledTimes(1);
		expect(fixture.dependencies.deleteDomainPointer).toHaveBeenCalledTimes(1);
	});

	it.each([
		{
			error: () => new TerminalDomainFulfillmentError("Safe terminal failure"),
			expected: "Safe terminal failure",
			label: "terminal",
		},
		{
			error: () =>
				Object.assign(new Error("HTTP fallback"), {
					getResponse: () => ({
						code: "DOMAIN_PROVIDER_ERROR",
						message: "Safe provider failure",
					}),
				}),
			expected: "Safe provider failure",
			label: "HTTP response",
		},
		{
			error: () =>
				Object.assign(new Error("Safe HTTP fallback"), {
					getResponse: () => "Bad Gateway",
				}),
			expected: "Domain registration failed",
			label: "unrelated HTTP error",
		},
		{
			error: () =>
				Object.assign(new Error("Sensitive validation detail"), {
					getResponse: () => ({
						code: "BAD_REQUEST",
						message: "Sensitive validation detail",
					}),
				}),
			expected: "Domain registration failed",
			label: "non-domain coded HTTP error",
		},
		{
			error: () => new Error("connect ECONNREFUSED 10.2.3.4"),
			expected: "Domain registration failed",
			label: "generic",
		},
	])("stores the safe summary for a $label error", async ({
		error,
		expected,
	}) => {
		const fixture = setup(
			domain("configuring", {
				cfCustomHostnameId: null,
				paymentOrderId: null,
				projectId: null,
			}),
		);

		const originalError = error();

		await expect(
			fixture.step.execute(fixture.domain, originalError),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.dependencies.markDomainFailed).toHaveBeenCalledWith(
			domainId,
			expected,
		);
		expect(fixture.dependencies.reportError).toHaveBeenCalledExactlyOnceWith(
			originalError,
			{ domainId, orderId: "none" },
		);
	});

	it("reports a fresh failure once when terminalization is replayed", async () => {
		const fixture = setup(domain(), order("fulfilling"));
		const originalError = new Error("provider rejected registration");

		await fixture.step.execute(fixture.domain, originalError);
		await fixture.step.execute(
			fixture.domain,
			new Error("Trigger onFailure replay"),
		);

		expect(fixture.dependencies.reportError).toHaveBeenCalledExactlyOnceWith(
			originalError,
			{ domainId, orderId },
		);
	});

	it("does not refund an already-active domain and heals its order completion", async () => {
		const manualReviewNote = "Manual review required: partial refund observed.";
		const fixture = setup(
			domain("active"),
			order("fulfilling", {
				fulfillmentError: manualReviewNote,
				refundStatus: "partial",
			}),
		);

		await expect(
			fixture.step.execute(fixture.domain, new Error("stale failure")),
		).resolves.toEqual({ status: "active" });

		expect(fixture.dependencies.dispatchRefund).not.toHaveBeenCalled();
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFailed).not.toHaveBeenCalled();
		expect(fixture.dependencies.reportError).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).toHaveBeenCalledWith(
			orderId,
		);
		expect(fixture.order).toMatchObject({
			fulfillmentError: manualReviewNote,
			refundStatus: "partial",
			status: "fulfilled",
		});
	});

	it("leaves a nonactive domain unchanged when its order is already fulfilled", async () => {
		const fixture = setup(domain("registering"), order("fulfilled"));

		await expect(
			fixture.step.execute(fixture.domain, new Error("stale failure")),
		).resolves.toEqual({ status: "unchanged" });

		expect(fixture.dependencies.dispatchRefund).not.toHaveBeenCalled();
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFailed).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).not.toHaveBeenCalled();
		expect(fixture.dependencies.reportError).not.toHaveBeenCalled();
		expect(fixture.domain.status).toBe("registering");
	});

	it.each([
		"pending",
		"canceled",
		"refunded",
	] as const)("repairs the domain without refund dispatch when its order is %s", async (status) => {
		const fixture = setup(domain("configuring"), order(status));

		await expect(
			fixture.step.execute(fixture.domain, new Error("stale failure")),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.dependencies.dispatchRefund).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFailed).not.toHaveBeenCalled();
		expect(fixture.domain).toMatchObject({
			error: "Domain registration failed",
			isPrimary: false,
			status: "failed",
		});
		expect(fixture.order.status).toBe(status);
	});

	it("lets a stale timeout lose to activation without dispatching a refund", async () => {
		const staleRow = domain("configuring");
		const fixture = setup(staleRow, order("fulfilling"));
		fixture.setBeforeFence(() => fixture.setDomain(domain("active")));

		await expect(
			fixture.step.execute(staleRow, new Error("verification timed out")),
		).resolves.toEqual({ status: "active" });

		expect(fixture.dependencies.dispatchRefund).not.toHaveBeenCalled();
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.reportError).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).toHaveBeenCalledWith(
			orderId,
		);
		expect(fixture.order.status).toBe("fulfilled");
	});

	it.each([
		["missing", null],
		[
			"different",
			domain("registering", {
				id: "44444444-4444-4444-8444-444444444444",
			}),
		],
	] as const)("rejects a %s order-linked domain while holding the fence", async (_label, lockedDomain) => {
		const fixture = setup(domain(), order("fulfilling"));
		fixture.dependencies.findDomainForUpdate.mockResolvedValueOnce(
			lockedDomain,
		);

		await expect(
			fixture.step.execute(fixture.domain, new Error("failure")),
		).rejects.toThrow(
			`Payment order ${orderId} has no matching domain ${domainId}`,
		);

		expect(fixture.dependencies.dispatchRefund).not.toHaveBeenCalled();
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFailed).not.toHaveBeenCalled();
	});

	it("fails an orderless domain only after best-effort provider cleanup", async () => {
		const fixture = setup(
			domain("configuring", {
				paymentOrderId: null,
			}),
		);

		await expect(
			fixture.step.execute(
				fixture.domain,
				new TerminalDomainFulfillmentError("Registrant snapshot is invalid"),
			),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.events).toEqual([
			"delete-hostname:cf_domain_1",
			"delete-pointer:example.com",
			"mark-domain-failed:Registrant snapshot is invalid",
		]);
		expect(fixture.fenceCalls).toBe(0);
		expect(fixture.dependencies.dispatchRefund).not.toHaveBeenCalled();
		expect(fixture.dependencies.logger.warn).toHaveBeenCalledWith(
			`Domain ${domainId} failed terminally with no payment order attached; nothing to refund`,
		);
		expect(fixture.dependencies.reportError).toHaveBeenCalledWith(
			expect.any(TerminalDomainFulfillmentError),
			{ domainId, orderId: "none" },
		);
	});

	it("repairs an orphaned-order domain without claiming it was unattached or deleting KV", async () => {
		const fixture = setup(domain("registering"));

		await expect(
			fixture.step.execute(
				fixture.domain,
				new MissingDomainPaymentOrderError(),
				{ orderId: null },
			),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.events).toEqual([
			"delete-hostname:cf_domain_1",
			"mark-domain-failed:Payment order is missing for this domain purchase",
		]);
		expect(fixture.dependencies.logger.warn).not.toHaveBeenCalled();
		expect(fixture.dependencies.deleteDomainPointer).not.toHaveBeenCalled();
		expect(fixture.dependencies.reportError).toHaveBeenCalledWith(
			expect.any(MissingDomainPaymentOrderError),
			{ domainId, orderId: "none" },
		);
	});

	it("swallows both cleanup failures after terminal database state is durable", async () => {
		const fixture = setup(domain("failed"), order("refunded"));
		fixture.dependencies.deleteCustomHostname.mockRejectedValueOnce(
			new Error("Cloudflare unavailable"),
		);
		fixture.dependencies.deleteDomainPointer.mockRejectedValueOnce(
			new Error("KV unavailable"),
		);

		await expect(
			fixture.step.execute(fixture.domain, new Error("stale failure")),
		).resolves.toEqual({ status: "failed" });

		expect(fixture.dependencies.logger.warn).toHaveBeenCalledWith(
			`Failed to delete Cloudflare custom hostname for domain ${domainId}`,
			"Cloudflare unavailable",
		);
		expect(fixture.dependencies.logger.warn).toHaveBeenCalledWith(
			`Failed to delete domain routing pointer for ${domainId}`,
			"KV unavailable",
		);
		expect(fixture.dependencies.reportError).not.toHaveBeenCalled();
		expect(fixture.domain.status).toBe("failed");
	});
});
