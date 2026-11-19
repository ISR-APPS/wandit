import { describe, expect, it, vi } from "vitest";

import type { AiUsageEvent } from "../../../metering/domain/metering";
import { WEB_FETCH_CREDITS } from "../../../metering/domain/operation-registry";
import type { HostToolContext } from "../../domain/ports/host-tools";
import type { SandboxHandle } from "../../domain/ports/sandbox-provider";
import type { FetchWebPage, WebPage } from "../../domain/ports/web-pages";
import {
	BUILDER_MAX_WEB_FETCHES_PER_TURN,
	createWebFetchTool,
	WEB_FETCH_PAGE_CHARS,
	type WebFetchHostToolDeps,
} from "./web-fetch.host-tool";

type WebFetchMetering = WebFetchHostToolDeps["metering"];

const CHILD_EVENT_FIELDS: Partial<AiUsageEvent> = {
	id: "evt_child_1",
	operation: "web_fetch",
	parentEventId: "evt_parent_1",
	reservedCredits: WEB_FETCH_CREDITS,
};
// SAFETY: the tool reads only `id` of the reserved event.
const CHILD_EVENT = CHILD_EVENT_FIELDS as AiUsageEvent;

const PAGE_URL = "https://react.dev/reference/react/useEffect";

function pageOf(markdown: string): FetchWebPage {
	return async (url) => ({
		costUsdMicros: 990,
		page: { finalUrl: url, markdown, title: "useEffect" },
		status: "ok",
	});
}

function setup(
	options: {
		fetchWebPage?: FetchWebPage;
		holdEventId?: string | null;
		/** True: the cache never returns a page, as when Redis is down. */
		isCacheDown?: boolean;
	} = {},
) {
	const metering = {
		refund: vi.fn<WebFetchMetering["refund"]>(async () => CHILD_EVENT),
		reserve: vi.fn<WebFetchMetering["reserve"]>(async () => CHILD_EVENT),
		settle: vi.fn<WebFetchMetering["settle"]>(async () => CHILD_EVENT),
	};
	const fetchWebPage = vi.fn<FetchWebPage>(
		options.fetchWebPage ?? pageOf("# useEffect"),
	);
	// The cache of the real tool is Redis. A Map keeps the pages for one spec case.
	const pages = new Map<string, WebPage>();
	const pageCache: WebFetchHostToolDeps["pageCache"] = {
		get: async (url) =>
			options.isCacheDown === true ? null : (pages.get(url) ?? null),
		set: async (url, page) => {
			pages.set(url, page);
		},
	};
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
		// SAFETY: web_fetch never touches the sandbox.
		sandbox: {} as SandboxHandle,
		subject: { actorUserId: "user-1", organizationId: null },
		templateVersion: "web-app@1.0.0",
		turnId: "turn-1",
	};
	const tool = createWebFetchTool(
		{
			fetchWebPage,
			logger: { info: vi.fn(), warn: vi.fn() },
			metering,
			pageCache,
		},
		context,
	);
	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("web_fetch must define execute");
	}
	const read = (url = PAGE_URL, offset = 0) =>
		execute({ offset, url }, { context: {}, messages: [], toolCallId: "tc-1" });
	return { fetchWebPage, metering, read };
}

describe("createWebFetchTool", () => {
	it("bills the first read of a URL and serves the second read from the cache", async () => {
		const { fetchWebPage, metering, read } = setup();

		const first = await read();
		const second = await read();

		expect(first).toMatchObject({ markdown: "# useEffect", status: "ok" });
		expect(second).toEqual(first);
		expect(fetchWebPage).toHaveBeenCalledTimes(1);
		expect(metering.reserve).toHaveBeenCalledTimes(1);
		expect(metering.reserve).toHaveBeenCalledWith(
			"web_fetch",
			expect.anything(),
			expect.objectContaining({
				credits: WEB_FETCH_CREDITS,
				idempotencyKey: "builder-turn-web-fetch:turn-1:1",
				parentEventId: "evt_parent_1",
			}),
		);
		expect(metering.settle).toHaveBeenCalledTimes(1);
		expect(metering.settle).toHaveBeenCalledWith(
			"evt_child_1",
			expect.objectContaining({
				costUsdMicros: 990,
				finalCredits: WEB_FETCH_CREDITS,
			}),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("bills one page once per turn when Redis is down", async () => {
		const { fetchWebPage, metering, read } = setup({
			fetchWebPage: pageOf("a".repeat(30_000)),
			isCacheDown: true,
		});

		const first = await read(PAGE_URL, 0);
		const second = await read(PAGE_URL, 20_000);

		expect(first).toMatchObject({ nextOffset: 20_000, status: "ok" });
		expect(second).toMatchObject({ nextOffset: null, status: "ok" });
		expect(fetchWebPage).toHaveBeenCalledTimes(1);
		expect(metering.reserve).toHaveBeenCalledTimes(1);
	});

	it("refunds a failed page and does not cache it", async () => {
		const { metering, read } = setup({
			fetchWebPage: async () => ({
				message: "The page answered HTTP 404",
				status: "failed",
			}),
		});

		const first = await read();
		await read();

		expect(first).toEqual({
			message: "The page answered HTTP 404",
			status: "failed",
		});
		expect(metering.refund).toHaveBeenCalledWith(
			"evt_child_1",
			"builder_turn_web_fetch_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
		// The second read is a cache miss, so it reserves again.
		expect(metering.reserve).toHaveBeenCalledTimes(2);
	});

	it("refunds a fetch that throws and keeps a cut message well-formed", async () => {
		// 499 chars, then an emoji of two UTF-16 code units across the 500-char cut.
		const messageStart = "a".padEnd(499, " b");
		const { metering, read } = setup({
			fetchWebPage: async () => {
				throw new Error(`${messageStart}\u{1F600} more text`);
			},
		});

		const output = await read();

		// Postgres jsonb refuses a lone surrogate, so the half must become U+FFFD.
		expect(output).toEqual({
			message: `Web fetch failed: ${messageStart}\uFFFD`,
			status: "failed",
		});
		expect(metering.refund).toHaveBeenCalledWith(
			"evt_child_1",
			"builder_turn_web_fetch_failed",
		);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("never calls the provider without a turn hold", async () => {
		const { fetchWebPage, read } = setup({ holdEventId: null });

		const output = await read();

		expect(output).toMatchObject({ status: "failed" });
		expect(fetchWebPage).not.toHaveBeenCalled();
	});

	it("stops at the per-turn cap of new pages before it reserves", async () => {
		const { fetchWebPage, metering, read } = setup();

		for (let page = 0; page < BUILDER_MAX_WEB_FETCHES_PER_TURN; page += 1) {
			await read(`https://react.dev/page-${page}`);
		}
		const output = await read("https://react.dev/one-page-too-many");

		expect(output).toMatchObject({ status: "failed" });
		expect(metering.reserve).toHaveBeenCalledTimes(
			BUILDER_MAX_WEB_FETCHES_PER_TURN,
		);
		expect(fetchWebPage).toHaveBeenCalledTimes(
			BUILDER_MAX_WEB_FETCHES_PER_TURN,
		);
	});

	// The page is two full parts and one part of 10 chars.
	const PAGE_CHARS = 2 * WEB_FETCH_PAGE_CHARS + 10;
	it.each([
		{
			name: "the first part",
			offset: 0,
			chars: WEB_FETCH_PAGE_CHARS,
			nextOffset: WEB_FETCH_PAGE_CHARS,
		},
		{
			name: "a middle part",
			offset: WEB_FETCH_PAGE_CHARS,
			chars: WEB_FETCH_PAGE_CHARS,
			nextOffset: 2 * WEB_FETCH_PAGE_CHARS,
		},
		{
			name: "the last part",
			offset: 2 * WEB_FETCH_PAGE_CHARS,
			chars: 10,
			nextOffset: null,
		},
		{
			name: "an offset past the end",
			offset: PAGE_CHARS + 5,
			chars: 0,
			nextOffset: null,
		},
	])("returns $name with nextOffset $nextOffset", async ({
		chars,
		nextOffset,
		offset,
	}) => {
		const { read } = setup({ fetchWebPage: pageOf("x".repeat(PAGE_CHARS)) });

		const output = await read(PAGE_URL, offset);

		expect(output).toMatchObject({
			markdown: "x".repeat(chars),
			nextOffset,
			status: "ok",
			totalChars: PAGE_CHARS,
		});
	});

	it("returns well-formed text when a part edge cuts an emoji in two", async () => {
		// The emoji is two UTF-16 code units: one each side of the first part edge.
		const markdown = `${"x".repeat(WEB_FETCH_PAGE_CHARS - 1)}\u{1F600}yz`;
		// The source page controls the title and the final URL. Each holds half an emoji here.
		const { read } = setup({
			fetchWebPage: async () => ({
				costUsdMicros: 990,
				page: {
					finalUrl: "https://react.dev/\ud83d",
					markdown,
					title: "use\ud83dEffect",
				},
				status: "ok",
			}),
		});

		const firstPart = await read(PAGE_URL, 0);
		const secondPart = await read(PAGE_URL, WEB_FETCH_PAGE_CHARS);

		// Postgres jsonb refuses a lone surrogate, so each half must become U+FFFD.
		expect(firstPart).toMatchObject({
			markdown: `${"x".repeat(WEB_FETCH_PAGE_CHARS - 1)}�`,
			nextOffset: WEB_FETCH_PAGE_CHARS,
			status: "ok",
			title: "use�Effect",
			totalChars: markdown.length,
			url: "https://react.dev/�",
		});
		expect(secondPart).toMatchObject({
			markdown: "�yz",
			nextOffset: null,
			status: "ok",
		});
	});
});
