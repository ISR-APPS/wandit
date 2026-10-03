import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import {
	type AppBuild,
	type AppPublishStatus,
	rollbackAppBodySchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { PublishService } from "../../../application/services/publish.service";
import {
	RATE_LIMIT_OPTIONS,
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
	id: "22222222-2222-4222-8222-222222222222",
	projectId: PROJECT_ID,
	sourceBuildId: null,
	status: "queued",
};
const STATUS: AppPublishStatus = { history: [], latestBuild: null, live: null };
const REQUEST_KEY = "33333333-3333-4333-8333-333333333333";

function setup() {
	const publish = {
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
	it("delegates each route with the scope", async () => {
		const { controller, publish } = setup();
		const rollback = { deploymentId: BUILD.id, requestKey: REQUEST_KEY };

		await controller.status(PROJECT_ID, user, workspace);
		await controller.publishHead(
			PROJECT_ID,
			{ requestKey: REQUEST_KEY },
			user,
			workspace,
		);
		await controller.rollback(PROJECT_ID, rollback, user, workspace);
		await controller.unpublish(PROJECT_ID, user, workspace);

		expect(publish.status).toHaveBeenCalledWith(SCOPE, PROJECT_ID);
		expect(publish.publishHead).toHaveBeenCalledWith(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});
		expect(publish.rollback).toHaveBeenCalledWith(SCOPE, PROJECT_ID, rollback);
		expect(publish.unpublish).toHaveBeenCalledWith(SCOPE, PROJECT_ID);
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
			[PublishController.prototype.unpublish, "app-unpublish"],
		] as const) {
			expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, handler)).toEqual({
				actions: ["manage"],
				resource: "publish",
			});
			expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler)).toEqual({
				key,
				limit: 10,
				windowMs: 600_000,
			});
		}
		const read = PublishController.prototype.status;
		expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, read)).toBeUndefined();
		expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, read)).toBeUndefined();
	});

	it("answers 202 on publish and rollback", () => {
		for (const handler of [
			PublishController.prototype.publishHead,
			PublishController.prototype.rollback,
		]) {
			expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(202);
		}
	});

	it("rejects a rollback body without a deployment id", () => {
		expect(() =>
			new ZodValidationPipe(rollbackAppBodySchema).transform(
				{ requestKey: REQUEST_KEY },
				{ type: "body" },
			),
		).toThrow(BadRequestException);
	});
});
