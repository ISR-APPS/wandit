import { describe, expect, it } from "vitest";

import {
	recoverSettledConnectorCompletion,
	recoverSettledLeadScrapeCompletion,
} from "./settled-completion-recovery";

describe("post-settlement completion CAS recovery", () => {
	it("replays a connector success from the durable media row", () => {
		expect(
			recoverSettledConnectorCompletion("attempt_1", {
				media: [
					{ kind: "image", url: "https://assets.test/result.webp" },
					{ kind: "video", url: "https://assets.test/result.mp4" },
				],
				status: "succeeded",
			}),
		).toEqual({ mediaCount: 2, skipped: true });
	});

	it.each([
		"queued",
		"running",
		"failed",
	] as const)("surfaces a connector %s conflict after settlement", (status) => {
		expect(() =>
			recoverSettledConnectorCompletion("attempt_1", {
				media: null,
				status,
			}),
		).toThrow(`current status is ${status}`);
	});

	it("surfaces a deleted connector row after settlement", () => {
		expect(() => recoverSettledConnectorCompletion("attempt_1", null)).toThrow(
			"current status is missing",
		);
	});

	it("replays a lead scrape success from the durable result row", () => {
		expect(
			recoverSettledLeadScrapeCompletion("attempt_2", {
				rowCount: 37,
				status: "succeeded",
			}),
		).toEqual({ rowCount: 37, skipped: true });
	});

	it.each([
		"queued",
		"running",
		"failed",
	] as const)("surfaces a lead scrape %s conflict after settlement", (status) => {
		expect(() =>
			recoverSettledLeadScrapeCompletion("attempt_2", {
				rowCount: null,
				status,
			}),
		).toThrow(`current status is ${status}`);
	});
});
