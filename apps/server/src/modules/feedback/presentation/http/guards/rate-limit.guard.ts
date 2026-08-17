import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";

import type { MaybeAuthenticatedRequest } from "../../../../auth/presentation/http/types/authenticated-request";
import { FeedbackRateLimitExceededError } from "../../../domain/errors/feedback.errors";
import { FEEDBACK_RATE_LIMIT } from "../../../feedback.constants";

@Injectable()
export class FeedbackRateLimitGuard implements CanActivate {
	// Single-instance MVP limiter. Replace with Redis before horizontally
	// scaling the API.
	private readonly hits = new Map<string, number[]>();
	private requestCount = 0;

	canActivate(context: ExecutionContext): boolean {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();
		const userId = request.user?.id ?? "anonymous";
		const routeKey = `${context.getClass().name}.${context.getHandler().name}`;
		const key = `${userId}:${routeKey}`;
		const now = Date.now();
		const windowStart = now - FEEDBACK_RATE_LIMIT.windowMs;
		this.requestCount += 1;
		this.sweepIdleBuckets(now);

		const recentHits = (this.hits.get(key) ?? []).filter(
			(timestamp) => timestamp > windowStart,
		);

		if (recentHits.length >= FEEDBACK_RATE_LIMIT.limit) {
			this.hits.set(key, recentHits);
			throw new FeedbackRateLimitExceededError();
		}

		recentHits.push(now);
		this.hits.set(key, recentHits);

		return true;
	}

	private sweepIdleBuckets(now: number): void {
		if (this.requestCount % 256 !== 0 && this.hits.size <= 10_000) {
			return;
		}

		for (const [key, timestamps] of this.hits) {
			const newest = timestamps.at(-1);

			if (!newest || newest <= now - FEEDBACK_RATE_LIMIT.windowMs) {
				this.hits.delete(key);
			}
		}
	}
}
