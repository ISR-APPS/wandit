import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { ProductSettings } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../../infrastructure/analytics/analytics.service";
import type { ProductSettingsService } from "../../../../settings";
import { V2_BUILDER_DISABLED_ERROR_CODE } from "../../../domain/errors/v2-builder-disabled.error";
import { V2BuilderEnabledGuard } from "./v2-builder-enabled.guard";

function settings(overrides: Partial<ProductSettings> = {}): ProductSettings {
	return {
		dzdPerUsdRate: 27_000,
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled: false,
		manualGraceDays: 0,
		manualPaymentsEnabled: false,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: false,
		signupGrantCredits: 2000,
		signupGrantEnabled: false,
		topupsEnabled: false,
		updatedAt: "2026-08-01T10:00:00.000Z",
		updatedByUserId: null,
		v2BuilderEnabled: false,
		version: 1,
		...overrides,
	};
}

function settingsServiceFor(value: ProductSettings): ProductSettingsService {
	const fake: Pick<ProductSettingsService, "get"> = {
		get: vi.fn(async () => value),
	};
	// SAFETY: the guard only calls .get() on this dependency.
	return fake as ProductSettingsService;
}

function analyticsServiceFor(
	answer: boolean | undefined | Error,
): AnalyticsService {
	const fake: Pick<AnalyticsService, "isFeatureEnabled"> = {
		isFeatureEnabled:
			answer instanceof Error
				? vi.fn(async () => Promise.reject(answer))
				: vi.fn(async () => answer),
	};
	// SAFETY: the guard only calls .isFeatureEnabled() on this dependency.
	return fake as AnalyticsService;
}

function contextFor(userId: string | null): ExecutionContext {
	// SAFETY: the guard only calls switchToHttp().getRequest() and reads user.id.
	return {
		switchToHttp: () => ({
			getRequest: () => ({ user: userId ? { id: userId } : undefined }),
		}),
	} as ExecutionContext;
}

async function expectDisabled(guard: V2BuilderEnabledGuard): Promise<void> {
	try {
		await guard.canActivate(contextFor("user_1"));
	} catch (error) {
		expect(error).toBeInstanceOf(ForbiddenException);
		// SAFETY: the instanceof check above proves the type.
		const thrown = error as ForbiddenException;
		expect(thrown.getStatus()).toBe(403);
		expect(thrown.getResponse()).toMatchObject({
			code: V2_BUILDER_DISABLED_ERROR_CODE,
		});
		return;
	}
	throw new Error("guard did not deny the request");
}

describe("V2BuilderEnabledGuard", () => {
	it("passes when the product setting and the flag are on", async () => {
		const guard = new V2BuilderEnabledGuard(
			settingsServiceFor(settings({ v2BuilderEnabled: true })),
			analyticsServiceFor(true),
		);

		await expect(guard.canActivate(contextFor("user_1"))).resolves.toBe(true);
	});

	it("denies with 403 when the product setting is off", async () => {
		const analytics: Pick<AnalyticsService, "isFeatureEnabled"> = {
			isFeatureEnabled: vi.fn(async () => true),
		};
		const guard = new V2BuilderEnabledGuard(
			settingsServiceFor(settings()),
			// SAFETY: the guard only calls .isFeatureEnabled() on this dependency.
			analytics as AnalyticsService,
		);

		await expectDisabled(guard);
		// The flag is never asked when the setting already denies.
		expect(analytics.isFeatureEnabled).not.toHaveBeenCalled();
	});

	it("denies with 403 when the flag is off for the user", async () => {
		const guard = new V2BuilderEnabledGuard(
			settingsServiceFor(settings({ v2BuilderEnabled: true })),
			analyticsServiceFor(false),
		);

		await expectDisabled(guard);
	});

	it("passes on the setting alone when analytics resolves undefined", async () => {
		const guard = new V2BuilderEnabledGuard(
			settingsServiceFor(settings({ v2BuilderEnabled: true })),
			analyticsServiceFor(undefined),
		);

		await expect(guard.canActivate(contextFor("user_1"))).resolves.toBe(true);
	});

	it("denies with 403 when PostHog throws", async () => {
		const guard = new V2BuilderEnabledGuard(
			settingsServiceFor(settings({ v2BuilderEnabled: true })),
			analyticsServiceFor(new Error("posthog down")),
		);

		await expectDisabled(guard);
	});

	it("answers from the cache on a second call within 60 seconds", async () => {
		const isFeatureEnabled = vi.fn(async () => true);
		const analytics: Pick<AnalyticsService, "isFeatureEnabled"> = {
			isFeatureEnabled,
		};
		const guard = new V2BuilderEnabledGuard(
			settingsServiceFor(settings({ v2BuilderEnabled: true })),
			// SAFETY: the guard only calls .isFeatureEnabled() on this dependency.
			analytics as AnalyticsService,
		);

		await guard.canActivate(contextFor("user_1"));
		await guard.canActivate(contextFor("user_1"));

		expect(isFeatureEnabled).toHaveBeenCalledTimes(1);
	});

	it("asks PostHog again after the 60 second cache entry expires", async () => {
		vi.useFakeTimers();
		try {
			const isFeatureEnabled = vi.fn(async () => true);
			const analytics: Pick<AnalyticsService, "isFeatureEnabled"> = {
				isFeatureEnabled,
			};
			const guard = new V2BuilderEnabledGuard(
				settingsServiceFor(settings({ v2BuilderEnabled: true })),
				// SAFETY: the guard only calls .isFeatureEnabled() on this dependency.
				analytics as AnalyticsService,
			);

			await guard.canActivate(contextFor("user_1"));
			vi.advanceTimersByTime(60_001);
			await guard.canActivate(contextFor("user_1"));

			expect(isFeatureEnabled).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
