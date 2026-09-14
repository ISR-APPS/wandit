import { describe, expect, it } from "vitest";

import { TURN_LOCK_TTL_MS, turnLockRedis } from "./redis-turn-lock";

describe("turnLockRedis", () => {
	it("keys the lock by project", () => {
		expect(turnLockRedis.key("p-1")).toBe("builder:lock:p-1");
	});

	it("refreshes only when the stored turn id matches", () => {
		expect(turnLockRedis.refreshScript).toBe(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`);
	});

	it("releases only when the stored turn id matches", () => {
		expect(turnLockRedis.releaseScript).toBe(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`);
	});

	it("keeps the TTL at 30 minutes", () => {
		expect(TURN_LOCK_TTL_MS).toBe(30 * 60_000);
	});
});
