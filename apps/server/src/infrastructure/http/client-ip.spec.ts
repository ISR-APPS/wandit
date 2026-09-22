import { describe, expect, it } from "vitest";

import { readClientIp } from "./client-ip";

function request(forwarded: string | string[] | undefined, ip = "10.0.0.2") {
	return { headers: { "x-forwarded-for": forwarded }, ip };
}

describe("readClientIp", () => {
	it("answers the first x-forwarded-for hop", () => {
		expect(readClientIp(request("203.0.113.9, 10.0.0.1"))).toBe("203.0.113.9");
	});

	it("reads the first entry of a repeated header", () => {
		expect(readClientIp(request(["203.0.113.9", "10.0.0.1"]))).toBe(
			"203.0.113.9",
		);
	});

	it("falls back to the socket address without the header", () => {
		expect(readClientIp(request(undefined))).toBe("10.0.0.2");
		expect(readClientIp(request(" , 10.0.0.1"))).toBe("10.0.0.2");
	});
});
