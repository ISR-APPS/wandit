/**
 * Rollout gate for V2 builder routes.
 * Route controllers opt in with `@UseGuards(V2BuilderEnabledGuard)`; the
 * guard reads `product_settings` through ProductSettingsService and asks
 * PostHog for the per-user flag `v2-builder` through AnalyticsService.
 */
import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";

import { AnalyticsService } from "../../../../../infrastructure/analytics/analytics.service";
import type { MaybeAuthenticatedRequest } from "../../../../auth";
import { ProductSettingsService } from "../../../../settings";
import { V2BuilderDisabledError } from "../../../domain/errors/v2-builder-disabled.error";

/** PostHog flag every V2 route checks per user. */
const V2_BUILDER_FLAG = "v2-builder";

// Product rule: the flag answer is per user and changes rarely. One request
// burst per user costs one PostHog call, not one call per route hit.
const FLAG_CACHE_TTL_MS = 60_000;

type FlagCacheEntry = {
	/** Resolved flag answer; `undefined` means analytics has no key. */
	enabled: boolean | undefined;
	/** `Date.now()` timestamp after which the entry is stale. */
	expiresAt: number;
};

/** Denies with 403 `V2_BUILDER_DISABLED` unless the setting and the flag pass. */
@Injectable()
export class V2BuilderEnabledGuard implements CanActivate {
	private readonly logger = new Logger(V2BuilderEnabledGuard.name);
	private readonly flagCache = new Map<string, FlagCacheEntry>();
	private analyticsUnavailableLogged = false;

	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
		@Inject(AnalyticsService)
		private readonly analytics: AnalyticsService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const settings = await this.settingsService.get();
		if (!settings.v2BuilderEnabled) {
			throw new V2BuilderDisabledError();
		}

		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		// The global AuthGuard runs first on these routes. A missing user here
		// means a wiring bug. The safe answer is closed.
		const userId = request.user?.id;
		if (!userId) {
			throw new V2BuilderDisabledError();
		}

		const flagEnabled = await this.resolveFlag(userId);
		if (flagEnabled === false) {
			throw new V2BuilderDisabledError();
		}

		return true;
	}

	/**
	 * Resolves the `v2-builder` flag for one user with a 60 s cache.
	 * Returns `undefined` when analytics is disabled — the product setting
	 * alone decides then. Returns `false` on a PostHog failure.
	 */
	private async resolveFlag(userId: string): Promise<boolean | undefined> {
		const now = Date.now();
		this.pruneCache(now);

		const cached = this.flagCache.get(userId);
		if (cached && cached.expiresAt > now) {
			return cached.enabled;
		}

		try {
			const enabled = await this.analytics.isFeatureEnabled(
				V2_BUILDER_FLAG,
				userId,
			);
			if (enabled === undefined) {
				this.warnOnceAnalyticsMissing();
			}
			this.cacheFlag(userId, enabled, now);
			return enabled;
		} catch (error) {
			// Product rule: PostHog down means closed.
			this.logger.warn(
				`v2-builder flag check failed for user ${userId}; denying access`,
				error,
			);
			return false;
		}
	}

	private warnOnceAnalyticsMissing(): void {
		if (this.analyticsUnavailableLogged) {
			return;
		}
		this.analyticsUnavailableLogged = true;
		this.logger.warn(
			"PostHog is not configured; the v2-builder flag resolves to the product setting alone",
		);
	}

	private cacheFlag(
		userId: string,
		enabled: boolean | undefined,
		now: number,
	): void {
		// Re-setting an existing key keeps its insertion slot; delete first so
		// a refresh moves it to the end as the newest entry.
		this.flagCache.delete(userId);

		// LIMIT: 10,000 cached flag answers per API process (about 10k distinct
		// users inside one 60 s window). Upgrade: a shared Redis flag cache.
		if (this.flagCache.size >= 10_000) {
			const oldest = this.flagCache.keys().next();
			if (!oldest.done) {
				this.flagCache.delete(oldest.value);
			}
		}

		this.flagCache.set(userId, {
			enabled,
			expiresAt: now + FLAG_CACHE_TTL_MS,
		});
	}

	private pruneCache(now: number): void {
		for (const [key, entry] of this.flagCache) {
			if (entry.expiresAt <= now) {
				this.flagCache.delete(key);
			}
		}
	}
}
