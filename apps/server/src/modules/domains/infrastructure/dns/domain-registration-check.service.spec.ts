import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainRegistrationCheckService } from "./domain-registration-check.service";

type SoaRecord = Awaited<
	ReturnType<typeof import("node:dns/promises").resolveSoa>
>;

const dnsMocks = vi.hoisted(() => ({
	cancel: vi.fn<() => void>(),
	onConstruct: vi.fn<(options: unknown) => void>(),
	resolveNs: vi.fn<(hostname: string) => Promise<string[]>>(),
	resolveSoa: vi.fn<(hostname: string) => Promise<SoaRecord>>(),
}));

vi.mock("node:dns/promises", () => ({
	Resolver: class MockResolver {
		cancel = dnsMocks.cancel;
		resolveNs = dnsMocks.resolveNs;
		resolveSoa = dnsMocks.resolveSoa;

		constructor(options: unknown) {
			dnsMocks.onConstruct(options);
		}
	},
}));

const soaRecord: SoaRecord = {
	expire: 604_800,
	hostmaster: "hostmaster.example.com",
	minttl: 300,
	nsname: "ns1.example.com",
	refresh: 3_600,
	retry: 600,
	serial: 2_026_083_001,
};

describe("DomainRegistrationCheckService", () => {
	const fetchMock = vi.fn<typeof fetch>();
	const service = new DomainRegistrationCheckService();

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		for (const resolver of Object.values(dnsMocks)) {
			resolver.mockReset();
		}
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("reports a domain as registered when NS records resolve", async () => {
		dnsMocks.resolveNs.mockResolvedValue(["ns1.example.com"]);
		dnsMocks.resolveSoa.mockRejectedValue(dnsError("ESERVFAIL"));

		await expect(service.check("example.com")).resolves.toEqual({
			status: "registered",
		});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(dnsMocks.onConstruct).toHaveBeenCalledExactlyOnceWith({
			timeout: 2_500,
			tries: 1,
		});
	});

	it("reports a domain as registered from SOA when NS is unavailable", async () => {
		dnsMocks.resolveNs.mockRejectedValue(dnsError("ENODATA"));
		dnsMocks.resolveSoa.mockResolvedValue(soaRecord);

		await expect(service.check("example.com")).resolves.toEqual({
			status: "registered",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("confirms a nonexistent DNS domain as unregistered with RDAP 404", async () => {
		mockNonexistentDomain();
		fetchMock.mockResolvedValue(
			rdapResponse({
				redirected: true,
				status: 404,
				url: "https://rdap.example/domain/missing.example",
			}),
		);

		await expect(service.check("missing.example")).resolves.toEqual({
			status: "unregistered",
		});
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			"https://rdap.org/domain/missing.example",
			{ signal: expect.any(AbortSignal) },
		);
	});

	it("fails open when RDAP has no authoritative service for the TLD", async () => {
		mockNonexistentDomain();
		fetchMock.mockResolvedValue(
			rdapResponse({
				redirected: false,
				status: 404,
				url: "https://rdap.org/domain/missing.unsupported",
			}),
		);

		await expect(service.check("missing.unsupported")).resolves.toEqual({
			reason: "RDAP has no authoritative service for this TLD",
			status: "inconclusive",
		});
	});

	it("treats RDAP 200 as registered after NXDOMAIN", async () => {
		mockNonexistentDomain();
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

		await expect(service.check("registered.example")).resolves.toEqual({
			status: "registered",
		});
	});

	it("fails open when RDAP times out after NXDOMAIN", async () => {
		mockNonexistentDomain();
		fetchMock.mockRejectedValue(
			Object.assign(new Error("The operation timed out"), {
				name: "TimeoutError",
			}),
		);

		await expect(service.check("unknown.example")).resolves.toEqual({
			reason: "RDAP registration lookup failed: The operation timed out",
			status: "inconclusive",
		});
	});

	it.each([
		500, 503, 429,
	])("fails open when RDAP returns HTTP %i after NXDOMAIN", async (status) => {
		mockNonexistentDomain();
		fetchMock.mockResolvedValue(new Response(null, { status }));

		await expect(service.check("unknown.example")).resolves.toEqual({
			reason: `RDAP registration lookup returned HTTP ${status}`,
			status: "inconclusive",
		});
	});

	it("tolerates an arbitrary NXDOMAIN error code", async () => {
		dnsMocks.resolveNs.mockRejectedValue(dnsError("NXDOMAIN"));
		dnsMocks.resolveSoa.mockRejectedValue(dnsError("NXDOMAIN"));
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

		await expect(service.check("registered.example")).resolves.toEqual({
			status: "registered",
		});
	});

	it("fails open when DNS queries time out", async () => {
		vi.useFakeTimers();
		dnsMocks.resolveNs.mockReturnValue(new Promise(() => undefined));
		dnsMocks.resolveSoa.mockReturnValue(new Promise(() => undefined));

		const pending = service.check("unknown.example");
		await vi.advanceTimersByTimeAsync(3_000);

		await expect(pending).resolves.toEqual({
			reason: "DNS registration lookup was inconclusive",
			status: "inconclusive",
		});
		expect(dnsMocks.cancel).toHaveBeenCalledExactlyOnceWith();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fails open when DNS returns ESERVFAIL", async () => {
		dnsMocks.resolveNs.mockRejectedValue(dnsError("ESERVFAIL"));
		dnsMocks.resolveSoa.mockRejectedValue(dnsError("ESERVFAIL"));

		await expect(service.check("unknown.example")).resolves.toEqual({
			reason: "DNS registration lookup was inconclusive",
			status: "inconclusive",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

function dnsError(code: string): Error & { code: string } {
	return Object.assign(new Error(`DNS lookup failed with ${code}`), { code });
}

function mockNonexistentDomain() {
	dnsMocks.resolveNs.mockRejectedValue(dnsError("ENOTFOUND"));
	dnsMocks.resolveSoa.mockRejectedValue(dnsError("ENOTFOUND"));
}

function rdapResponse({
	redirected,
	status,
	url,
}: {
	redirected: boolean;
	status: number;
	url: string;
}): Response {
	return { redirected, status, url } as Response;
}
