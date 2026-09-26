import { describe, expect, it } from "vitest";

import {
	buildNetworkPolicy,
	GLOBAL_ALLOWED_HOSTS,
	isSupabaseHost,
	isValidNetworkHost,
	SANDBOX_DENIED_RANGES,
} from "./network-policy";

const INPUT: Parameters<typeof buildNetworkPolicy>[0] = {
	assetHost: null,
	backendHost: null,
	connectorHosts: [],
	gitHost: null,
	mode: "strict",
	projectHosts: [],
	proxyBaseUrl: "https://abc-def.trycloudflare.com/api/v2/llm",
};

describe("SANDBOX_DENIED_RANGES", () => {
	it("carries the six IPv4 ranges only; the vendor API rejects IPv6 CIDRs", () => {
		// Pins the LIMIT in network-policy.ts: fd00:ec2::/32, fd20:ce::/32,
		// and ::1/128 join when the vendor accepts IPv6.
		expect([...SANDBOX_DENIED_RANGES]).toEqual([
			"169.254.0.0/16",
			"10.0.0.0/8",
			"172.16.0.0/12",
			"192.168.0.0/16",
			"100.64.0.0/10",
			"127.0.0.0/8",
		]);
	});
});

describe("isValidNetworkHost", () => {
	it.each([
		"api.example.com",
		"*.example.com",
		"a-b.c-d.example.co",
		"registry.npmjs.org",
	])("accepts %s", (host) => {
		expect(isValidNetworkHost(host)).toBe(true);
	});

	it.each([
		"example.com:8080",
		"https://example.com",
		"user@example.com",
		"example.com/path",
		"example.com.",
		"1.2.3.4",
		"::1",
		"fe80::1",
		"*",
		"*.co",
		"*.*.com",
		"a.*.b",
		"ex*ample.com",
		"localhost",
		"metadata",
		"Example.com",
		"-bad.com",
		"bad-.com",
		"example.c",
		"",
	])("rejects %s", (host) => {
		expect(isValidNetworkHost(host)).toBe(false);
	});
});

describe("buildNetworkPolicy strict", () => {
	it("merges the global list, the proxy host, and caller hosts deduped and sorted", () => {
		const built = buildNetworkPolicy({
			...INPUT,
			assetHost: "assets.example.com",
			gitHost: "acme.code.storage",
			projectHosts: [
				"api.example.com",
				"api.example.com",
				"  cdn.example.com  ",
			],
		});

		expect(built.policy.allowedHosts).toEqual(
			[
				...GLOBAL_ALLOWED_HOSTS,
				"abc-def.trycloudflare.com",
				"acme.code.storage",
				"assets.example.com",
				"api.example.com",
				"cdn.example.com",
			].sort(),
		);
		expect(built.rejected).toEqual([]);
		expect(built.policy.deniedRanges).toEqual([...SANDBOX_DENIED_RANGES]);
	});

	it("moves invalid caller hosts to rejected with the original spelling", () => {
		const built = buildNetworkPolicy({
			...INPUT,
			projectHosts: [
				"example.com:8080",
				"1.2.3.4",
				"*",
				"*.co",
				"a.*.b",
				"localhost",
				"Example.com",
				"-bad.com",
				"*.example.com",
				"api.example.com",
			],
		});

		expect(built.rejected).toEqual([
			"example.com:8080",
			"1.2.3.4",
			"*",
			"*.co",
			"a.*.b",
			"localhost",
			"Example.com",
			"-bad.com",
		]);
		expect(built.policy.allowedHosts).toContain("*.example.com");
		expect(built.policy.allowedHosts).toContain("api.example.com");
	});

	it("rejects an upper-case caller host with its given spelling", () => {
		// The contract's spec list puts `Example.com` in rejected, so the
		// check sees the given case instead of lower-casing it first.
		const built = buildNetworkPolicy({
			...INPUT,
			projectHosts: [" Api.Example.com "],
		});

		expect(built.rejected).toEqual([" Api.Example.com "]);
		expect(built.policy.allowedHosts).not.toContain("api.example.com");
	});

	it("rejects a connector host the same way", () => {
		const built = buildNetworkPolicy({
			...INPUT,
			connectorHosts: ["hooks.slack.com", "not a host"],
		});

		expect(built.policy.allowedHosts).toContain("hooks.slack.com");
		expect(built.rejected).toEqual(["not a host"]);
	});

	it("throws when the proxy URL is not a URL", () => {
		expect(() =>
			buildNetworkPolicy({ ...INPUT, proxyBaseUrl: "not a url" }),
		).toThrow(/not a URL/);
	});

	it("throws when the proxy host fails the host check", () => {
		expect(() =>
			buildNetworkPolicy({ ...INPUT, proxyBaseUrl: "http://localhost:3000" }),
		).toThrow(/proxy host "localhost"/);
	});

	it("throws when a configured git or asset host is invalid", () => {
		expect(() =>
			buildNetworkPolicy({ ...INPUT, gitHost: "localhost" }),
		).toThrow(/gitHost "localhost"/);
		expect(() =>
			buildNetworkPolicy({ ...INPUT, assetHost: "10.0.0.1" }),
		).toThrow(/assetHost "10.0.0.1"/);
	});
});

describe("isSupabaseHost", () => {
	it.each([
		"supabase.co",
		"abc.supabase.co",
		"*.supabase.co",
	])("matches %s", (host) => {
		expect(isSupabaseHost(host)).toBe(true);
	});

	it.each([
		"evilsupabase.co",
		"supabase.co.evil.com",
		"supabase.com",
	])("does not match %s", (host) => {
		expect(isSupabaseHost(host)).toBe(false);
	});
});

describe("buildNetworkPolicy backend host (WANDIT-283)", () => {
	const BACKEND_HOST = "abcdefghijklmnopqrst.supabase.co";
	const supabaseHosts = (hosts: string[]) =>
		hosts.filter((host) => host.endsWith("supabase.co"));

	it("keeps every Supabase host out of the global list", () => {
		expect(supabaseHosts([...GLOBAL_ALLOWED_HOSTS])).toEqual([]);
	});

	it("allows exactly the project's own Supabase host", () => {
		const built = buildNetworkPolicy({ ...INPUT, backendHost: BACKEND_HOST });

		expect(supabaseHosts(built.policy.allowedHosts)).toEqual([BACKEND_HOST]);
	});

	it("allows no Supabase host without a backend", () => {
		const built = buildNetworkPolicy(INPUT);

		expect(supabaseHosts(built.policy.allowedHosts)).toEqual([]);
	});

	it("throws when the backend host is not a valid host", () => {
		expect(() =>
			buildNetworkPolicy({
				...INPUT,
				backendHost: "https://abcdefghijklmnopqrst.supabase.co",
			}),
		).toThrow(/backendHost "https:\/\/abcdefghijklmnopqrst.supabase.co"/);
		expect(() =>
			buildNetworkPolicy({ ...INPUT, backendHost: "localhost" }),
		).toThrow(/backendHost "localhost" is not a valid network host/);
	});

	it("rejects a stored Supabase caller host other than the backend host", () => {
		const built = buildNetworkPolicy({
			...INPUT,
			backendHost: BACKEND_HOST,
			connectorHosts: ["other.supabase.co"],
			projectHosts: ["*.supabase.co", BACKEND_HOST, "api.example.com"],
		});

		expect(supabaseHosts(built.policy.allowedHosts)).toEqual([BACKEND_HOST]);
		expect(built.rejected).toEqual(["*.supabase.co", "other.supabase.co"]);
		expect(built.policy.allowedHosts).toContain("api.example.com");
	});

	it("throws when the backend host is a wildcard", () => {
		expect(() =>
			buildNetworkPolicy({ ...INPUT, backendHost: "*.supabase.co" }),
		).toThrow(/backendHost "\*\.supabase\.co" must not be a wildcard/);
	});
});

describe("buildNetworkPolicy open", () => {
	it("allows every host and keeps the deny ranges", () => {
		const built = buildNetworkPolicy({
			...INPUT,
			mode: "open",
			projectHosts: ["not a host"],
			proxyBaseUrl: "",
		});

		expect(built.policy.allowedHosts).toEqual(["*"]);
		expect(built.policy.deniedRanges).toEqual([...SANDBOX_DENIED_RANGES]);
		expect(built.rejected).toEqual([]);
	});
});
