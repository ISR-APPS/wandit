import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { PROJECT_ROLE_KEY } from "../../../../projects";
import {
	RATE_LIMIT_OPTIONS,
	type RateLimitOptions,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { PublishController } from "./publish.controller";

describe("PublishController route metadata", () => {
	it("sits behind the V2 flag guard and the Redis rate-limit guard", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, PublishController)).toEqual([
			V2BuilderEnabledGuard,
			RedisRateLimitGuard,
		]);
	});

	// "Publish anyway" ships a build that failed the gate, so only the owner may.
	it("needs the editor role and a rate limit on every write, the owner role on publish anyway", () => {
		for (const [handler, key, role] of [
			[PublishController.prototype.publishHead, "app-publish", "editor"],
			[PublishController.prototype.rollback, "app-publish-rollback", "editor"],
			[PublishController.prototype.overrideGate, "app-publish", "owner"],
			[PublishController.prototype.unpublish, "app-unpublish", "editor"],
		] as const) {
			expect(Reflect.getMetadata(PROJECT_ROLE_KEY, handler)).toEqual({
				anyEngine: false,
				role,
			});
			expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler)).toMatchObject({
				key,
			});
		}
		const read = PublishController.prototype.status;
		expect(Reflect.getMetadata(PROJECT_ROLE_KEY, read)).toEqual({
			anyEngine: false,
			role: "viewer",
		});
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
