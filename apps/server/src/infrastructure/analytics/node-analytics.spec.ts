import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createNodeAnalytics } from "@wandit/analytics/node";
import { describe, expect, it } from "vitest";

describe("createNodeAnalytics isFeatureEnabled", () => {
	// V2BuilderEnabledGuard opens V2 to every user on `undefined`. With a key,
	// a missing flag or a failed call must answer false, so the gate stays closed.
	it.each([
		{
			cause: "the flag does not exist",
			flagsStatus: 200,
			flagsBody: '{"flags":{}}',
		},
		{ cause: "the PostHog call fails", flagsStatus: 500, flagsBody: "{}" },
	])("answers false when $cause", async ({ flagsStatus, flagsBody }) => {
		// A local PostHog stand-in: `/flags` answers the row, an event batch answers 200.
		const posthog = createServer((request, response) => {
			const isFlagsCall = request.url?.startsWith("/flags") === true;
			response.writeHead(isFlagsCall ? flagsStatus : 200, {
				"content-type": "application/json",
			});
			response.end(isFlagsCall ? flagsBody : "{}");
		});
		await new Promise<void>((resolve) =>
			posthog.listen(0, "127.0.0.1", resolve),
		);
		// SAFETY: a server that listens on a TCP port returns AddressInfo here.
		const { port } = posthog.address() as AddressInfo;
		const analytics = createNodeAnalytics({
			host: `http://127.0.0.1:${port}`,
			key: "phc_test",
		});
		try {
			await expect(
				analytics.isFeatureEnabled("v2-builder", "user-1"),
			).resolves.toBe(false);
		} finally {
			await analytics.shutdown();
			await new Promise((resolve) => posthog.close(resolve));
		}
	});
});
