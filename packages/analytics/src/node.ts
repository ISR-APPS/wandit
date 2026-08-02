import { PostHog } from "posthog-node";

import {
	DEFAULT_POSTHOG_HOST,
	sanitizeUrlProperties,
	type WanditAnalyticsOptions,
} from "./internal/shared";

export type NodeAnalytics = {
	/** False when no key was provided — every method is then a no-op. */
	enabled: boolean;
	capture(
		distinctId: string,
		event: string,
		properties?: Record<string, unknown>,
	): void;
	identify(distinctId: string, properties?: Record<string, unknown>): void;
	isFeatureEnabled(
		flag: string,
		distinctId: string,
	): Promise<boolean | undefined>;
	/** Drain captures prepared asynchronously by the SDK, then flush without closing the client. */
	flush(): Promise<void>;
	/** Flush + close. Await before process exit; do not use when the client will be reused. */
	shutdown(): Promise<void>;
	/** Raw client for anything the wrapper doesn't cover. Undefined when disabled. */
	client: PostHog | undefined;
};

export function createNodeAnalytics(
	options: WanditAnalyticsOptions & {
		/** Set true in short-lived runtimes (Trigger tasks): flushAt 1 / flushInterval 0. Long-running server keeps batching defaults. */
		flushImmediately?: boolean;
	},
): NodeAnalytics {
	if (!options.key) {
		return {
			enabled: false,
			capture: () => undefined,
			identify: () => undefined,
			isFeatureEnabled: () => Promise.resolve(undefined),
			flush: () => Promise.resolve(),
			shutdown: () => Promise.resolve(),
			client: undefined,
		};
	}

	const client = new PostHog(options.key, {
		host: options.host ?? DEFAULT_POSTHOG_HOST,
		...(options.flushImmediately ? { flushAt: 1, flushInterval: 0 } : {}),
	});

	return {
		enabled: true,
		capture: (distinctId, event, properties) => {
			const mergedProperties = options.environment
				? { environment: options.environment, ...properties }
				: properties;
			client.capture({
				distinctId,
				event,
				properties:
					mergedProperties === undefined
						? undefined
						: sanitizeUrlProperties({ ...mergedProperties }),
			});
		},
		identify: (distinctId, properties) => {
			client.identify({ distinctId, properties });
		},
		isFeatureEnabled: (flag, distinctId) =>
			client.isFeatureEnabled(flag, distinctId),
		flush: async () => {
			// posthog-node prepares capture() events through a Promise chain before
			// enqueueing them. Yield one event-loop turn so flush() sees those events.
			await new Promise<void>((resolve) => setImmediate(resolve));
			await client.flush();
		},
		shutdown: () => client.shutdown(),
		client,
	};
}
