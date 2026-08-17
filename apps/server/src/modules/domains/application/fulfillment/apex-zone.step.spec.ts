import type { RequiredDomainRecord } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApexZoneStep } from "./apex-zone.step";
import type {
	CustomerZone,
	CustomerZoneDnsRecord,
	CustomHostnameResult,
	DomainApexDnsPatch,
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

const domainId = "11111111-1111-4111-8111-111111111111";
const fallbackOrigin = "customers.wandit.app";
const nameServers = ["art.ns.cloudflare.com", "savanna.ns.cloudflare.com"];

const wwwTrafficRecord = {
	name: "www",
	purpose: "traffic",
	type: "CNAME",
	value: fallbackOrigin,
} satisfies RequiredDomainRecord;

const wwwValidationRecord = {
	name: "_cf-custom-hostname.www.example.com",
	purpose: "ownership_or_ssl_validation",
	type: "TXT",
	value: "www-token",
} satisfies RequiredDomainRecord;

const apexChallenge = {
	name: "_cf-custom-hostname.example.com",
	type: "TXT" as const,
	value: "apex-token",
};

const apexValidationRecord = {
	...apexChallenge,
	purpose: "ownership_or_ssl_validation",
} satisfies RequiredDomainRecord;

const apexTrafficRecord = {
	name: "@",
	purpose: "traffic",
	type: "CNAME",
	value: fallbackOrigin,
} satisfies RequiredDomainRecord;

const nameserverRecords = nameServers.map((value) => ({
	name: "@",
	purpose: "nameserver",
	type: "NS" as const,
	value,
})) satisfies RequiredDomainRecord[];

function domainRow(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_www",
		dns: {
			customHostnameDnsConfigured: true,
			purchaseDnsConfigured: true,
			records: [wwwTrafficRecord, wwwValidationRecord],
		},
		error: null,
		expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: "22222222-2222-4222-8222-222222222222",
		projectId: "44444444-4444-4444-8444-444444444444",
		provider: "namecom",
		providerDomainId: "example.com",
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

function zone(
	id = "zone_1",
	status = "pending",
	servers = nameServers,
): CustomerZone {
	return { id, nameServers: servers, status };
}

function customHostname(
	id: string,
	requiredRecords: Array<{ name: string; type: "TXT"; value: string }> = [
		apexChallenge,
	],
	status = "pending_validation",
): CustomHostnameResult {
	return {
		hostnameStatus: "pending",
		id,
		requiredRecords,
		sslStatus: status,
		status,
	};
}

/** Mirrors the runtime adapter: shallow merge, `null` removes the key. */
function mergeDns(dns: unknown, patch: DomainApexDnsPatch): unknown {
	const merged: Record<string, unknown> = {
		...((dns ?? {}) as Record<string, unknown>),
	};

	for (const [key, value] of Object.entries(patch)) {
		if (value === null) {
			delete merged[key];
		} else if (value !== undefined) {
			merged[key] = value;
		}
	}

	return merged;
}

function setup(options: { enabled?: boolean } = {}) {
	const events: string[] = [];
	const zones = {
		createZone: vi.fn(async (_name: string) => {
			events.push("create-zone");
			return zone();
		}),
		findZoneByName: vi.fn(
			async (_name: string): Promise<CustomerZone | null> => {
				events.push("find-zone");
				return null;
			},
		),
		getZoneStatus: vi.fn(async (_id: string) => {
			events.push("get-zone-status");
			return "pending";
		}),
		requestActivationCheck: vi.fn(async (_id: string) => {
			events.push("activation-check");
		}),
		upsertDnsRecord: vi.fn(
			async (_zoneId: string, record: CustomerZoneDnsRecord) => {
				events.push(`upsert:${record.type}:${record.name}`);
				return "created" as const;
			},
		),
	};
	const customHostnames = {
		createApexCustomHostname: vi.fn(async (_host: string) => {
			events.push("create-apex-hostname");
			return customHostname("cf_apex");
		}),
		deleteCustomHostname: vi.fn(async (_id: string) => {
			events.push("delete-apex-hostname");
		}),
		findCustomHostnameByName: vi.fn(
			async (_hostname: string): Promise<CustomHostnameResult | null> => {
				events.push("find-apex-hostname");
				return null;
			},
		),
		getCustomHostnameStatus: vi.fn(async (_id: string) => {
			events.push("get-apex-hostname");
			return customHostname("cf_apex");
		}),
		refreshCustomHostnameValidation: vi.fn(async (_id: string) => {
			events.push("nudge-apex-hostname");
			return customHostname("cf_apex", [apexChallenge], "active");
		}),
	};
	const registrar = {
		setNameservers: vi.fn(async (_name: string, _nameservers: string[]) => {
			events.push("set-nameservers");
		}),
	};
	const state = {
		persistApexDns: vi.fn(
			async (row: DomainFulfillmentRow, patch: DomainApexDnsPatch) => {
				events.push("persist");
				return { ...row, dns: mergeDns(row.dns, patch) };
			},
		),
	};
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	} satisfies DomainFulfillmentLogger;

	return {
		customHostnames,
		events,
		logger,
		registrar,
		state,
		step: new ApexZoneStep(zones, customHostnames, registrar, state, logger, {
			enabled: options.enabled ?? true,
			fallbackOrigin,
		}),
		zones,
	};
}

describe("ApexZoneStep", () => {
	it("creates the zone and apex hostname, writes zone records, delegates nameservers, and persists the marker", async () => {
		const input = domainRow();
		const { customHostnames, events, registrar, state, step, zones } = setup();

		const result = await step.execute(input);

		expect(events).toEqual([
			"find-zone",
			"create-zone",
			"persist",
			"find-apex-hostname",
			"create-apex-hostname",
			"persist",
			"upsert:CNAME:example.com",
			"upsert:CNAME:www.example.com",
			"upsert:TXT:_cf-custom-hostname.www.example.com",
			"upsert:TXT:_cf-custom-hostname.example.com",
			"persist",
			"set-nameservers",
			"activation-check",
			"persist",
		]);
		expect(zones.findZoneByName).toHaveBeenCalledWith("example.com");
		expect(zones.createZone).toHaveBeenCalledWith("example.com");
		expect(customHostnames.findCustomHostnameByName).toHaveBeenCalledWith(
			"example.com",
		);
		expect(customHostnames.createApexCustomHostname).toHaveBeenCalledWith(
			"example.com",
		);
		expect(customHostnames.getCustomHostnameStatus).not.toHaveBeenCalled();
		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
		// Only apex-owned keys are sent; the adapter merges them into stored dns.
		expect(state.persistApexDns).toHaveBeenNthCalledWith(1, input, {
			zoneCreated: true,
			zoneId: "zone_1",
			zoneNameServers: nameServers,
			zoneStatus: "pending",
		});
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ id: domainId }),
			{
				apexCustomHostnameId: "cf_apex",
				apexCustomHostnameStatus: "pending_validation",
				records: [wwwTrafficRecord, wwwValidationRecord, apexValidationRecord],
			},
		);
		expect(zones.upsertDnsRecord.mock.calls).toEqual([
			[
				"zone_1",
				{
					content: fallbackOrigin,
					name: "example.com",
					proxied: false,
					type: "CNAME",
				},
			],
			[
				"zone_1",
				{
					content: fallbackOrigin,
					name: "www.example.com",
					proxied: false,
					type: "CNAME",
				},
			],
			[
				"zone_1",
				{
					content: "www-token",
					name: "_cf-custom-hostname.www.example.com",
					type: "TXT",
				},
			],
			[
				"zone_1",
				{
					content: "apex-token",
					name: "_cf-custom-hostname.example.com",
					type: "TXT",
				},
			],
		]);
		// The delegation marker is durable BEFORE the registrar is called.
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({ id: domainId }),
			{ zoneDelegated: true },
		);
		expect(registrar.setNameservers).toHaveBeenCalledExactlyOnceWith(
			"example.com",
			nameServers,
		);
		expect(zones.requestActivationCheck).toHaveBeenCalledExactlyOnceWith(
			"zone_1",
		);
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({ id: domainId }),
			{
				apexConfigured: true,
				apexError: null,
				records: [
					wwwTrafficRecord,
					wwwValidationRecord,
					apexValidationRecord,
					apexTrafficRecord,
					...nameserverRecords,
				],
			},
		);
		expect(result.dns).toEqual({
			apexConfigured: true,
			apexCustomHostnameId: "cf_apex",
			apexCustomHostnameStatus: "pending_validation",
			customHostnameDnsConfigured: true,
			purchaseDnsConfigured: true,
			records: [
				wwwTrafficRecord,
				wwwValidationRecord,
				apexValidationRecord,
				apexTrafficRecord,
				...nameserverRecords,
			],
			zoneCreated: true,
			zoneDelegated: true,
			zoneId: "zone_1",
			zoneNameServers: nameServers,
			zoneStatus: "pending",
		});
	});

	it("adopts an existing zone and apex hostname by name (hand-made or earlier pass) without creating or marking them created", async () => {
		const { customHostnames, events, state, step, zones } = setup();
		zones.findZoneByName.mockResolvedValueOnce(zone("zone_existing", "active"));
		customHostnames.findCustomHostnameByName.mockResolvedValueOnce(
			customHostname("cf_apex_existing", [apexChallenge], "active"),
		);

		const result = await step.execute(domainRow());

		expect(zones.createZone).not.toHaveBeenCalled();
		expect(customHostnames.createApexCustomHostname).not.toHaveBeenCalled();
		expect(state.persistApexDns).toHaveBeenNthCalledWith(1, expect.anything(), {
			zoneId: "zone_existing",
			zoneNameServers: nameServers,
			zoneStatus: "active",
		});
		expect(result.dns).toMatchObject({
			apexConfigured: true,
			apexCustomHostnameId: "cf_apex_existing",
			zoneId: "zone_existing",
		});
		expect((result.dns as Record<string, unknown>).zoneCreated).toBeUndefined();
		expect(events).toContain("set-nameservers");
	});

	it("resumes from persisted zone and hostname ids without looking either up by name", async () => {
		const input = domainRow({
			dns: {
				apexCustomHostnameId: "cf_apex",
				records: [wwwTrafficRecord, wwwValidationRecord],
				zoneCreated: true,
				zoneId: "zone_1",
				zoneNameServers: nameServers,
				zoneStatus: "pending",
			},
		});
		const { customHostnames, events, step, zones } = setup();

		await expect(step.execute(input)).resolves.toMatchObject({
			dns: { apexConfigured: true, zoneCreated: true },
		});
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
		expect(customHostnames.findCustomHostnameByName).not.toHaveBeenCalled();
		expect(customHostnames.getCustomHostnameStatus).toHaveBeenCalledWith(
			"cf_apex",
		);
		expect(events.slice(0, 2)).toEqual([
			"get-apex-hostname",
			"upsert:CNAME:example.com",
		]);
	});

	it.each([
		["external rows", domainRow({ source: "external" }), {}],
		["the kill switch", domainRow(), { enabled: false }],
	] as const)("is a no-op for %s", async (_label, input, options) => {
		const { customHostnames, events, registrar, state, step, zones } =
			setup(options);

		await expect(step.execute(input)).resolves.toBe(input);
		expect(events).toEqual([]);
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(customHostnames.findCustomHostnameByName).not.toHaveBeenCalled();
		expect(registrar.setNameservers).not.toHaveBeenCalled();
		expect(state.persistApexDns).not.toHaveBeenCalled();
	});

	it("skips every provider call once configured and the zone is active and nudged", async () => {
		const input = domainRow({
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				apexCustomHostnameNudged: true,
				zoneActive: true,
				zoneId: "zone_1",
				zoneNameServers: nameServers,
			},
		});
		const { events, step } = setup();

		await expect(step.execute(input)).resolves.toBe(input);
		expect(events).toEqual([]);
	});

	it.each([
		["zone creation", "createZone"],
		["apex hostname creation", "createApexCustomHostname"],
		["a zone record write", "upsertDnsRecord"],
		["the registrar nameserver update", "setNameservers"],
	] as const)("records apexError and never throws when %s fails", async (_label, method) => {
		const fixture = setup();
		const failure = new Error(`${method} failed`);
		const target: Record<
			string,
			{ mockRejectedValueOnce(error: Error): unknown }
		> = {
			createApexCustomHostname:
				fixture.customHostnames.createApexCustomHostname,
			createZone: fixture.zones.createZone,
			setNameservers: fixture.registrar.setNameservers,
			upsertDnsRecord: fixture.zones.upsertDnsRecord,
		};
		target[method]?.mockRejectedValueOnce(failure);

		const result = await fixture.step.execute(domainRow());

		expect(result.dns).toMatchObject({ apexError: `${method} failed` });
		expect(
			(result.dns as Record<string, unknown>).apexConfigured,
		).toBeUndefined();
		expect(fixture.logger.warn).toHaveBeenCalledWith(
			`Apex zone configuration deferred for domain ${domainId}`,
			`${method} failed`,
		);
		expect(fixture.state.persistApexDns).toHaveBeenLastCalledWith(
			expect.anything(),
			{ apexError: `${method} failed` },
		);
	});

	it("persists the delegation marker before the registrar call and never delegates when that write fails", async () => {
		const { events, logger, registrar, state, step } = setup();
		state.persistApexDns
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockRejectedValueOnce(new Error("Domain left status registering"));

		const result = await step.execute(domainRow());

		expect(registrar.setNameservers).not.toHaveBeenCalled();
		expect(events).not.toContain("set-nameservers");
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({ id: domainId }),
			{ zoneDelegated: true },
		);
		expect(result.dns).toMatchObject({
			apexError: "Domain left status registering",
		});
		expect(result.dns).not.toHaveProperty("zoneDelegated");
		expect(result.dns).not.toHaveProperty("apexConfigured");
		expect(logger.warn).toHaveBeenCalledWith(
			`Apex zone configuration deferred for domain ${domainId}`,
			"Domain left status registering",
		);
	});

	it("keeps the delegation marker when the registrar call fails after it, so cleanup never deletes the zone", async () => {
		const { registrar, step } = setup();
		registrar.setNameservers.mockRejectedValueOnce(
			new Error("Name.com timed out"),
		);

		const result = await step.execute(domainRow());

		expect(result.dns).toMatchObject({
			apexError: "Name.com timed out",
			zoneCreated: true,
			zoneDelegated: true,
		});
		expect(result.dns).not.toHaveProperty("apexConfigured");
	});

	it("keeps the delegation marker when the final persist fails after the registrar call", async () => {
		const { registrar, state, step } = setup();
		state.persistApexDns
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockRejectedValueOnce(new Error("Domain left status registering"))
			.mockRejectedValueOnce(new Error("Domain left status registering"));

		const result = await step.execute(domainRow());

		expect(registrar.setNameservers).toHaveBeenCalledOnce();
		expect(result.dns).toMatchObject({ zoneDelegated: true });
		expect(result.dns).not.toHaveProperty("apexConfigured");
	});

	it("keeps going and marks the apex configured when only the activation check is refused", async () => {
		const { logger, step, zones } = setup();
		zones.requestActivationCheck.mockRejectedValueOnce(
			new Error("once per hour"),
		);

		await expect(step.execute(domainRow())).resolves.toMatchObject({
			dns: { apexConfigured: true },
		});
		expect(logger.warn).toHaveBeenCalledWith(
			`Cloudflare zone activation check refused for domain ${domainId}`,
			"once per hour",
		);
	});

	it("releases an apex hostname it just created when persisting its id loses the fence, and adopts nothing", async () => {
		const { customHostnames, logger, state, step } = setup();
		state.persistApexDns
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockRejectedValueOnce(new Error("Domain left status registering"))
			.mockRejectedValueOnce(new Error("Domain left status registering"));

		const result = await step.execute(domainRow());

		expect(
			customHostnames.deleteCustomHostname,
		).toHaveBeenCalledExactlyOnceWith("cf_apex");
		expect(result.dns).not.toHaveProperty("apexCustomHostnameId");
		expect(logger.warn).toHaveBeenCalledWith(
			`Failed to persist apex error for domain ${domainId}`,
			"Domain left status registering",
		);
	});

	it("does not release an adopted apex hostname when persistence fails", async () => {
		const { customHostnames, state, step } = setup();
		customHostnames.findCustomHostnameByName.mockResolvedValueOnce(
			customHostname("cf_apex_existing"),
		);
		state.persistApexDns
			.mockImplementationOnce(async (row, patch) => ({
				...row,
				dns: mergeDns(row.dns, patch),
			}))
			.mockRejectedValueOnce(new Error("fence lost"));

		await step.execute(domainRow());

		expect(customHostnames.deleteCustomHostname).not.toHaveBeenCalled();
	});

	it("truncates long provider messages in apexError", async () => {
		const { step, zones } = setup();
		zones.createZone.mockRejectedValueOnce(new Error("x".repeat(500)));

		const result = await step.execute(domainRow());

		expect((result.dns as { apexError: string }).apexError).toHaveLength(240);
	});

	describe("after configuration", () => {
		const configured = domainRow({
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				records: [],
				zoneId: "zone_1",
				zoneNameServers: nameServers,
				zoneStatus: "pending",
			},
			status: "configuring",
		});

		it("re-requests an activation check while the zone is pending and persists only a status change", async () => {
			const { events, state, step, zones } = setup();

			await expect(step.execute(configured)).resolves.toBe(configured);
			expect(events).toEqual(["get-zone-status", "activation-check"]);
			expect(state.persistApexDns).not.toHaveBeenCalled();

			zones.getZoneStatus.mockResolvedValueOnce("initializing");
			await expect(step.execute(configured)).resolves.toMatchObject({
				dns: { zoneStatus: "initializing" },
			});
			expect(state.persistApexDns).toHaveBeenCalledExactlyOnceWith(configured, {
				zoneStatus: "initializing",
			});
		});

		it("marks the zone active and nudges the apex hostname exactly once", async () => {
			const { customHostnames, events, state, step, zones } = setup();
			zones.getZoneStatus.mockImplementationOnce(async () => {
				events.push("get-zone-status");
				return "active";
			});

			const first = await step.execute(configured);

			expect(events).toEqual([
				"get-zone-status",
				"persist",
				"nudge-apex-hostname",
				"persist",
			]);
			expect(zones.requestActivationCheck).not.toHaveBeenCalled();
			expect(state.persistApexDns).toHaveBeenNthCalledWith(1, configured, {
				zoneActive: true,
				zoneStatus: "active",
			});
			expect(state.persistApexDns).toHaveBeenNthCalledWith(
				2,
				expect.anything(),
				{ apexCustomHostnameNudged: true, apexCustomHostnameStatus: "active" },
			);
			expect(
				customHostnames.refreshCustomHostnameValidation,
			).toHaveBeenCalledExactlyOnceWith("cf_apex");
			expect(first.dns).toMatchObject({
				apexCustomHostnameNudged: true,
				apexCustomHostnameStatus: "active",
				zoneActive: true,
			});

			events.length = 0;
			await expect(step.execute(first)).resolves.toBe(first);
			expect(events).toEqual([]);
		});

		it("logs and returns the latest row when polling fails, without an apexError write", async () => {
			const { logger, state, step, zones } = setup();
			zones.getZoneStatus.mockRejectedValueOnce(new Error("Cloudflare down"));

			await expect(step.execute(configured)).resolves.toBe(configured);
			expect(state.persistApexDns).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalledWith(
				`Apex zone verification deferred for domain ${domainId}`,
				"Cloudflare down",
			);
		});
	});
});
