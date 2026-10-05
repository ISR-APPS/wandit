import { describe, expect, it } from "vitest";

import { readClientIp, readTrustedClientIp } from "./client-ip";

function request(forwarded: string | string[] | undefined, ip = "10.0.0.2") {
	return { headers: { "x-forwarded-for": forwarded }, ip };
}

describe("readTrustedClientIp", () => {
	it("answers a single valid hop", () => {
		expect(readTrustedClientIp(request("203.0.113.9"))).toBe("203.0.113.9");
	});

	// Security: the client writes the first hop, so with no trusted proxy
	// list a two-hop header must not give the client its chosen value.
	it.each([
		["a spoofed hop before the proxy hop", "6.6.6.6, 203.0.113.9", "6.6.6.6"],
		["a repeated header", ["6.6.6.6", "203.0.113.9"], "6.6.6.6"],
		["text that is not an IP", "x".repeat(64), "x".repeat(64)],
	])("never answers the client value for %s", (_name, forwarded, clientValue) => {
		expect(readClientIp(request(forwarded))).not.toBe(clientValue);
	});
});
