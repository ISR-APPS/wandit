import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { PROJECT_ROLE_KEY } from "../../../../projects";
import {
	RATE_LIMIT_OPTIONS,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { DeviceSessionsController } from "./device-sessions.controller";

describe("DeviceSessionsController", () => {
	it("sits behind the V2BuilderEnabledGuard and the RedisRateLimitGuard", () => {
		const guards: unknown = Reflect.getMetadata(
			GUARDS_METADATA,
			DeviceSessionsController,
		);
		expect(guards).toEqual(
			expect.arrayContaining([V2BuilderEnabledGuard, RedisRateLimitGuard]),
		);
	});

	it("rate-limits both routes and asks the editor role on both", () => {
		const { prototype } = DeviceSessionsController;
		expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, prototype.start)).toEqual({
			key: "device-session-start",
			limit: 10,
			windowMs: 60_000,
		});
		expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, prototype.end)).toEqual({
			key: "device-session-end",
			limit: 30,
			windowMs: 60_000,
		});
		expect(Reflect.getMetadata(PROJECT_ROLE_KEY, prototype.start)).toEqual({
			anyEngine: false,
			role: "editor",
		});
		expect(Reflect.getMetadata(PROJECT_ROLE_KEY, prototype.end)).toEqual({
			anyEngine: false,
			role: "editor",
		});
	});
});
