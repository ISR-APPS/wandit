import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { createMobileBuildBodySchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { PROJECT_ROLE_KEY } from "../../../../projects";
import {
	RATE_LIMIT_OPTIONS,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { MobileBuildsController } from "./mobile-builds.controller";

describe("MobileBuildsController route metadata", () => {
	it("sits behind the V2 flag guard and the Redis rate-limit guard", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, MobileBuildsController),
		).toEqual([V2BuilderEnabledGuard, RedisRateLimitGuard]);
	});

	it("needs the editor role on the whole controller", () => {
		expect(
			Reflect.getMetadata(PROJECT_ROLE_KEY, MobileBuildsController),
		).toEqual({ anyEngine: false, role: "editor" });
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
