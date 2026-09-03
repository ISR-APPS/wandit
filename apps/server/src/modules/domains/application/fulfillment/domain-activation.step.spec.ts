import { describe, expect, it, vi } from "vitest";
import {
	DomainActivationStep,
	DomainActivationTransientError,
} from "./domain-activation.step";
import type { DomainFulfillmentRow } from "./domain-fulfillment.contracts";

const domainId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

type FulfillmentOrder = {
	fulfillmentError: string | null;
	refundStatus: string | null;
	status: "failed" | "fulfilled" | "fulfilling" | "refunded";
};

function domain(
	status: DomainFulfillmentRow["status"] = "configuring",
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_domain_1",
		dns: null,
		error: null,
		expiresAt: null,
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: orderId,
		projectId,
		provider: "namecom",
		providerDomainId: "example.com",
		providerOrderId: "provider_order_1",
		providerTotalPaidUsd: "12.99",
		registrant: null,
		source: "purchased",
		status,
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-07-24T12:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function setup(
	initialDomain: DomainFulfillmentRow,
	initialOrder: FulfillmentOrder = {
		fulfillmentError: null,
		refundStatus: null,
		status: "fulfilling",
	},
) {
	let currentDomain = initialDomain;
	let currentOrder = initialOrder;
	const events: string[] = [];
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	};
	const dependencies = {
		activateExternalDomain: vi.fn(
			async (
				_id: string,
				statuses: Extract<
					DomainFulfillmentRow["status"],
					"active" | "configuring"
				>[],
			) => {
				events.push(`activate-external:${statuses.join("|")}`);

				if (
					currentDomain.source !== "external" ||
					!statuses.includes(currentDomain.status as "active" | "configuring")
				) {
					return null;
				}

				const dns =
					typeof currentDomain.dns === "object" && currentDomain.dns !== null
						? { ...(currentDomain.dns as Record<string, unknown>) }
						: {};
				delete dns.externalVerification;
				currentDomain = {
					...currentDomain,
					dns,
					error: null,
					status: "active",
				};

				return currentDomain;
			},
		),
		deleteCustomHostname: vi.fn(async (id: string) => {
			events.push(`delete-hostname:${id}`);
		}),
		deleteDomainPointer: vi.fn(async (name: string) => {
			events.push(`delete-pointer:${name}`);
		}),
		findDomain: vi.fn(async () => {
			events.push("find-domain");

			return currentDomain;
		}),
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
		putDomainPointer: vi.fn(
			async (
				name: string,
				pointer: { projectId: string; source: "domain" },
			) => {
				events.push(
					`put-pointer:${name}:${pointer.projectId}:${pointer.source}`,
				);
			},
		),
		updateDomainIfStatus: vi.fn(
			async (
				_id: string,
				statuses: DomainFulfillmentRow["status"][],
				patch: Partial<DomainFulfillmentRow>,
			) => {
				events.push(
					`cas:${statuses.join("|")}:${String(patch.status ?? "same")}`,
				);

				if (!statuses.includes(currentDomain.status)) {
					return null;
				}

				currentDomain = { ...currentDomain, ...patch };

				return currentDomain;
			},
		),
	};
	const step = new DomainActivationStep(dependencies);

	return {
		dependencies,
		events,
		get domain() {
			return currentDomain;
		},
		get order() {
			return currentOrder;
		},
		setDomain(next: DomainFulfillmentRow) {
			currentDomain = next;
		},
		step,
	};
}

describe("DomainActivationStep", () => {
	it("writes the project pointer before activating and completing the order", async () => {
		const fixture = setup(domain());

		await expect(fixture.step.execute(fixture.domain)).resolves.toMatchObject({
			processed: true,
			status: "active",
		});

		expect(fixture.events).toEqual([
			`put-pointer:example.com:${projectId}:domain`,
			"cas:configuring:active",
			"mark-order-fulfilled",
		]);
		expect(fixture.dependencies.putDomainPointer).toHaveBeenCalledWith(
			"example.com",
			{ projectId, source: "domain" },
		);
		expect(fixture.domain).toMatchObject({ error: null, status: "active" });
		expect(fixture.order.status).toBe("fulfilled");
	});

	it("clears a stalled external marker as part of activation", async () => {
		const fixture = setup(
			domain("configuring", {
				dns: {
					externalVerification: {
						attempts: 101,
						stalledAt: "2026-08-02T00:00:30.000Z",
					},
					records: [],
					triggerConfiguration: {
						nextAttempt: 100,
						nextProbeAt: null,
						nonce: "manual:private",
					},
				},
				paymentOrderId: null,
				provider: null,
				source: "external",
			}),
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toMatchObject({
			processed: true,
			status: "active",
		});

		expect(fixture.domain.dns).toMatchObject({
			records: [],
			triggerConfiguration: {
				nextAttempt: 100,
				nonce: "manual:private",
			},
		});
		expect(fixture.domain.dns).not.toHaveProperty("externalVerification");
		expect(fixture.events).toContain("activate-external:configuring");
	});

	it("preserves a newer external cursor while activation clears the warning", async () => {
		const fixture = setup(
			domain("configuring", {
				dns: {
					externalVerification: {
						attempts: 101,
						stalledAt: "2026-08-02T00:00:30.000Z",
					},
					records: [],
					triggerConfiguration: {
						nextAttempt: 100,
						nextProbeAt: null,
						nonce: "old-run",
					},
				},
				paymentOrderId: null,
				provider: null,
				source: "external",
			}),
		);
		const staleRow = fixture.domain;
		fixture.setDomain({
			...fixture.domain,
			dns: {
				...(fixture.domain.dns as Record<string, unknown>),
				triggerConfiguration: {
					nextAttempt: 3,
					nextProbeAt: "2026-08-02T00:10:00.000Z",
					nonce: "new-run",
				},
			},
		});

		await expect(fixture.step.execute(staleRow)).resolves.toMatchObject({
			processed: true,
			status: "active",
		});

		expect(fixture.domain.dns).toMatchObject({
			triggerConfiguration: { nextAttempt: 3, nonce: "new-run" },
		});
		expect(fixture.domain.dns).not.toHaveProperty("externalVerification");
	});

	it("never attempts the activation CAS when publishing the pointer fails", async () => {
		const fixture = setup(domain());
		fixture.dependencies.putDomainPointer.mockRejectedValueOnce(
			new Error("KV unavailable"),
		);

		await expect(fixture.step.execute(fixture.domain)).rejects.toMatchObject({
			message: "KV unavailable",
			name: "DomainActivationTransientError",
			providerError: expect.objectContaining({ message: "KV unavailable" }),
		});
		expect(
			new DomainActivationTransientError(new Error("KV unavailable")),
		).toBeInstanceOf(DomainActivationTransientError);

		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).not.toHaveBeenCalled();
		expect(fixture.domain.status).toBe("configuring");
	});

	it("accepts an activation CAS lost to another successful activator and heals the order", async () => {
		const fixture = setup(domain());
		fixture.dependencies.updateDomainIfStatus.mockImplementationOnce(
			async () => {
				fixture.events.push("cas:configuring:active");
				fixture.setDomain(domain("active"));

				return null;
			},
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toMatchObject({
			processed: true,
			status: "active",
		});

		expect(fixture.events).toEqual([
			`put-pointer:example.com:${projectId}:domain`,
			"cas:configuring:active",
			"find-domain",
			"mark-order-fulfilled",
		]);
		expect(fixture.dependencies.deleteCustomHostname).not.toHaveBeenCalled();
		expect(fixture.dependencies.deleteDomainPointer).not.toHaveBeenCalled();
	});

	it("cleans a failed CAS loser once and remains unable to reactivate it on replay", async () => {
		const fixture = setup(domain());
		fixture.dependencies.updateDomainIfStatus.mockImplementationOnce(
			async () => {
				fixture.events.push("cas:configuring:active");
				fixture.setDomain(
					domain("failed", {
						error: "Payment was refunded before fulfillment completed",
					}),
				);

				return null;
			},
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toEqual({
			processed: false,
			reason: "state_changed",
		});
		await expect(fixture.step.execute(fixture.domain)).resolves.toEqual({
			processed: false,
			reason: "state_changed",
		});

		expect(fixture.domain).toMatchObject({
			cfCustomHostnameId: null,
			error: "Payment was refunded before fulfillment completed",
			status: "failed",
		});
		expect(fixture.dependencies.putDomainPointer).toHaveBeenCalledTimes(1);
		expect(fixture.dependencies.deleteCustomHostname).toHaveBeenCalledTimes(1);
		expect(fixture.dependencies.deleteCustomHostname).toHaveBeenCalledWith(
			"cf_domain_1",
		);
		expect(fixture.dependencies.deleteDomainPointer).toHaveBeenCalledTimes(2);
		expect(fixture.dependencies.markOrderFulfilled).not.toHaveBeenCalled();
	});

	it("rolls back only the pointer when activation loses its CAS to another nonterminal state", async () => {
		const fixture = setup(domain());
		fixture.dependencies.updateDomainIfStatus.mockImplementationOnce(
			async () => {
				fixture.events.push("cas:configuring:active");
				fixture.setDomain(domain("expired"));

				return null;
			},
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toEqual({
			processed: false,
			reason: "state_changed",
		});

		expect(fixture.dependencies.deleteDomainPointer).toHaveBeenCalledWith(
			"example.com",
		);
		expect(fixture.dependencies.deleteCustomHostname).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).not.toHaveBeenCalled();
	});

	it("activates and fulfills a projectless paid purchase without writing KV", async () => {
		const fixture = setup(domain("configuring", { projectId: null }));

		await expect(fixture.step.execute(fixture.domain)).resolves.toMatchObject({
			processed: true,
			status: "active",
		});

		expect(fixture.dependencies.putDomainPointer).not.toHaveBeenCalled();
		expect(fixture.dependencies.deleteCustomHostname).not.toHaveBeenCalled();
		expect(fixture.domain.status).toBe("active");
		expect(fixture.order.status).toBe("fulfilled");
	});

	it("cleans and fails a detached external domain instead of activating it", async () => {
		const fixture = setup(
			domain("configuring", {
				paymentOrderId: null,
				projectId: null,
				provider: null,
				providerDomainId: null,
				source: "external",
			}),
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toEqual({
			processed: false,
			reason: "detached",
		});

		expect(fixture.events).toEqual([
			"delete-hostname:cf_domain_1",
			"mark-domain-failed:Domain is no longer attached to a project",
		]);
		expect(fixture.domain).toMatchObject({
			error: "Domain is no longer attached to a project",
			status: "failed",
		});
		expect(fixture.dependencies.putDomainPointer).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).not.toHaveBeenCalled();
	});

	it("deletes the apex custom hostname next to the www hostname when cleaning a failed row", async () => {
		const fixture = setup(
			domain("failed", {
				dns: { apexConfigured: true, apexCustomHostnameId: "cf_apex" },
			}),
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toEqual({
			processed: false,
			reason: "state_changed",
		});

		expect(fixture.events).toEqual([
			"delete-hostname:cf_domain_1",
			"delete-hostname:cf_apex",
			"delete-pointer:example.com",
			"cas:failed:same",
		]);
		expect(fixture.domain).toMatchObject({
			cfCustomHostnameId: null,
			dns: { apexConfigured: true, apexCustomHostnameId: "cf_apex" },
		});
	});

	it("does not reactivate an already-failed delivery and tolerates cleanup failure", async () => {
		const fixture = setup(domain("failed"));
		fixture.dependencies.deleteCustomHostname.mockRejectedValueOnce(
			new Error("Cloudflare unavailable"),
		);
		fixture.dependencies.deleteDomainPointer.mockRejectedValueOnce(
			new Error("KV unavailable"),
		);

		await expect(fixture.step.execute(fixture.domain)).resolves.toEqual({
			processed: false,
			reason: "state_changed",
		});

		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.dependencies.putDomainPointer).not.toHaveBeenCalled();
		expect(fixture.dependencies.markOrderFulfilled).not.toHaveBeenCalled();
		expect(fixture.dependencies.logger.warn).toHaveBeenCalledWith(
			`Failed to delete Cloudflare custom hostname for domain ${domainId}`,
			"Cloudflare unavailable",
		);
		expect(fixture.dependencies.logger.warn).toHaveBeenCalledWith(
			`Failed to delete domain routing pointer for ${domainId}`,
			"KV unavailable",
		);
	});

	it("heals an active replay while preserving a partial-refund manual-review note", async () => {
		const manualReviewNote =
			"Manual review required: Stripe reported a partial refund for this domain order.";
		const fixture = setup(domain("active"), {
			fulfillmentError: manualReviewNote,
			refundStatus: "partial",
			status: "fulfilling",
		});

		await expect(fixture.step.execute(fixture.domain)).resolves.toMatchObject({
			processed: true,
			status: "active",
		});

		expect(fixture.dependencies.putDomainPointer).not.toHaveBeenCalled();
		expect(fixture.dependencies.updateDomainIfStatus).not.toHaveBeenCalled();
		expect(fixture.order).toEqual({
			fulfillmentError: manualReviewNote,
			refundStatus: "partial",
			status: "fulfilled",
		});
	});
});
