import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import type { AppBuild, AppPublishStatus } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { PublishService } from "../../../application/services/publish.service";
import {
	RATE_LIMIT_OPTIONS,
	type RateLimitOptions,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { PublishController } from "./publish.controller";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BUILD: AppBuild = {
	commitSha: "a".repeat(40),
	completedAt: null,
	createdAt: "2026-10-01T00:00:00.000Z",
	errorCode: null,
	gateFindings: [],
	gateOverride: false,
	id: "22222222-2222-4222-8222-222222222222",
	projectId: PROJECT_ID,
	sourceBuildId: null,
	status: "queued",
};
const STATUS: AppPublishStatus = {
	gateOverrideAllowed: false,
	history: [],
	latestBuild: null,
	live: null,
	suspension: null,
};
const REQUEST_KEY = "33333333-3333-4333-8333-333333333333";
// One `x-forwarded-for` hop and no trusted proxy list: `readClientIp`
// answers the hop, not the socket address.
const CLIENT_IP = "203.0.113.9";
const request = { headers: { "x-forwarded-for": CLIENT_IP }, ip: "10.0.0.2" };

function setup() {
	const publish = {
		overrideGate: vi.fn<PublishService["overrideGate"]>(async () => BUILD),
		publishHead: vi.fn<PublishService["publishHead"]>(async () => BUILD),
		rollback: vi.fn<PublishService["rollback"]>(async () => BUILD),
		status: vi.fn<PublishService["status"]>(async () => STATUS),
		unpublish: vi.fn<PublishService["unpublish"]>(async () => STATUS),
	};
	return { controller: new PublishController(publish), publish };
}

const SCOPE = { kind: "personal", userId: "user_1" };
// SAFETY: the controller reads only `user.id` for the scope.
const user = { id: "user_1" } as AuthUser;
const workspace: WorkspaceContext = { kind: "personal" };

describe("PublishController", () => {
	it("delegates each route with the scope, and rollback, override, and unpublish with the client IP", async () => {
		const { controller, publish } = setup();
		const rollback = { deploymentId: BUILD.id, requestKey: REQUEST_KEY };
		const override = { buildId: BUILD.id, requestKey: REQUEST_KEY };

		await controller.status(PROJECT_ID, user, workspace);
		await controller.publishHead(
			PROJECT_ID,
			{ requestKey: REQUEST_KEY },
			user,
			workspace,
		);
		await controller.rollback(PROJECT_ID, rollback, user, workspace, request);
		await controller.overrideGate(
			PROJECT_ID,
			override,
			user,
			workspace,
			request,
		);
		await controller.unpublish(PROJECT_ID, user, workspace, request);

		expect(publish.status).toHaveBeenCalledWith(SCOPE, PROJECT_ID);
		expect(publish.publishHead).toHaveBeenCalledWith(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});
		expect(publish.rollback).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			rollback,
			CLIENT_IP,
		);
		expect(publish.overrideGate).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			override,
			CLIENT_IP,
		);
		expect(publish.unpublish).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
			CLIENT_IP,
		);
	});
});

describe("PublishController route metadata", () => {
	it("sits behind the V2 flag guard and the Redis rate-limit guard", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, PublishController)).toEqual([
			V2BuilderEnabledGuard,
			RedisRateLimitGuard,
		]);
	});

	it("needs publish:manage and a rate limit on every write, and neither on the read", () => {
		for (const [handler, key] of [
			[PublishController.prototype.publishHead, "app-publish"],
			[PublishController.prototype.rollback, "app-publish-rollback"],
			[PublishController.prototype.overrideGate, "app-publish"],
			[PublishController.prototype.unpublish, "app-unpublish"],
		] as const) {
			expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, handler)).toEqual({
				actions: ["manage"],
				resource: "publish",
			});
			expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler)).toMatchObject({
				key,
			});
		}
		const read = PublishController.prototype.status;
		expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, read)).toBeUndefined();
		expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, read)).toBeUndefined();
	});

	// "Publish anyway" is a publish: it shares the bucket and the caps, so it
	// cannot get around them. WANDIT-181: the caps also count per client IP,
	// so one person with many accounts on one IP still hits a cap.
	it("counts a publish anyway in the publish bucket, per user and per client IP", () => {
		const publishLimit: RateLimitOptions = Reflect.getMetadata(
			RATE_LIMIT_OPTIONS,
			PublishController.prototype.publishHead,
		);

		expect(publishLimit).toMatchObject({ ipLimit: expect.any(Number) });
		expect(
			Reflect.getMetadata(
				RATE_LIMIT_OPTIONS,
				PublishController.prototype.overrideGate,
			),
		).toEqual(publishLimit);
	});
});
