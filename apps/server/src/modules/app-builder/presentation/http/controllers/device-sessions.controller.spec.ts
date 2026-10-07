import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { DeviceSessionsService } from "../../../application/services/device-sessions.service";
import {
	RATE_LIMIT_OPTIONS,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { DeviceSessionsController } from "./device-sessions.controller";

const PROJECT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SESSION_ID = "11111111-2222-4333-8444-555555555555";

// Fake logged-in user for controller method calls (same shape as the other V2 specs).
const user = {
	banned: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	email: "user@example.com",
	emailVerified: true,
	id: "user_1",
	name: "User",
	role: "user",
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies Parameters<DeviceSessionsController["start"]>[2];

const workspace = { kind: "personal" } as const satisfies Parameters<
	DeviceSessionsController["start"]
>[3];

function setup() {
	const service = {
		start: vi.fn<DeviceSessionsService["start"]>(),
		end: vi.fn<DeviceSessionsService["end"]>(async () => ({ ended: true })),
	};
	const controller = new DeviceSessionsController(service);
	return { controller, service };
}

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

	it("rate-limits both routes and asks the project update right to start only", () => {
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
		expect(
			Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, prototype.start),
		).toBeTruthy();
		expect(
			Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, prototype.end),
		).toBeUndefined();
	});

	it("passes the scope, the project, and the platform or the token to the service", async () => {
		const { controller, service } = setup();

		await controller.start(PROJECT_ID, { platform: "ios" }, user, workspace);
		await controller.end(
			PROJECT_ID,
			SESSION_ID,
			{ appetizeSessionToken: "tok_1" },
			user,
			workspace,
		);

		expect(service.start).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			PROJECT_ID,
			"ios",
		);
		expect(service.end).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			PROJECT_ID,
			SESSION_ID,
			"tok_1",
		);
	});
});
