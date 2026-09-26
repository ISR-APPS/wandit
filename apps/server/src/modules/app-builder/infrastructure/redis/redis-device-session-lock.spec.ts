import { describe, expect, it } from "vitest";

import { deviceSessionLockKey } from "./redis-device-session-lock";

describe("deviceSessionLockKey", () => {
	it("keys the lock by user, the key of the WANDIT-196 description", () => {
		expect(deviceSessionLockKey("user-1")).toBe("mobile_preview:user:user-1");
	});
});
