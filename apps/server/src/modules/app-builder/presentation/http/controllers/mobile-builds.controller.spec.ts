import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import {
	createMobileBuildBodySchema,
	type MobileBuild,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { MobileBuildsService } from "../../../application/services/mobile-builds.service";
import {
	RATE_LIMIT_OPTIONS,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { MobileBuildsController } from "./mobile-builds.controller";

const BUILD: MobileBuild = {
	artifactUrl: null,
	commitSha: "a".repeat(40),
	completedAt: null,
	createdAt: "2026-09-26T00:00:00.000Z",
	errorCode: null,
	id: "22222222-2222-4222-8222-222222222222",
	kind: "apk",
	platform: "android",
	projectId: "11111111-1111-4111-8111-111111111111",
	status: "queued",
};

function setup() {
	const builds = {
		cancel: vi.fn<MobileBuildsService["cancel"]>(async () => BUILD),
		create: vi.fn<MobileBuildsService["create"]>(async () => BUILD),
		get: vi.fn<MobileBuildsService["get"]>(async () => BUILD),
		list: vi.fn<MobileBuildsService["list"]>(async () => ({
			items: [BUILD],
			nextCursor: null,
		})),
	};
	return { builds, controller: new MobileBuildsController(builds) };
}

const SCOPE = { kind: "personal", userId: "user_1" };
// SAFETY: the controller reads only `user.id` for the scope.
const user = { id: "user_1" } as AuthUser;
const workspace: WorkspaceContext = { kind: "personal" };
const request = {
	headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
	ip: "10.0.0.2",
};

describe("MobileBuildsController", () => {
	it("list delegates the scope and the parsed query", async () => {
		const { builds, controller } = setup();

		await controller.list(BUILD.projectId, { limit: 20 }, user, workspace);

		expect(builds.list).toHaveBeenCalledWith(SCOPE, BUILD.projectId, {
			limit: 20,
		});
	});

	it("create delegates the body with the first forwarded IP", async () => {
		const { builds, controller } = setup();
		const body = {
			platform: "android",
			requestKey: "33333333-3333-4333-8333-333333333333",
		} as const;

		const result = await controller.create(
			BUILD.projectId,
			body,
			user,
			workspace,
			request,
		);

		expect(result).toEqual(BUILD);
		expect(builds.create).toHaveBeenCalledWith(
			SCOPE,
			BUILD.projectId,
			body,
			"203.0.113.9",
		);
	});

	it("get and cancel delegate the build id", async () => {
		const { builds, controller } = setup();

		await controller.get(BUILD.projectId, BUILD.id, user, workspace);
		await controller.cancel(
			BUILD.projectId,
			BUILD.id,
			user,
			workspace,
			request,
		);

		expect(builds.get).toHaveBeenCalledWith(SCOPE, BUILD.projectId, BUILD.id);
		expect(builds.cancel).toHaveBeenCalledWith(
			SCOPE,
			BUILD.projectId,
			BUILD.id,
			"203.0.113.9",
		);
	});
});

describe("MobileBuildsController route metadata", () => {
	it("sits behind the V2 flag guard and the Redis rate-limit guard", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, MobileBuildsController),
		).toEqual([V2BuilderEnabledGuard, RedisRateLimitGuard]);
	});

	it("requires project:update on the whole controller", () => {
		expect(
			Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, MobileBuildsController),
		).toEqual({ actions: ["update"], resource: "project" });
	});

	it("rate-limits create and cancel, and no read route", () => {
		expect(
			Reflect.getMetadata(
				RATE_LIMIT_OPTIONS,
				MobileBuildsController.prototype.create,
			),
		).toEqual({ key: "mobile-build-create", limit: 10, windowMs: 600_000 });
		expect(
			Reflect.getMetadata(
				RATE_LIMIT_OPTIONS,
				MobileBuildsController.prototype.cancel,
			),
		).toEqual({ key: "mobile-build-cancel", limit: 10, windowMs: 600_000 });
		for (const handler of [
			MobileBuildsController.prototype.list,
			MobileBuildsController.prototype.get,
		]) {
			expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler)).toBeUndefined();
		}
	});

	it("answers 200 on cancel and the POST default 201 on create", () => {
		expect(
			Reflect.getMetadata(
				HTTP_CODE_METADATA,
				MobileBuildsController.prototype.cancel,
			),
		).toBe(200);
		expect(
			Reflect.getMetadata(
				HTTP_CODE_METADATA,
				MobileBuildsController.prototype.create,
			),
		).toBeUndefined();
	});

	it("rejects an iOS body in the create pipe", () => {
		expect(() =>
			new ZodValidationPipe(createMobileBuildBodySchema).transform(
				{ platform: "ios", requestKey: "33333333-3333-4333-8333-333333333333" },
				{ type: "body" },
			),
		).toThrow(BadRequestException);
	});
});
