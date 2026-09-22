import type { CallHandler, ExecutionContext } from "@nestjs/common";
import {
	GUARDS_METADATA,
	INTERCEPTORS_METADATA,
} from "@nestjs/common/constants";
import { lastValueFrom, of, throwError } from "rxjs";
import { describe, expect, it } from "vitest";

import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { CloudRateLimitedException } from "../../../application/services/cloud.service";
import {
	RATE_LIMIT_OPTIONS,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { CloudController, RetryAfterInterceptor } from "./cloud.controller";

describe("CloudController", () => {
	it("sits behind the V2 flag guard and the Redis rate-limit guard", () => {
		const guards = Reflect.getMetadata(GUARDS_METADATA, CloudController);
		// SAFETY: the metadata is the array UseGuards registered.
		expect(guards as unknown[]).toEqual([
			V2BuilderEnabledGuard,
			RedisRateLimitGuard,
		]);
	});

	it("requires project:update on the whole controller", () => {
		expect(
			Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, CloudController),
		).toEqual({ actions: ["update"], resource: "project" });
	});

	it("rate-limits the SQL route per user and no other route", () => {
		expect(
			Reflect.getMetadata(RATE_LIMIT_OPTIONS, CloudController.prototype.runSql),
		).toEqual({ key: "cloud-sql", limit: 30, windowMs: 60_000 });
		expect(
			Reflect.getMetadata(
				RATE_LIMIT_OPTIONS,
				CloudController.prototype.listTables,
			),
		).toBeUndefined();
	});

	it("adds the Retry-After interceptor", () => {
		const interceptors = Reflect.getMetadata(
			INTERCEPTORS_METADATA,
			CloudController,
		);
		// SAFETY: the metadata is the array UseInterceptors registered.
		expect(interceptors as unknown[]).toEqual([RetryAfterInterceptor]);
	});
});

describe("RetryAfterInterceptor", () => {
	function run(next: CallHandler) {
		const headers: Record<string, string> = {};
		const reply = {
			header: (name: string, value: string) => {
				headers[name] = value;
			},
		};
		// SAFETY: `Object.create` yields `any`; the stub exposes only the
		// reply lookup the interceptor calls.
		const context = Object.assign(Object.create(null), {
			switchToHttp: () => ({ getResponse: () => reply }),
		}) as ExecutionContext;
		return {
			headers,
			result: lastValueFrom(
				new RetryAfterInterceptor().intercept(context, next),
			),
		};
	}

	it("sets Retry-After from the exception and rethrows it", async () => {
		const { headers, result } = run({
			handle: () => throwError(() => new CloudRateLimitedException(7)),
		});

		await expect(result).rejects.toBeInstanceOf(CloudRateLimitedException);
		expect(headers).toEqual({ "Retry-After": "7" });
	});

	it("passes another error and a normal answer through untouched", async () => {
		const failure = run({ handle: () => throwError(() => new Error("boom")) });
		await expect(failure.result).rejects.toThrow("boom");
		expect(failure.headers).toEqual({});

		const success = run({ handle: () => of({ ok: true }) });
		await expect(success.result).resolves.toEqual({ ok: true });
		expect(success.headers).toEqual({});
	});
});
