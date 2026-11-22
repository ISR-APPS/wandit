import { describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import {
	DEEP_WEB_SEARCH_CREDITS,
	WEB_SEARCH_CREDITS,
} from "../../../metering/domain/operation-registry";
import type { HostToolContext } from "../../domain/ports/host-tools";
import type { SandboxHandle } from "../../domain/ports/sandbox-provider";
import {
	BUILDER_MAX_DEEP_WEB_SEARCHES_PER_TURN,
	BUILDER_MAX_WEB_SEARCHES_PER_TURN,
	createWebSearchTool,
	type SearchWeb,
	WEB_SEARCH_RESULT_TEXT_MAX_CHARS,
	type WebSearchHostToolDeps,
} from "./web-search.host-tool";

type WebSearchMetering = WebSearchHostToolDeps["metering"];

const CHILD_EVENT_FIELDS: Partial<AiUsageEvent> = {
	id: "evt_child_1",
	operation: "web_search",
	parentEventId: "evt_parent_1",
	reservedCredits: WEB_SEARCH_CREDITS,
};
// SAFETY: the tool reads only `id` of the reserved event.
const CHILD_EVENT = CHILD_EVENT_FIELDS as AiUsageEvent;

const SEARCH_OK: SearchWeb = async () => ({
	response: {
		costDollars: { total: 0.012 },
		requestId: "exa-req-1",
		results: [
			{
				publishedDate: null,
				text: "x".repeat(WEB_SEARCH_RESULT_TEXT_MAX_CHARS + 500),
				title: null,
				url: "https://react.dev/reference/react/useEffect",
			},
		],
	},
	status: "ok",
});

function setup(
	options: {
		searchWeb?: SearchWeb;
		holdEventId?: string | null;
		reserve?: WebSearchMetering["reserve"];
	} = {},
) {
	const metering = {
		refund: vi.fn<WebSearchMetering["refund"]>(async () => CHILD_EVENT),
		reserve: vi.fn<WebSearchMetering["reserve"]>(
			options.reserve ?? (async () => CHILD_EVENT),
		),
		settle: vi.fn<WebSearchMetering["settle"]>(async () => CHILD_EVENT),
	};
	const searchWeb = vi.fn<SearchWeb>(options.searchWeb ?? SEARCH_OK);
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		framework: "web-app",
		holdEventId:
			options.holdEventId === undefined ? "evt_parent_1" : options.holdEventId,
		knownThemeFile: () => null,
		mode: "build",
		onThemeFileWritten: () => {},
		organizationId: null,
		projectId: "project-1",
		// SAFETY: web_search never touches the sandbox.
		sandbox: {} as SandboxHandle,
		subject: { actorUserId: "user-1", organizationId: null },
		templateVersion: "web-app@1.0.0",
		turnId: "turn-1",
	};
	const tool = createWebSearchTool(
		{ logger: { info: vi.fn(), warn: vi.fn() }, metering, searchWeb },
		context,
	);
	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("web_search must define execute");
	}
	const search = (depth: "standard" | "deep" = "standard") =>
		execute(
			{ depth, numResults: 5, query: "react useEffect cleanup" },
			{ context: {}, messages: [], toolCallId: "tc-1" },
		);
	return { metering, search, searchWeb };
}

describe("createWebSearchTool", () => {
	it("settles the child at the fixed price with the Exa cost and cuts the page text", async () => {
		const { metering, search } = setup();

		const output = await search();

		expect(output).toEqual({
			results: [
				{
					text: "x".repeat(WEB_SEARCH_RESULT_TEXT_MAX_CHARS),
					title: "https://react.dev/reference/react/useEffect",
					url: "https://react.dev/reference/react/useEffect",
				},
			],
			status: "ok",
		});
		expect(metering.reserve).toHaveBeenCalledWith(
			"web_search",
			expect.anything(),
			expect.objectContaining({
				credits: WEB_SEARCH_CREDITS,
				idempotencyKey: "builder-turn-web-search:turn-1:1",
				parentEventId: "evt_parent_1",
			}),
		);
		// $0.012 is 12,000 USD micros.
		expect(metering.settle).toHaveBeenCalledWith(
			"evt_child_1",
			expect.objectContaining({
				costUsdMicros: 12_000,
				finalCredits: WEB_SEARCH_CREDITS,
			}),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("reserves and settles a deep search at the deep price and returns the Exa answer", async () => {
		const { metering, search, searchWeb } = setup({
			searchWeb: async () => ({
				response: {
					output: { content: "Return a cleanup function from the effect." },
					results: [{ url: "https://react.dev/learn" }],
				},
				status: "ok",
			}),
		});

		const output = await search("deep");

		expect(output).toMatchObject({
			answer: "Return a cleanup function from the effect.",
			status: "ok",
		});
		expect(searchWeb).toHaveBeenCalledWith(
			expect.objectContaining({ type: "deep" }),
			undefined,
		);
		expect(metering.reserve).toHaveBeenCalledWith(
			"web_search",
			expect.anything(),
			expect.objectContaining({ credits: DEEP_WEB_SEARCH_CREDITS }),
		);
		expect(metering.settle).toHaveBeenCalledWith(
			"evt_child_1",
			expect.objectContaining({
				finalCredits: DEEP_WEB_SEARCH_CREDITS,
				pricingSnapshot: expect.objectContaining({
					creditsPerUnit: DEEP_WEB_SEARCH_CREDITS,
				}),
			}),
		);
	});

	it.each([
		{
			favicon: "https://react.dev/favicon.ico",
			expected: "https://react.dev/favicon.ico",
		},
		{ favicon: "http://react.dev/favicon.ico", expected: undefined },
		{
			favicon: "data:image/svg+xml,<svg onload=alert(1)>",
			expected: undefined,
		},
		{ favicon: "javascript:alert(1)", expected: undefined },
		{ favicon: "not a url", expected: undefined },
	])("passes the favicon $favicon only as an https URL", async ({
		expected,
		favicon,
	}) => {
		const { search } = setup({
			searchWeb: async () => ({
				response: {
					results: [{ favicon, url: "https://react.dev/learn" }],
				},
				status: "ok",
			}),
		});

		const output = await search();

		// toEqual treats `favicon: undefined` as an absent key.
		expect(output).toEqual({
			results: [
				{
					favicon: expected,
					text: "",
					title: "https://react.dev/learn",
					url: "https://react.dev/learn",
				},
			],
			status: "ok",
		});
	});

	it.each([
		{
			name: "a non-2xx answer",
			searchWeb: (async () => ({
				httpStatus: 429,
				message: "Exa answered 429: rate limited",
				status: "failed",
			})) satisfies SearchWeb,
		},
		{
			name: "a timeout",
			searchWeb: (async () => {
				throw new DOMException("The operation timed out", "TimeoutError");
			}) satisfies SearchWeb,
		},
	])("refunds the child and never settles it on $name", async ({
		searchWeb,
	}) => {
		const { metering, search } = setup({ searchWeb });

		const output = await search();

		expect(output).toMatchObject({ status: "failed" });
		expect(metering.refund).toHaveBeenCalledWith(
			"evt_child_1",
			"builder_turn_web_search_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it.each([
		{ name: "no turn hold", holdEventId: null, status: "failed" },
		{
			name: "a refused reserve",
			reserve: async () => {
				throw new InsufficientCreditsError(WEB_SEARCH_CREDITS, 0);
			},
			status: "unavailable",
		},
	])("never calls Exa with $name", async ({ holdEventId, reserve, status }) => {
		const { search, searchWeb } = setup({ holdEventId, reserve });

		const output = await search();

		expect(output).toMatchObject({ status });
		expect(searchWeb).not.toHaveBeenCalled();
	});

	it("stops at the per-turn cap before it reserves or calls Exa", async () => {
		const { metering, search, searchWeb } = setup();

		for (let call = 0; call < BUILDER_MAX_WEB_SEARCHES_PER_TURN; call += 1) {
			await search();
		}
		const output = await search();

		expect(output).toMatchObject({ status: "failed" });
		expect(metering.reserve).toHaveBeenCalledTimes(
			BUILDER_MAX_WEB_SEARCHES_PER_TURN,
		);
		expect(searchWeb).toHaveBeenCalledTimes(BUILDER_MAX_WEB_SEARCHES_PER_TURN);
	});

	it("stops a deep search over the deep cap, but a standard search still runs", async () => {
		const { search, searchWeb } = setup();

		for (
			let call = 0;
			call < BUILDER_MAX_DEEP_WEB_SEARCHES_PER_TURN;
			call += 1
		) {
			await search("deep");
		}
		const overCap = await search("deep");
		const standard = await search("standard");

		expect(overCap).toMatchObject({ status: "failed" });
		expect(standard).toMatchObject({ status: "ok" });
		expect(searchWeb).toHaveBeenCalledTimes(
			BUILDER_MAX_DEEP_WEB_SEARCHES_PER_TURN + 1,
		);
	});
});
