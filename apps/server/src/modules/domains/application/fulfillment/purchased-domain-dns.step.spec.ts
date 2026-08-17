import type { RequiredDomainRecord } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { DomainDnsRecord } from "../../domain/ports/domain-provider.port";
import type {
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import { OrderFulfillmentStoppedError } from "./domain-fulfillment.errors";
import { PurchasedDomainDnsStep } from "./purchased-domain-dns.step";

const domainId = "11111111-1111-4111-8111-111111111111";
const fallbackOrigin = "customers.wandit.app";

function makeRow(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: null,
		dns: null,
		error: null,
		expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: "22222222-2222-4222-8222-222222222222",
		projectId: "44444444-4444-4444-8444-444444444444",
		provider: "namecom",
		providerDomainId: "nc_example.com",
		providerOrderId: "registrar-order-42",
		providerTotalPaidUsd: "12.99",
		registrant: null,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function setup() {
	const events: string[] = [];
	const setDnsRecords = vi.fn(
		async (_name: string, _records: DomainDnsRecord[]): Promise<void> => {
			events.push("set-www-cname");
		},
	);
	const updatePostRegistrationState = vi.fn(
		async (
			row: DomainFulfillmentRow,
			patch: DomainFulfillmentPatch,
		): Promise<DomainFulfillmentRow> => {
			events.push("persist-dns-marker");

			return { ...row, ...patch };
		},
	);
	const step = new PurchasedDomainDnsStep(
		{ setDnsRecords },
		{ updatePostRegistrationState },
		fallbackOrigin,
	);

	return {
		events,
		setDnsRecords,
		step,
		updatePostRegistrationState,
	};
}

describe("PurchasedDomainDnsStep", () => {
	it("configures only the managed www CNAME and then persists the marker", async () => {
		const row = makeRow();
		const { events, setDnsRecords, step, updatePostRegistrationState } =
			setup();

		await expect(step.execute(row)).resolves.toMatchObject({
			dns: {
				purchaseDnsConfigured: true,
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: fallbackOrigin,
					},
				],
			},
		});
		expect(setDnsRecords).toHaveBeenCalledOnce();
		expect(setDnsRecords).toHaveBeenCalledWith("example.com", [
			{ name: "www", type: "CNAME", value: fallbackOrigin },
		]);
		expect(updatePostRegistrationState).toHaveBeenCalledWith(row, {
			dns: {
				purchaseDnsConfigured: true,
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: fallbackOrigin,
					},
				],
			},
		});
		expect(events).toEqual(["set-www-cname", "persist-dns-marker"]);
	});

	it("preserves passthrough DNS state and appends the managed CNAME", async () => {
		const apexRecord = {
			name: "@",
			purpose: "traffic",
			type: "A",
			value: "192.0.2.10",
		} satisfies RequiredDomainRecord;
		const staleManagedRecord = {
			name: "www",
			purpose: "old-purpose",
			type: "CNAME",
			value: fallbackOrigin,
		} satisfies RequiredDomainRecord;
		const row = makeRow({
			dns: {
				customHostnameDnsConfigured: true,
				records: [apexRecord, staleManagedRecord, staleManagedRecord],
				triggerConfiguration: {
					nextAttempt: 7,
					nextProbeAt: "2026-08-01T12:00:00.000Z",
					nonce: "purchase:order",
				},
			},
		});
		const { step, updatePostRegistrationState } = setup();

		await step.execute(row);

		const patch = updatePostRegistrationState.mock.calls[0]?.[1];
		expect(patch?.dns).toMatchObject({
			customHostnameDnsConfigured: true,
			purchaseDnsConfigured: true,
			triggerConfiguration: {
				nextAttempt: 7,
				nextProbeAt: "2026-08-01T12:00:00.000Z",
				nonce: "purchase:order",
			},
		});
		expect(patch?.dns).toHaveProperty("records", [
			apexRecord,
			staleManagedRecord,
			staleManagedRecord,
			{
				name: "www",
				purpose: "traffic",
				type: "CNAME",
				value: fallbackOrigin,
			},
		]);
	});

	it("skips every side effect when the durable marker is already present", async () => {
		const row = makeRow({
			dns: {
				purchaseDnsConfigured: true,
				records: [],
			},
		});
		const { setDnsRecords, step, updatePostRegistrationState } = setup();

		await expect(step.execute(row)).resolves.toBe(row);
		expect(setDnsRecords).not.toHaveBeenCalled();
		expect(updatePostRegistrationState).not.toHaveBeenCalled();
	});

	it("recovers from malformed stored DNS by rebuilding only the managed marker", async () => {
		const row = makeRow({ dns: { records: [{ malformed: true }] } });
		const { step, updatePostRegistrationState } = setup();

		await step.execute(row);

		expect(updatePostRegistrationState).toHaveBeenCalledWith(row, {
			dns: {
				purchaseDnsConfigured: true,
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: fallbackOrigin,
					},
				],
			},
		});
	});

	it("does not persist when the registrar CNAME call fails", async () => {
		const { setDnsRecords, step, updatePostRegistrationState } = setup();
		const registrarError = new Error("registrar DNS timeout");
		setDnsRecords.mockRejectedValueOnce(registrarError);

		await expect(step.execute(makeRow())).rejects.toBe(registrarError);
		expect(updatePostRegistrationState).not.toHaveBeenCalled();
	});

	it("propagates a registering-CAS financial race after the idempotent DNS call", async () => {
		const { setDnsRecords, step, updatePostRegistrationState } = setup();
		updatePostRegistrationState.mockRejectedValueOnce(
			new OrderFulfillmentStoppedError("financial_race"),
		);

		await expect(step.execute(makeRow())).rejects.toMatchObject({
			reason: "financial_race",
		});
		expect(setDnsRecords).toHaveBeenCalledTimes(1);
	});
});
