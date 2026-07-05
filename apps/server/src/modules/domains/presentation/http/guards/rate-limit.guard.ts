import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { MaybeAuthenticatedRequest } from "../../../../auth/presentation/http/types/authenticated-request";
import { DomainRateLimitExceededError } from "../../../domain/errors/domain.errors";

const DOMAIN_RATE_LIMIT_KEY = "domain_rate_limit";

export type DomainRateLimitOptions = {
	limit: number;
	windowMs: number;
};

export const DomainRateLimit = (options: DomainRateLimitOptions) =>
	SetMetadata(DOMAIN_RATE_LIMIT_KEY, options);

type HitBucket = {
	timestamps: number[];
	windowMs: number;
};

@Injectable()
export class DomainRateLimitGuard implements CanActivate {
	// Single-instance MVP limiter. Replace with Redis before horizontally
	// scaling the API.
	private readonly hits = new Map<string, HitBucket>();
	private requestCount = 0;

	constructor(
		@Inject(Reflector)
		private readonly reflector: Reflector,
	) {}

	canActivate(context: ExecutionContext): boolean {
		const options = this.reflector.getAllAndOverride<
			DomainRateLimitOptions | undefined
		>(DOMAIN_RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

		if (!options) {
			return true;
		}

		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		const userId = request.user?.id ?? "anonymous";
		const routeKey = `${context.getClass().name}.${context.getHandler().name}`;
		const key = `${userId}:${routeKey}`;
		const now = Date.now();
		const windowStart = now - options.windowMs;
		this.requestCount += 1;
		this.sweepIdleBuckets(now);

		const recentHits = (this.hits.get(key)?.timestamps ?? []).filter(
			(timestamp) => timestamp > windowStart,
		);

		if (recentHits.length >= options.limit) {
			this.hits.set(key, { timestamps: recentHits, windowMs: options.windowMs });
			throw new DomainRateLimitExceededError();
		}

		recentHits.push(now);
		this.hits.set(key, { timestamps: recentHits, windowMs: options.windowMs });

		return true;
	}

	private sweepIdleBuckets(now: number): void {
		if (this.requestCount % 256 !== 0 && this.hits.size <= 10_000) {
			return;
		}

		for (const [key, bucket] of this.hits) {
			const newest = bucket.timestamps.at(-1);

			if (!newest || newest <= now - bucket.windowMs) {
				this.hits.delete(key);
			}
		}
	}
}
