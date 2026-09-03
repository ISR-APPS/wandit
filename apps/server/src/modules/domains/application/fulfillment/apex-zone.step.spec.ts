import type { DomainSource, RequiredDomainRecord } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApexZoneStep } from "./apex-zone.step";
import type {
	CustomerZone,
	CustomerZoneDnsRecord,
	CustomerZoneDnsRecordDeletion,
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

function setup(
	options: { enabled?: boolean; sources?: readonly DomainSource[] } = {},
) {
	const events: string[] = [];
	const zones = {
		createZone: vi.fn(async (_name: string) => {
			events.push("create-zone");
			return zone();
		}),
		deleteDnsRecords: vi.fn(
			async (_zoneId: string, input: CustomerZoneDnsRecordDeletion) => {
				events.push(`delete-records:${input.name}`);
				return 0;
			},
		),
		disableProxyOnAllRecords: vi.fn(async (_zoneId: string) => {
			events.push("disable-proxy");
			return 0;
		}),
		findZoneByName: vi.fn(
			async (_name: string): Promise<CustomerZone | null> => {
				events.push("find-zone");
				return null;
			},
		),
		getZoneStatus: vi.fn(async (_id: string): Promise<string | null> => {
			events.push("get-zone-status");
			return "pending";
		}),
		requestActivationCheck: vi.fn(async (_id: string) => {
			events.push("activation-check");
		}),
		scanDnsRecords: vi.fn(async (_zoneId: string) => {
			events.push("scan-dns");
			return { recordsAdded: 3, recordsParsed: 8 };
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
	const apexZoneStep = new ApexZoneStep(
		zones,
		customHostnames,
		registrar,
		state,
		logger,
		{
			enabled: options.enabled ?? true,
			fallbackOrigin,
			sources: options.sources ?? ["purchased"],
		},
	);

	return {
		customHostnames,
		events,
		logger,
		registrar,
		state,
		step: {
			execute: (
				row: DomainFulfillmentRow,
				execution = { allowZoneCreation: true },
			) => apexZoneStep.execute(row, execution),
		},
		zones,
	};
}

const trafficConflictDeletion = (name: string) =>
	({
		keepContent: fallbackOrigin,
		name,
		types: ["A", "AAAA", "CNAME"],
	}) satisfies CustomerZoneDnsRecordDeletion;

describe("ApexZoneStep", () => {
	it("creates the zone and apex hostname, writes zone records, delegates nameservers, and persists the marker", async () => {
		const input = domainRow();
		const { customHostnames, events, registrar, state, step, zones } = setup();

		const result = await step.execute(input);

		// The www records reach the zone before anything apex-specific can fail.
		expect(events).toEqual([
			"find-zone",
			"create-zone",
			"persist",
			"delete-records:www.example.com",
			"upsert:CNAME:www.example.com",
			"upsert:TXT:_cf-custom-hostname.www.example.com",
			"find-apex-hostname",
			"create-apex-hostname",
			"persist",
			"delete-records:example.com",
			"upsert:CNAME:example.com",
			"upsert:TXT:_cf-custom-hostname.example.com",
			"persist",
			"set-nameservers",
			"activation-check",
			"persist",
		]);
		// Purchased rows never import DNS: a fresh zone has nothing to import.
		expect(zones.scanDnsRecords).not.toHaveBeenCalled();
		expect(zones.disableProxyOnAllRecords).not.toHaveBeenCalled();
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
		// The apex hostname's TXT is written INTO the zone only, never merged into
		// dns.records (it is nothing the user must do).
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ id: domainId }),
			{
				apexCustomHostnameId: "cf_apex",
				apexCustomHostnameStatus: "pending_validation",
			},
		);
		// Conflicting address records make room for each traffic CNAME first.
		expect(zones.deleteDnsRecords.mock.calls).toEqual([
			["zone_1", trafficConflictDeletion("www.example.com")],
			["zone_1", trafficConflictDeletion("example.com")],
		]);
		expect(zones.upsertDnsRecord.mock.calls).toEqual([
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
					content: fallbackOrigin,
					name: "example.com",
					proxied: false,
					type: "CNAME",
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
		// Only the nameservers reach dns.records: the apex CNAME and TXT live
		// inside our zone.
		expect(state.persistApexDns).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({ id: domainId }),
			{
				apexConfigured: true,
				apexError: null,
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
			},
		);
		expect(result.dns).toEqual({
			apexConfigured: true,
			apexCustomHostnameId: "cf_apex",
			apexCustomHostnameStatus: "pending_validation",
			customHostnameDnsConfigured: true,
			purchaseDnsConfigured: true,
			records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
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
		// The persisted zone is only checked to still exist.
		expect(zones.getZoneStatus).toHaveBeenCalledExactlyOnceWith("zone_1");
		expect(customHostnames.findCustomHostnameByName).not.toHaveBeenCalled();
		expect(customHostnames.getCustomHostnameStatus).toHaveBeenCalledWith(
			"cf_apex",
		);
		expect(events.slice(0, 5)).toEqual([
			"get-zone-status",
			"delete-records:www.example.com",
			"upsert:CNAME:www.example.com",
			"upsert:TXT:_cf-custom-hostname.www.example.com",
			"get-apex-hostname",
		]);
	});

	it("withdraws a persisted zone that no longer exists and creates a new one in the same pass", async () => {
		const input = domainRow({
			dns: {
				apexCustomHostnameId: "cf_apex",
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
				zoneCreated: true,
				zoneDelegated: true,
				zoneId: "zone_gone",
				zoneNameServers: nameServers,
				zoneScanned: true,
				zoneStatus: "pending",
			},
		});
		const { events, logger, state, step, zones } = setup();
		zones.getZoneStatus.mockImplementationOnce(async () => {
			events.push("get-zone-status");
			return null;
		});
		zones.createZone.mockImplementationOnce(async () => {
			events.push("create-zone");
			return zone("zone_2", "pending");
		});

		const result = await step.execute(input);

		expect(events.slice(0, 5)).toEqual([
			"get-zone-status",
			"persist",
			"find-zone",
			"create-zone",
			"persist",
		]);
		expect(state.persistApexDns).toHaveBeenNthCalledWith(1, input, {
			apexConfigured: null,
			apexCustomHostnameNudged: null,
			apexError: "Cloudflare zone zone_gone no longer exists",
			records: [wwwTrafficRecord, wwwValidationRecord],
			zoneActive: null,
			zoneCreated: null,
			zoneDelegated: null,
			zoneId: null,
			zoneNameServers: null,
			zoneNameserversExposedAt: null,
			zoneScanRecordsAdded: null,
			zoneScanned: null,
			zoneStatus: null,
		});
		expect(logger.warn).toHaveBeenCalledWith(
			`Cloudflare zone zone_gone for domain ${domainId} no longer exists; its nameservers are withdrawn`,
		);
		expect(result.dns).toMatchObject({
			apexConfigured: true,
			apexCustomHostnameId: "cf_apex",
			zoneCreated: true,
			zoneId: "zone_2",
		});
		expect(result.dns).not.toHaveProperty("apexError");
	});

	it.each([
		[
			"external rows in a purchased composition",
			domainRow({ source: "external" }),
			{},
		],
		[
			"purchased rows in an external composition",
			domainRow(),
			{ sources: ["external"] as const },
		],
		["the kill switch", domainRow(), { enabled: false }],
		[
			"the kill switch of an external composition",
			domainRow({ source: "external" }),
			{ enabled: false, sources: ["external"] as const },
		],
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

	it("still finishes an external row that already exposed its zone when the kill switch is off", async () => {
		const input = domainRow({
			dns: {
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
				zoneCreated: true,
				zoneDelegated: true,
				zoneId: "zone_1",
				zoneNameServers: nameServers,
				zoneStatus: "pending",
			},
			source: "external",
		});
		const { events, registrar, step, zones } = setup({
			enabled: false,
			sources: ["external"],
		});

		const result = await step.execute(input);

		// No new zone; the exposed one gets its records, import, and hostname.
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
		expect(events).toContain("upsert:CNAME:www.example.com");
		expect(events).toContain("create-apex-hostname");
		expect(registrar.setNameservers).not.toHaveBeenCalled();
		expect(result.dns).toMatchObject({ apexConfigured: true });
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
		["a conflicting zone record delete", "deleteDnsRecords"],
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
			deleteDnsRecords: fixture.zones.deleteDnsRecords,
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

	describe("external rows", () => {
		const externalRow = (overrides: Partial<DomainFulfillmentRow> = {}) =>
			domainRow({
				dns: { records: [wwwTrafficRecord, wwwValidationRecord] },
				paymentOrderId: null,
				provider: null,
				providerDomainId: null,
				providerOrderId: null,
				providerTotalPaidUsd: null,
				source: "external",
				status: "configuring",
				...overrides,
			});
		const externalSetup = (options: { enabled?: boolean } = {}) => {
			const fixture = setup({ ...options, sources: ["external"] });

			return {
				...fixture,
				step: {
					execute: (
						row: DomainFulfillmentRow,
						execution = { allowZoneCreation: true },
					) => fixture.step.execute(row, execution),
				},
			};
		};

		it("does not find, adopt, or create a missing zone without explicit authorization", async () => {
			const input = externalRow();
			const { events, state, step, zones } = externalSetup();

			await expect(
				step.execute(input, { allowZoneCreation: false }),
			).resolves.toBe(input);

			expect(events).toEqual([]);
			expect(zones.findZoneByName).not.toHaveBeenCalled();
			expect(zones.createZone).not.toHaveBeenCalled();
			expect(state.persistApexDns).not.toHaveBeenCalled();
		});

		it("maintains a persisted zone id without nameserver metadata while creation is unauthorized", async () => {
			const input = externalRow({
				dns: {
					apexCustomHostnameId: "cf_apex",
					records: [wwwTrafficRecord, wwwValidationRecord],
					zoneId: "zone_legacy",
					zoneScanned: true,
					zoneStatus: "pending",
				},
			});
			const { step, zones } = externalSetup();

			await expect(
				step.execute(input, { allowZoneCreation: false }),
			).resolves.toMatchObject({ dns: { apexConfigured: true } });

			expect(zones.getZoneStatus).toHaveBeenCalledExactlyOnceWith(
				"zone_legacy",
			);
			expect(zones.findZoneByName).not.toHaveBeenCalled();
			expect(zones.createZone).not.toHaveBeenCalled();
		});

		it("creates the zone, exposes its nameservers at once, imports the existing DNS once, and configures the apex without any registrar call", async () => {
			const input = externalRow();
			const { events, registrar, state, step, zones } = externalSetup();
			registrar.setNameservers.mockRejectedValue(
				new Error("External domains delegate nameservers manually"),
			);

			const result = await step.execute(input);

			expect(events).toEqual([
				"find-zone",
				"create-zone",
				"persist",
				"scan-dns",
				"disable-proxy",
				"persist",
				"delete-records:www.example.com",
				"upsert:CNAME:www.example.com",
				"upsert:TXT:_cf-custom-hostname.www.example.com",
				"find-apex-hostname",
				"create-apex-hostname",
				"persist",
				"delete-records:example.com",
				"upsert:CNAME:example.com",
				"upsert:TXT:_cf-custom-hostname.example.com",
				"activation-check",
				"persist",
			]);
			expect(registrar.setNameservers).not.toHaveBeenCalled();
			// Nameservers + "may be delegated" marker land in ONE write with the zone.
			expect(state.persistApexDns).toHaveBeenNthCalledWith(1, input, {
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
				zoneCreated: true,
				zoneDelegated: true,
				zoneId: "zone_1",
				zoneNameServers: nameServers,
				zoneNameserversExposedAt: expect.any(String),
				zoneStatus: "pending",
			});
			expect(zones.scanDnsRecords).toHaveBeenCalledExactlyOnceWith("zone_1");
			expect(zones.disableProxyOnAllRecords).toHaveBeenCalledExactlyOnceWith(
				"zone_1",
			);
			expect(state.persistApexDns).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({ id: domainId }),
				{ zoneScanRecordsAdded: 3, zoneScanned: true },
			);
			expect(state.persistApexDns).toHaveBeenNthCalledWith(
				3,
				expect.objectContaining({ id: domainId }),
				{
					apexCustomHostnameId: "cf_apex",
					apexCustomHostnameStatus: "pending_validation",
				},
			);
			expect(zones.deleteDnsRecords.mock.calls).toEqual([
				["zone_1", trafficConflictDeletion("www.example.com")],
				["zone_1", trafficConflictDeletion("example.com")],
			]);
			expect(zones.upsertDnsRecord.mock.calls).toEqual([
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
						content: fallbackOrigin,
						name: "example.com",
						proxied: false,
						type: "CNAME",
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
						...nameserverRecords,
					],
				},
			);
			expect(result.dns).toEqual({
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				apexCustomHostnameStatus: "pending_validation",
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
				zoneCreated: true,
				zoneDelegated: true,
				zoneId: "zone_1",
				zoneNameServers: nameServers,
				zoneNameserversExposedAt: expect.any(String),
				zoneScanRecordsAdded: 3,
				zoneScanned: true,
				zoneStatus: "pending",
			});
		});

		it("maintains a persisted zone without creation authorization and still imports the DNS once", async () => {
			const input = externalRow({
				dns: {
					records: [
						wwwTrafficRecord,
						wwwValidationRecord,
						...nameserverRecords,
					],
					zoneCreated: true,
					zoneDelegated: true,
					zoneId: "zone_1",
					zoneNameServers: nameServers,
					zoneStatus: "pending",
				},
			});
			const { events, state, step, zones } = externalSetup();

			const result = await step.execute(input, {
				allowZoneCreation: false,
			});

			expect(zones.findZoneByName).not.toHaveBeenCalled();
			expect(zones.createZone).not.toHaveBeenCalled();
			expect(events.slice(0, 4)).toEqual([
				"get-zone-status",
				"scan-dns",
				"disable-proxy",
				"persist",
			]);
			expect(state.persistApexDns).toHaveBeenNthCalledWith(1, input, {
				zoneScanRecordsAdded: 3,
				zoneScanned: true,
			});
			expect(result.dns).toMatchObject({
				apexConfigured: true,
				zoneScanned: true,
			});
			// The nameserver merge is idempotent: no duplicates.
			expect((result.dns as { records: unknown[] }).records).toEqual([
				wwwTrafficRecord,
				wwwValidationRecord,
				...nameserverRecords,
			]);
		});

		it("withdraws a lost persisted zone without finding or creating a replacement when unauthorized", async () => {
			const exposedAt = "2026-08-01T00:00:00.000Z";
			const input = externalRow({
				dns: {
					records: [
						wwwTrafficRecord,
						wwwValidationRecord,
						...nameserverRecords,
					],
					zoneCreated: true,
					zoneDelegated: true,
					zoneId: "zone_gone",
					zoneNameServers: nameServers,
					zoneNameserversExposedAt: exposedAt,
					zoneScanned: true,
					zoneStatus: "pending",
				},
			});
			const { events, state, step, zones } = externalSetup();
			zones.getZoneStatus.mockImplementationOnce(async () => {
				events.push("get-zone-status");
				return null;
			});

			const result = await step.execute(input, {
				allowZoneCreation: false,
			});

			expect(events).toEqual(["get-zone-status", "persist"]);
			expect(zones.findZoneByName).not.toHaveBeenCalled();
			expect(zones.createZone).not.toHaveBeenCalled();
			expect(state.persistApexDns).toHaveBeenCalledExactlyOnceWith(input, {
				apexConfigured: null,
				apexCustomHostnameNudged: null,
				apexError: "Cloudflare zone zone_gone no longer exists",
				records: [wwwTrafficRecord, wwwValidationRecord],
				zoneActive: null,
				zoneCreated: null,
				zoneDelegated: null,
				zoneId: null,
				zoneNameServers: null,
				zoneNameserversExposedAt: null,
				zoneScanRecordsAdded: null,
				zoneScanned: null,
				zoneStatus: null,
			});
			expect(result.dns).toEqual({
				apexError: "Cloudflare zone zone_gone no longer exists",
				records: [wwwTrafficRecord, wwwValidationRecord],
			});
		});

		it("adopts a zone that already exists by name and still exposes its nameservers with the delegation marker", async () => {
			const { state, step, zones } = externalSetup();
			zones.findZoneByName.mockResolvedValueOnce(
				zone("zone_existing", "active"),
			);

			const result = await step.execute(externalRow());

			expect(zones.createZone).not.toHaveBeenCalled();
			expect(state.persistApexDns).toHaveBeenNthCalledWith(
				1,
				expect.anything(),
				{
					records: [
						wwwTrafficRecord,
						wwwValidationRecord,
						...nameserverRecords,
					],
					zoneDelegated: true,
					zoneId: "zone_existing",
					zoneNameServers: nameServers,
					zoneNameserversExposedAt: expect.any(String),
					zoneStatus: "active",
				},
			);
			expect(result.dns).not.toHaveProperty("zoneCreated");
			expect(result.dns).toMatchObject({
				apexConfigured: true,
				zoneDelegated: true,
			});
		});

		it("never imports DNS twice once the marker is set", async () => {
			const input = externalRow({
				dns: {
					records: [],
					zoneDelegated: true,
					zoneId: "zone_1",
					zoneNameServers: nameServers,
					zoneScanRecordsAdded: 0,
					zoneScanned: true,
					zoneStatus: "pending",
				},
			});
			const { step, zones } = externalSetup();

			await expect(step.execute(input)).resolves.toMatchObject({
				dns: { apexConfigured: true },
			});
			expect(zones.scanDnsRecords).not.toHaveBeenCalled();
			expect(zones.disableProxyOnAllRecords).not.toHaveBeenCalled();
		});

		it.each([
			[
				"the record scan",
				"scanDnsRecords",
				`Existing DNS import into the Cloudflare zone deferred for domain ${domainId}`,
			],
			[
				"the proxy normalization",
				"disableProxyOnAllRecords",
				`DNS-only normalization of the Cloudflare zone deferred for domain ${domainId}`,
			],
		] as const)("keeps going without the scan marker when %s fails, so a later pass retries", async (_label, method, warning) => {
			const fixture = externalSetup();
			fixture.zones[method].mockRejectedValueOnce(new Error(`${method} down`));

			const result = await fixture.step.execute(externalRow());

			expect(result.dns).toMatchObject({ apexConfigured: true });
			expect(result.dns).not.toHaveProperty("zoneScanned");
			expect(result.dns).not.toHaveProperty("zoneScanRecordsAdded");
			expect(result.dns).not.toHaveProperty("apexError");
			expect(fixture.logger.warn).toHaveBeenCalledWith(
				warning,
				`${method} down`,
			);
			expect(fixture.state.persistApexDns).not.toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ zoneScanned: true }),
			);
			// A timed-out scan can still have imported records server-side, so the
			// DNS-only normalization runs whatever the scan reported.
			expect(fixture.zones.scanDnsRecords).toHaveBeenCalledExactlyOnceWith(
				"zone_1",
			);
			expect(
				fixture.zones.disableProxyOnAllRecords,
			).toHaveBeenCalledExactlyOnceWith("zone_1");
		});

		it("records apexError and keeps the exposed nameservers when the apex hostname fails, with the www records already in the zone", async () => {
			const { customHostnames, events, registrar, step, zones } =
				externalSetup();
			customHostnames.createApexCustomHostname.mockRejectedValueOnce(
				new Error("hostname quota"),
			);

			const result = await step.execute(externalRow());

			expect(result.dns).toMatchObject({
				apexError: "hostname quota",
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
				zoneDelegated: true,
				zoneId: "zone_1",
				zoneScanned: true,
			});
			expect(result.dns).not.toHaveProperty("apexConfigured");
			expect(registrar.setNameservers).not.toHaveBeenCalled();
			// An owner who already delegated keeps www: its CNAME and ownership TXT
			// were written before the apex hostname; the apex CNAME waits for it.
			expect(zones.upsertDnsRecord.mock.calls).toEqual([
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
			]);
			expect(zones.deleteDnsRecords).toHaveBeenCalledExactlyOnceWith(
				"zone_1",
				trafficConflictDeletion("www.example.com"),
			);
			expect(events).not.toContain("upsert:CNAME:example.com");
		});

		it("never persists a lone delegation marker for external rows", async () => {
			const { state, step } = externalSetup();

			await step.execute(externalRow());

			expect(state.persistApexDns).not.toHaveBeenCalledWith(expect.anything(), {
				zoneDelegated: true,
			});
		});

		it("polls the zone after configuration like a purchased row and retries a deferred DNS import while the zone is pending", async () => {
			const configured = externalRow({
				dns: {
					apexConfigured: true,
					apexCustomHostnameId: "cf_apex",
					records: [],
					zoneDelegated: true,
					zoneId: "zone_1",
					zoneNameServers: nameServers,
					zoneStatus: "pending",
				},
			});
			const { events, state, step, zones } = externalSetup();

			const first = await step.execute(configured);

			expect(events).toEqual([
				"scan-dns",
				"disable-proxy",
				"persist",
				"get-zone-status",
				"activation-check",
			]);
			expect(state.persistApexDns).toHaveBeenCalledExactlyOnceWith(configured, {
				zoneScanRecordsAdded: 3,
				zoneScanned: true,
			});
			expect(first.dns).toMatchObject({ zoneScanned: true });

			events.length = 0;
			zones.getZoneStatus.mockImplementationOnce(async () => {
				events.push("get-zone-status");
				return "active";
			});
			const second = await step.execute(first);

			expect(events).toEqual([
				"get-zone-status",
				"persist",
				"nudge-apex-hostname",
				"persist",
			]);
			expect(zones.scanDnsRecords).toHaveBeenCalledOnce();
			expect(second.dns).toMatchObject({
				apexCustomHostnameNudged: true,
				zoneActive: true,
			});
		});

		it("does not retry the DNS import once the zone is active", async () => {
			const configured = externalRow({
				dns: {
					apexConfigured: true,
					apexCustomHostnameId: "cf_apex",
					apexCustomHostnameNudged: true,
					zoneActive: true,
					zoneDelegated: true,
					zoneId: "zone_1",
					zoneNameServers: nameServers,
				},
			});
			const { events, step } = externalSetup();

			await expect(step.execute(configured)).resolves.toBe(configured);
			expect(events).toEqual([]);
		});
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

		it("withdraws a zone that no longer exists: nameservers leave dns.records and the zone keys are cleared", async () => {
			const configuredWithNs = domainRow({
				dns: {
					apexConfigured: true,
					apexCustomHostnameId: "cf_apex",
					records: [
						wwwTrafficRecord,
						wwwValidationRecord,
						...nameserverRecords,
					],
					zoneCreated: true,
					zoneDelegated: true,
					zoneId: "zone_1",
					zoneNameServers: nameServers,
					zoneStatus: "pending",
				},
				status: "configuring",
			});
			const { events, logger, state, step, zones } = setup();
			zones.getZoneStatus.mockImplementationOnce(async () => {
				events.push("get-zone-status");
				return null;
			});

			const result = await step.execute(configuredWithNs);

			expect(events).toEqual(["get-zone-status", "persist"]);
			expect(zones.requestActivationCheck).not.toHaveBeenCalled();
			expect(state.persistApexDns).toHaveBeenCalledExactlyOnceWith(
				configuredWithNs,
				{
					apexConfigured: null,
					apexCustomHostnameNudged: null,
					apexError: "Cloudflare zone zone_1 no longer exists",
					records: [wwwTrafficRecord, wwwValidationRecord],
					zoneActive: null,
					zoneCreated: null,
					zoneDelegated: null,
					zoneId: null,
					zoneNameServers: null,
					zoneNameserversExposedAt: null,
					zoneScanRecordsAdded: null,
					zoneScanned: null,
					zoneStatus: null,
				},
			);
			expect(logger.warn).toHaveBeenCalledWith(
				`Cloudflare zone zone_1 for domain ${domainId} no longer exists; its nameservers are withdrawn`,
			);
			expect(result.dns).toEqual({
				apexCustomHostnameId: "cf_apex",
				apexError: "Cloudflare zone zone_1 no longer exists",
				records: [wwwTrafficRecord, wwwValidationRecord],
			});

			// The next pass configures again from scratch: a new zone, fresh
			// nameservers, and the kept apex hostname.
			events.length = 0;
			const next = await step.execute(result);

			expect(events.slice(0, 3)).toEqual([
				"find-zone",
				"create-zone",
				"persist",
			]);
			expect(next.dns).toMatchObject({
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				records: [wwwTrafficRecord, wwwValidationRecord, ...nameserverRecords],
				zoneId: "zone_1",
			});
			expect(next.dns).not.toHaveProperty("apexError");
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
