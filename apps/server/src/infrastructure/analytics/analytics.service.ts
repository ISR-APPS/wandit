import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { createNodeAnalytics } from "@wandit/analytics/node";
import { env } from "@wandit/env/server";

@Injectable()
export class AnalyticsService implements OnApplicationShutdown {
	private readonly analytics = createNodeAnalytics({
		environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
		host: env.POSTHOG_HOST,
		key: env.POSTHOG_KEY,
	});

	capture(
		distinctId: string,
		event: string,
		properties?: Record<string, unknown>,
	): void {
		this.analytics.capture(distinctId, event, properties);
	}

	async onApplicationShutdown(): Promise<void> {
		await this.analytics.shutdown();
	}
}
