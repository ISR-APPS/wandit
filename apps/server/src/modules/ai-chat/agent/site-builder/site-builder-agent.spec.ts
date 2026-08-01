import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { BuildProgressEvent } from "./build-progress";
import { buildSiteBuilderSystemPrompt } from "./builder-prompt";
import { generateBuildImage, MAX_IMAGES } from "./generate-image";
import { generateBuildVideo, MAX_VIDEOS } from "./generate-video";
import {
	type ScreenshotCapture,
	type ScreenshotSession,
	ScreenshotUnavailableError,
} from "./screenshot";
import {
	buildStopConditions,
	createBuilderTools,
	createBuildLoopState,
	REQUIRED_SCREENSHOT_PASSES,
} from "./site-builder-agent";
import { VirtualFileSystem } from "./virtual-files";

// The guards must be verifiable without a network: the image/video handlers
// (which talk to the gateway and R2) are mocked. Everything else runs for
// real.
vi.mock("./generate-image", async (importOriginal) => {
	const original = await importOriginal<typeof import("./generate-image")>();

	return { ...original, generateBuildImage: vi.fn() };
});

vi.mock("./generate-video", async (importOriginal) => {
	const original = await importOriginal<typeof import("./generate-video")>();

	return { ...original, generateBuildVideo: vi.fn() };
});

const HTML = `<!doctype html>
<html>
<head>
<style>:root {
	--background: #fffaf2;
	--foreground: #211b16;
	--primary: #a13d24;
	--primary-foreground: #ffffff;
	--secondary: #ead9c3;
	--accent: #d29a43;
	--muted: #74685e;
	--border: #cbb9a4;
	--radius: 16px;
	--font-heading: "Test Heading", serif;
	--font-body: "Test Body", sans-serif;
}
body {
	background: var(--background);
	color: var(--foreground);
	font-family: var(--font-body);
}
a { color: var(--primary); }
button { border-radius: var(--radius); }
</style>
</head>
<body><header><nav><a data-brand="nav" href="/">Wandit</a></nav></header><main><h1>page</h1><p>${"substantial commerce copy ".repeat(
	80,
)}</p></main></body>
</html>`;

const DESKTOP_SHOT = "ZGVza3RvcC1zaG90";
const MOBILE_SHOT = "bW9iaWxlLXNob3Q=";

const IMAGE_INPUT = {
	aspect: "16:9" as const,
	prompt: "editorial photography of a ceramic tagine, warm side light",
	role: "hero background",
};

const VIDEO_INPUT = {
	aspect: "16:9" as const,
	imageUrl:
		"https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
	motionPrompt: "steam drifts slowly, warm light breathes",
};

function fakeCapture(): ScreenshotCapture {
	return {
		consoleErrors: ["[mobile] boom is not defined"],
		failedRequests: [
			"[desktop] https://assets.example.com/broken.png (net::ERR_FAILED)",
		],
		overflow: { desktop: 0, mobile: 12 },
		shots: [
			{ base64: DESKTOP_SHOT, viewport: "desktop" },
			{ base64: MOBILE_SHOT, viewport: "mobile" },
		],
	};
}

function setup(config?: {
	abortSignal?: AbortSignal;
	onEvent?: (event: BuildProgressEvent) => void;
	screenshotRequired?: boolean;
	screenshots?: ScreenshotSession;
}) {
	const {
		screenshotRequired = true,
		screenshots = {
			capture: vi.fn().mockResolvedValue(fakeCapture()),
			dispose: vi.fn(),
		},
		...toolConfig
	} = config ?? {};
	const state = createBuildLoopState(screenshotRequired);
	const vfs = new VirtualFileSystem();
	const tools = createBuilderTools({
		...toolConfig,
		attemptId: "attempt_1",
		projectId: "project_1",
		screenshots,
		state,
		vfs,
	});

	// The AI SDK calls execute with (input, callOptions); the tools only use
	// toolCallId, so a stub second argument is enough here.
	const options = (toolCallId = "call_1") =>
		({ messages: [], toolCallId }) as never;

	return { options, screenshots, state, tools, vfs };
}

// Complete the minimum screenshot passes the finish gate requires — keeps
// these specs valid whatever REQUIRED_SCREENSHOT_PASSES is tuned to.
async function completeRequiredPasses(
	tools: ReturnType<typeof setup>["tools"],
	options: ReturnType<typeof setup>["options"],
	prefix = "shot",
) {
	for (let i = 1; i <= REQUIRED_SCREENSHOT_PASSES; i += 1) {
		await tools.screenshot_page.execute?.({}, options(`${prefix}_${i}`));
	}
}

// Tool execute types allow streamed AsyncIterable outputs; these tools never
// stream, so tests unwrap to the plain output shape for narrowing.
function materialize<T>(value: T | AsyncIterable<T> | undefined): T {
	if (
		value === undefined ||
		(typeof value === "object" &&
			value !== null &&
			Symbol.asyncIterator in value)
	) {
		throw new Error("expected a plain tool output");
	}

	return value as T;
}

beforeEach(() => {
	vi.mocked(generateBuildImage).mockReset();
	vi.mocked(generateBuildVideo).mockReset();
});

describe("write_file guard", () => {
	it("rejects any path other than index.html without writing it", async () => {
		const { options, tools, vfs } = setup();

		for (const path of ["styles.css", "assets/app.js", "about.html"]) {
			await expect(
				tools.write_file.execute?.({ content: HTML, path }, options()),
			).rejects.toThrow(/exactly ONE file/);
		}

		expect(vfs.list()).toEqual([]);
	});

	it("accepts ./index.html and marks the full write source-reviewed", async () => {
		const { options, state, tools, vfs } = setup();

		await expect(
			tools.write_file.execute?.(
				{ content: HTML, path: "./index.html" },
				options(),
			),
		).resolves.toMatchObject({ path: "index.html" });
		expect(vfs.read("index.html")).toBe(HTML);
		expect(state.reviewedRevision).toBe(1);
		expect(state.writeRevision).toBe(1);
	});
});

describe("screenshot_page", () => {
	it("refuses before index.html exists without recording a revision", async () => {
		const { options, screenshots, state, tools } = setup();

		const output = await tools.screenshot_page.execute?.({}, options());

		expect(output).toEqual({
			message:
				"index.html has not been written yet — write it first, then screenshot it.",
			refused: true,
		});
		expect(state.screenshotRevision).toBe(0);
		expect(screenshots.capture).not.toHaveBeenCalled();
	});

	it("records the captured write revision and sends images only via toModelOutput", async () => {
		const { options, screenshots, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		const output = materialize(
			await tools.screenshot_page.execute?.({}, options("shot_1")),
		);

		expect(screenshots.capture).toHaveBeenCalledWith(HTML);
		expect(output).toMatchObject({
			consoleErrors: ["[mobile] boom is not defined"],
			desktopShots: 1,
			failedRequests: [
				"[desktop] https://assets.example.com/broken.png (net::ERR_FAILED)",
			],
			mobileShots: 1,
			overflow: { desktop: 0, mobile: 12 },
			refused: false,
			revision: 1,
			unavailable: false,
		});
		expect(state.screenshotRevision).toBe(1);
		expect(JSON.stringify(output)).not.toContain(DESKTOP_SHOT);

		if (output.refused || output.unavailable) {
			throw new Error("screenshot_page must succeed here");
		}

		const modelOutput = await tools.screenshot_page.toModelOutput?.({
			input: {},
			output,
			toolCallId: "shot_1",
		});

		if (modelOutput?.type !== "content") {
			throw new Error("expected a content tool result");
		}

		const [text, ...files] = modelOutput.value;

		expect(text).toMatchObject({ type: "text" });
		expect(text?.type === "text" ? text.text : "").toContain(
			"Failed requests: [desktop] https://assets.example.com/broken.png",
		);
		expect(files).toEqual([
			{
				data: { data: DESKTOP_SHOT, type: "data" },
				mediaType: "image/jpeg",
				type: "file",
			},
			{
				data: { data: MOBILE_SHOT, type: "data" },
				mediaType: "image/jpeg",
				type: "file",
			},
		]);
	});

	it("dedupes and caps model diagnostics without trimming the progress event", async () => {
		const consoleErrors = [
			"console error 1",
			"console error 2",
			"console error 1",
			"console error 3",
			"console error 4",
			"console error 5",
			"console error 6",
			"console error 7",
		];
		const failedRequests = [
			"failed request 1",
			"failed request 2",
			"failed request 3",
			"failed request 2",
			"failed request 4",
			"failed request 5",
			"failed request 6",
		];
		const events: BuildProgressEvent[] = [];
		const screenshots: ScreenshotSession = {
			capture: vi.fn().mockResolvedValue({
				...fakeCapture(),
				consoleErrors,
				failedRequests,
			}),
			dispose: vi.fn(),
		};
		const { options, tools } = setup({
			onEvent: (event) => events.push(event),
			screenshots,
		});
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		const output = materialize(
			await tools.screenshot_page.execute?.({}, options("shot_capped")),
		);

		expect(output).toMatchObject({
			consoleErrors: [
				"console error 1",
				"console error 2",
				"console error 3",
				"console error 4",
				"console error 5",
				"…and 2 more",
			],
			failedRequests: [
				"failed request 1",
				"failed request 2",
				"failed request 3",
				"failed request 4",
				"failed request 5",
				"…and 1 more",
			],
			refused: false,
			unavailable: false,
		});
		expect(
			events.find((event) => event.type === "screenshot-pass"),
		).toMatchObject({ consoleErrors, failedRequests });

		if (output.refused || output.unavailable) {
			throw new Error("screenshot_page must succeed here");
		}

		const modelOutput = await tools.screenshot_page.toModelOutput?.({
			input: {},
			output,
			toolCallId: "shot_capped",
		});

		if (modelOutput?.type !== "content") {
			throw new Error("expected a content tool result");
		}

		const text = modelOutput.value[0];
		const modelText = text?.type === "text" ? text.text : "";

		expect(modelText).toContain("…and 2 more");
		expect(modelText).toContain("…and 1 more");
		expect(modelText).not.toContain("console error 6");
		expect(modelText).not.toContain("console error 7");
		expect(modelText).not.toContain("failed request 6");
	});

	it("does not credit a review pass when the browser returns zero shots", async () => {
		const screenshots: ScreenshotSession = {
			capture: vi.fn().mockResolvedValue({ ...fakeCapture(), shots: [] }),
			dispose: vi.fn(),
		};
		const { options, state, tools } = setup({ screenshots });
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		const output = await tools.screenshot_page.execute?.({}, options("shot_1"));

		expect(output).toMatchObject({ refused: true });
		expect(state.screenshotPasses).toBe(0);
		expect(state.screenshotRevision).toBe(0);
	});

	it("does not credit an older capture to a write made while it renders", async () => {
		let resolveCapture: (capture: ScreenshotCapture) => void = () => undefined;
		const pendingCapture = new Promise<ScreenshotCapture>((resolve) => {
			resolveCapture = resolve;
		});
		const screenshots: ScreenshotSession = {
			capture: vi.fn().mockReturnValue(pendingCapture),
			dispose: vi.fn(),
		};
		const { options, state, tools } = setup({ screenshots });
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		const capture = tools.screenshot_page.execute?.({}, options("shot_1"));
		await tools.write_file.execute?.(
			{ content: HTML.replace("page", "new page"), path: "index.html" },
			options(),
		);
		resolveCapture(fakeCapture());
		await capture;

		expect(state.screenshotRevision).toBe(1);
		expect(state.writeRevision).toBe(2);
		// Which refusal branch fires depends on REQUIRED_SCREENSHOT_PASSES;
		// both demand a fresh screenshot_page call, which is the point here.
		await expect(
			tools.finish.execute?.({ summary: "Old capture." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("screenshot_page"),
		});
	});

	it("degrades to code review when Playwright/Chromium is unavailable", async () => {
		const screenshots: ScreenshotSession = {
			capture: vi
				.fn()
				.mockRejectedValue(
					new ScreenshotUnavailableError("Chromium executable is missing"),
				),
			dispose: vi.fn(),
		};
		const { options, state, tools } = setup({ screenshots });
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		const output = await tools.screenshot_page.execute?.({}, options());

		expect(output).toMatchObject({
			message: expect.stringContaining("Visual review is unavailable"),
			refused: false,
			unavailable: true,
		});
		expect(state.screenshotRequired).toBe(false);
		await expect(
			tools.finish.execute?.({ summary: "Code reviewed." }, options()),
		).resolves.toEqual({ accepted: true });
	});
});

describe("edit_file guard", () => {
	it("refuses to edit before the first draft exists", async () => {
		const { options, tools } = setup();

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "b", search: "a" },
				options(),
			),
		).rejects.toThrow(/write_file/);
	});

	it("refuses any path other than index.html", async () => {
		const { options, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "styles.css", replace: "b", search: "a" },
				options(),
			),
		).rejects.toThrow(/exactly ONE file/);
	});

	it("accepts the ./index.html spelling like write_file does", async () => {
		const { options, tools, vfs } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "./index.html", replace: "site", search: "page" },
				options(),
			),
		).resolves.toMatchObject({ path: "index.html" });
		expect(vfs.read("index.html")).toBe(HTML.replace("page", "site"));
	});

	it("refuses a search that matches nothing, without any side effect", async () => {
		const { options, state, tools, vfs } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "x", search: "not-in-the-file" },
				options(),
			),
		).rejects.toThrow(/not found/);
		expect(vfs.read("index.html")).toBe(HTML);
		expect(state.writeRevision).toBe(1);
	});

	it("escalates repeated missing snippets and resets the guard after success", async () => {
		const { options, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		expect(state.lastFailedEditSearch).toBeNull();
		expect(state.failedEditRepeats).toBe(0);
		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "x", search: "first miss" },
				options(),
			),
		).rejects.toThrow(/not found/);
		expect(state.lastFailedEditSearch).toBe("first miss");
		expect(state.failedEditRepeats).toBe(1);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "x", search: "second miss" },
				options(),
			),
		).rejects.toThrow(/not found/);
		expect(state.lastFailedEditSearch).toBe("second miss");
		expect(state.failedEditRepeats).toBe(1);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "x", search: "second miss" },
				options(),
			),
		).rejects.toThrow(
			/STOP retrying this snippet[\s\S]*read_file[\s\S]*verbatim[\s\S]*write_file/,
		);
		expect(state.failedEditRepeats).toBe(2);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "site", search: "page" },
			options(),
		);
		expect(state.lastFailedEditSearch).toBeNull();
		expect(state.failedEditRepeats).toBe(0);
	});

	it("refuses an identical search and replace, without any side effect", async () => {
		const { options, state, tools, vfs } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "page", search: "page" },
				options(),
			),
		).rejects.toThrow(/identical/);
		expect(vfs.read("index.html")).toBe(HTML);
		expect(state.writeRevision).toBe(1);
	});

	it("refuses an ambiguous search that matches more than once", async () => {
		const { options, state, tools, vfs } = setup();
		const content = "<p>twice</p><p>twice</p>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "once", search: "twice" },
				options(),
			),
		).rejects.toThrow(/2 times/);
		expect(vfs.read("index.html")).toBe(content);
		expect(state.writeRevision).toBe(1);
	});

	it("counts OVERLAPPING occurrences as ambiguous too", async () => {
		const { options, state, tools, vfs } = setup();
		// "</div></div>" occurs at two (overlapping) positions here; a
		// split-based count would see one and silently edit the wrong spot.
		const content = "<div><div><p>x</p></div></div></div>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{
					path: "index.html",
					replace: "<aside>new</aside></div></div>",
					search: "</div></div>",
				},
				options(),
			),
		).rejects.toThrow(/2 times/);
		expect(vfs.read("index.html")).toBe(content);
		expect(state.writeRevision).toBe(1);
	});

	it("uses the trimEnd line tier and replaces the exact original span", async () => {
		const { options, state, tools, vfs } = setup();
		const content = [
			"<main>",
			"\t<section>   ",
			"\t\t<h2>Old title</h2>\t",
			"\t</section>",
			"</main>",
		].join("\n");
		const search = [
			"\t<section>",
			"\t\t<h2>Old title</h2>",
			"\t</section>",
		].join("\n");
		const replace = [
			"\t<section>",
			"\t\t<h2>Prix élevé $&99</h2>",
			"\t</section>",
		].join("\n");
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		const output = materialize(
			await tools.edit_file.execute?.(
				{ path: "index.html", replace, search },
				options(),
			),
		);

		const expected = ["<main>", replace, "</main>"].join("\n");
		expect(output.bytes).toBe(Buffer.byteLength(expected, "utf-8"));
		expect(vfs.read("index.html")).toBe(expected);
		expect(state.reviewedRevision).toBe(1);
		expect(state.writeRevision).toBe(2);
	});

	it("reconstructs CRLF spans with and without a final searched newline", async () => {
		const { options, tools, vfs } = setup();
		const content = "<main>\r\n\t<h2>Old</h2>   \r\n\t<p>Copy</p>\t\r\n</main>";
		const search = "\t<h2>Old</h2>\n\t<p>Copy</p>";
		const replace = "\t<h2>New</h2>\n\t<p>Copy</p>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace, search },
			options(),
		);
		expect(vfs.read("index.html")).toBe(`<main>\r\n${replace}\r\n</main>`);

		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);
		await tools.edit_file.execute?.(
			{
				path: "index.html",
				replace: "replacement",
				search: `${search}\n`,
			},
			options(),
		);
		expect(vfs.read("index.html")).toBe("<main>\r\nreplacement</main>");
	});

	it("rejects ambiguity in the trimEnd line tier", async () => {
		const { options, state, tools, vfs } = setup();
		const content = [
			"<main>",
			"\t<h2>Old</h2>   ",
			"\t<p>Copy</p>",
			"<hr>",
			"\t<h2>Old</h2>\t",
			"\t<p>Copy</p>",
			"</main>",
		].join("\n");
		const search = "\t<h2>Old</h2>\n\t<p>Copy</p>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "replacement", search },
				options(),
			),
		).rejects.toThrow(/appears 2 times/);
		expect(vfs.read("index.html")).toBe(content);
		expect(state.writeRevision).toBe(1);
	});

	it("uses the trim line tier and replaces the exact indented span", async () => {
		const { options, state, tools, vfs } = setup();
		const content = [
			"<main>",
			"\t<h2>Old</h2>",
			"\t<p>Copy</p>",
			"</main>",
		].join("\n");
		const search = "  <h2>Old</h2>\n  <p>Copy</p>";
		const replace = "  <h2>New</h2>\n  <p>Better copy</p>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace, search },
			options(),
		);

		expect(vfs.read("index.html")).toBe(
			["<main>", replace, "</main>"].join("\n"),
		);
		expect(state.writeRevision).toBe(2);
	});

	it("rejects ambiguity in the trim line tier", async () => {
		const { options, state, tools, vfs } = setup();
		const content = [
			"<main>",
			"\t<h2>Old</h2>",
			"\t<p>Copy</p>",
			"<hr>",
			"  <h2>Old</h2>",
			"  <p>Copy</p>",
			"</main>",
		].join("\n");
		const search = "<h2>Old</h2>\n<p>Copy</p>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "replacement", search },
				options(),
			),
		).rejects.toThrow(/appears 2 times/);
		expect(vfs.read("index.html")).toBe(content);
		expect(state.writeRevision).toBe(1);
	});

	it("uses the first matching line tier even when the next tier is ambiguous", async () => {
		const { options, tools, vfs } = setup();
		const content = [
			"<main>",
			"\t<h2>Old</h2>   ",
			"\t<p>Copy</p>\t",
			"  <h2>Old</h2> ",
			"  <p>Copy</p>\t",
			"</main>",
		].join("\n");
		const search = "\t<h2>Old</h2>\n\t<p>Copy</p>";
		const replace = "\t<h2>New</h2>\n\t<p>Copy</p>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace, search },
			options(),
		);

		expect(vfs.read("index.html")).toBe(
			["<main>", replace, "  <h2>Old</h2> ", "  <p>Copy</p>\t", "</main>"].join(
				"\n",
			),
		);
	});

	it("uses an exact match even when trimEnd would be ambiguous", async () => {
		const { options, tools, vfs } = setup();
		const content = "\t<p>Old</p>   \n\t<p>Old</p> \n";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await tools.edit_file.execute?.(
			{
				path: "index.html",
				replace: "\t<p>New</p>",
				search: "\t<p>Old</p>   ",
			},
			options(),
		);

		expect(vfs.read("index.html")).toBe("\t<p>New</p>\n\t<p>Old</p> \n");
	});

	it("matches partial-line snippets only through the exact tier", async () => {
		const { options, state, tools, vfs } = setup();
		const content = "<div>prefix <span>Old</span> suffix</div>";
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		await tools.edit_file.execute?.(
			{
				path: "index.html",
				replace: "<span>New</span>",
				search: "<span>Old</span>",
			},
			options(),
		);
		expect(vfs.read("index.html")).toBe(
			"<div>prefix <span>New</span> suffix</div>",
		);

		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);
		await expect(
			tools.edit_file.execute?.(
				{
					path: "index.html",
					replace: "<span>New</span>",
					search: "\t<span>Old</span>",
				},
				options(),
			),
		).rejects.toThrow(/not found/);
		expect(vfs.read("index.html")).toBe(content);
		expect(state.writeRevision).toBe(3);
	});

	it("applies a unique edit, keeps $-patterns literal, and returns exact utf-8 bytes", async () => {
		const { options, state, tools, vfs } = setup();
		await tools.write_file.execute?.(
			{ content: "<h1>Old title</h1><p>rest</p>", path: "index.html" },
			options(),
		);

		const output = materialize(
			await tools.edit_file.execute?.(
				// $& would expand to the matched text under naive String.replace;
				// the accented chars pin byte accounting to utf-8, not .length.
				{
					path: "index.html",
					replace: "<h1>Prix élevé $&99</h1>",
					search: "<h1>Old title</h1>",
				},
				options(),
			),
		);

		const expected = "<h1>Prix élevé $&99</h1><p>rest</p>";
		expect(output.path).toBe("index.html");
		expect(output.bytes).toBe(Buffer.byteLength(expected, "utf-8"));
		expect(vfs.read("index.html")).toBe(expected);
		expect(state.writeRevision).toBe(2);
	});

	it("deletes a snippet when replace is empty — and the schema allows it", async () => {
		const { options, state, tools, vfs } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		// The Tool type erases the zod schema; at runtime it IS the zod object.
		expect(
			(tools.edit_file.inputSchema as z.ZodType).safeParse({
				path: "index.html",
				replace: "",
				search: "page",
			}).success,
		).toBe(true);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "", search: "page" },
			options(),
		);

		expect(vfs.read("index.html")).toBe(HTML.replace("page", ""));
		expect(state.writeRevision).toBe(2);
	});

	it("seals the build: no write or edit is possible after an accepted finish", async () => {
		const { options, state, tools, vfs } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await completeRequiredPasses(tools, options);
		await expect(
			tools.finish.execute?.({ summary: "Done." }, options()),
		).resolves.toEqual({ accepted: true });

		// A [finish, edit_file] step must not mutate the published snapshot.
		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "sneaky", search: "page" },
				options(),
			),
		).rejects.toThrow(/sealed/);
		await expect(
			tools.write_file.execute?.(
				{ content: "<p>replaced wholesale</p>", path: "index.html" },
				options(),
			),
		).rejects.toThrow(/sealed/);
		expect(vfs.read("index.html")).toBe(HTML);
		expect(state.writeRevision).toBe(1);
	});

	it("an edit invalidates the review: finish demands a fresh re-read and screenshot", async () => {
		const { options, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await completeRequiredPasses(tools, options);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "Improved", search: "page" },
			options(),
		);
		expect(state.reviewedRevision).toBe(1);
		expect(state.writeRevision).toBe(2);

		await expect(
			tools.finish.execute?.({ summary: "Edited but unreviewed." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("Re-read"),
		});

		await tools.read_file.execute?.({ path: "index.html" }, options());
		await expect(
			tools.finish.execute?.({ summary: "Still not rendered." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("on the current index.html"),
		});

		await tools.screenshot_page.execute?.({}, options("shot_2"));
		await expect(
			tools.finish.execute?.({ summary: "Freshly reviewed." }, options()),
		).resolves.toEqual({ accepted: true });
	});
});

describe("finish guard", () => {
	it("refuses while index.html is missing", async () => {
		const { options, state, tools } = setup();

		const output = await tools.finish.execute?.(
			{ summary: "A page." },
			options(),
		);

		expect(output).toMatchObject({ accepted: false });
		expect(state.finishAccepted).toBe(false);
		expect(state.summary).toBeNull();
	});

	it("accepts a full write after its final screenshot review", async () => {
		const { options, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		expect(state.reviewedRevision).toBe(state.writeRevision);

		// A full write is already source-reviewed, so zero screenshot passes
		// must hit the pass-count branch rather than the re-read branch.
		await expect(
			tools.finish.execute?.({ summary: "Too early." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining(
				`0 of ${REQUIRED_SCREENSHOT_PASSES} required screenshot review`,
			),
		});

		await completeRequiredPasses(tools, options);
		const accepted = await tools.finish.execute?.(
			{ summary: "Souk Heat direction, warm editorial." },
			options(),
		);

		expect(accepted).toEqual({ accepted: true });
		expect(state.finishAccepted).toBe(true);
		expect(state.screenshotPasses).toBe(REQUIRED_SCREENSHOT_PASSES);
		expect(state.summary).toBe("Souk Heat direction, warm editorial.");
	});

	it("a refused finish does not stop the loop; an accepted one does", async () => {
		const { options, state, tools } = setup();
		const conditions = buildStopConditions(state);
		const finishStop = conditions[1];

		if (!finishStop) {
			throw new Error("expected the accepted-finish stop condition");
		}

		await tools.finish.execute?.({ summary: "Too early." }, options());

		// This is the hasToolCall("finish") bug the closure replaces: the tool
		// WAS called, but the refusal must keep the loop running.
		expect(await finishStop({ steps: [] })).toBe(false);

		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await completeRequiredPasses(tools, options);
		await tools.finish.execute?.({ summary: "Done for real." }, options());

		expect(await finishStop({ steps: [] })).toBe(true);
	});

	it("requires only a fresh screenshot review after a full rewrite", async () => {
		const { options, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await completeRequiredPasses(tools, options);
		await tools.write_file.execute?.(
			{ content: HTML.replace("page", "improved page"), path: "index.html" },
			options(),
		);
		expect(state.reviewedRevision).toBe(state.writeRevision);

		await expect(
			tools.finish.execute?.({ summary: "Not rendered yet." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("on the current index.html"),
		});

		await tools.screenshot_page.execute?.({}, options("shot_final"));
		await expect(
			tools.finish.execute?.({ summary: "Freshly reviewed." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("does not require screenshots for a text-only review mode", async () => {
		const { options, state, tools } = setup({ screenshotRequired: false });
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Code reviewed." }, options()),
		).resolves.toEqual({ accepted: true });
		expect(state.screenshotRevision).toBe(0);
	});
});

describe("page-theme finish gate", () => {
	it("describes the enforced root position and token-borne radius law", async () => {
		const prompt = await buildSiteBuilderSystemPrompt();

		expect(prompt).toContain("Comments or other rules may precede it");
		expect(prompt).toContain("first :root block in that first <style>");
		expect(prompt).toContain("consume var(--radius) directly");
		expect(prompt).toContain("min(var(--radius)");
		expect(prompt).toContain("bare calc(var(--radius) * N) is never a cap");
		expect(prompt).not.toContain("or through calc() multiples");
		expect(prompt).not.toContain(
			"world's explicit shape/radius law overrides this default",
		);
		expect(prompt).not.toContain("must open with a :root block");
		expect(prompt).not.toContain("9999px");
	});

	it("accepts a page that declares and consumes the contract tokens", async () => {
		const { options, tools } = setup({ screenshotRequired: false });
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Tokenized page." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("accepts the first :root block after comments and earlier rules", async () => {
		const { options, tools } = setup({ screenshotRequired: false });
		const prefixedRoot = HTML.replace(
			"<style>:root {",
			"<style>/* Design tokens follow. */\nhtml { min-height: 100%; }\n:root {",
		);
		await tools.write_file.execute?.(
			{ content: prefixedRoot, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Tokenized page." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("ignores closing braces inside comments in the first :root block", async () => {
		const { options, tools } = setup({ screenshotRequired: false });
		const commentedRoot = HTML.replace(
			"<style>:root {",
			"<style>:root {\n\t/* NIGHT ground } stays inside this comment. */",
		);
		await tools.write_file.execute?.(
			{ content: commentedRoot, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Tokenized page." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("rejects a page with a missing contract token declaration", async () => {
		const { options, state, tools } = setup({ screenshotRequired: false });
		const missingAccent = HTML.replace("\t--accent: #d29a43;\n", "");
		await tools.write_file.execute?.(
			{ content: missingAccent, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Incomplete tokens." }, options()),
		).rejects.toThrow(/missing required page-theme tokens \(--accent\)/);
		expect(state.finishAccepted).toBe(false);
		expect(state.summary).toBeNull();
	});

	it("rejects required tokens that are declared but never consumed", async () => {
		const { options, state, tools } = setup({ screenshotRequired: false });
		const unconsumed = HTML.replace(
			"\tbackground: var(--background);",
			"\tbackground: inherit;",
		)
			.replace("\tcolor: var(--foreground);", "\tcolor: inherit;")
			.replace("\tfont-family: var(--font-body);", "\tfont-family: inherit;")
			.replace("a { color: var(--primary); }", "a { color: inherit; }");
		await tools.write_file.execute?.(
			{ content: unconsumed, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Unused tokens." }, options()),
		).rejects.toThrow(
			/does not consume required page-theme tokens.*--background.*--foreground.*--primary.*--font-body/,
		);
		expect(state.finishAccepted).toBe(false);
		expect(state.summary).toBeNull();
	});

	it("rejects a page that declares --radius but hardcodes its only radius", async () => {
		const { options, state, tools } = setup({ screenshotRequired: false });
		const unconsumedRadius = HTML.replace(
			"button { border-radius: var(--radius); }",
			"button { border-radius: 999px; }",
		);
		await tools.write_file.execute?.(
			{ content: unconsumedRadius, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Literal radius." }, options()),
		).rejects.toThrow(/does not consume required page-theme tokens.*--radius/);
		expect(state.finishAccepted).toBe(false);
		expect(state.summary).toBeNull();
	});
});

describe("brand-marker finish gate", () => {
	it("documents and accepts deterministic nav/footer brand wrappers", async () => {
		const prompt = await buildSiteBuilderSystemPrompt();

		expect(prompt).toContain('EXACTLY ONE data-brand="nav"');
		expect(prompt).toContain('data-brand="footer"');
		expect(prompt).toContain("<a>, <figure>, or <article>");
		expect(prompt).toContain("PROJECT BRAND ASSET");
		expect(prompt).toContain("aria-label");
		expect(prompt).toContain("restorable brand text");

		const { options, tools } = setup({ screenshotRequired: false });
		const withFooterBrand = HTML.replace(
			"</body>",
			'<footer><article data-brand="footer">Wandit</article></footer></body>',
		);
		await tools.write_file.execute?.(
			{ content: withFooterBrand, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Marked brand wrappers." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("accepts aria-label and image alt as restorable brand text", async () => {
		const { options, tools } = setup({ screenshotRequired: false });
		const accessibleLogoMarks = HTML.replace(
			'<a data-brand="nav" href="/">Wandit</a>',
			'<a data-brand="nav" href="/" aria-label="Wandit home"><img src="/nav-logo.svg" alt=""></a>',
		).replace(
			"</body>",
			'<footer><article data-brand="footer"><img src="/footer-logo.svg" alt="Wandit"></article></footer></body>',
		);
		await tools.write_file.execute?.(
			{ content: accessibleLogoMarks, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Accessible logo marks." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it.each([
		{
			html: HTML.replace(
				'<a data-brand="nav" href="/">Wandit</a>',
				'<a data-brand="nav" href="/"></a>',
			),
			label: "empty rebuilt nav wrapper",
			message:
				'data-brand="nav" must include restorable brand text: non-empty text content, aria-label, or an inner <img> with non-empty alt',
		},
		{
			html: HTML.replace(
				"</body>",
				'<footer><article data-brand="footer"><img src="/logo.svg" alt=""></article></footer></body>',
			),
			label: "logo-only footer wrapper with empty alt",
			message:
				'data-brand="footer" must include restorable brand text: non-empty text content, aria-label, or an inner <img> with non-empty alt',
		},
	])("rejects $label with the exact restorable-text error", async ({
		html,
		message,
	}) => {
		const { options, tools } = setup({ screenshotRequired: false });
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		let error: unknown;

		try {
			await tools.finish.execute?.(
				{ summary: "Missing restorable text." },
				options(),
			);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(message);
	});

	it.each([
		{
			html: HTML.replace(
				"</nav>",
				'<a data-brand="nav" href="./">Second mark</a></nav>',
			),
			label: "nav",
			message: /exactly one data-brand="nav".*found 2/,
		},
		{
			html: HTML.replace(
				"</body>",
				'<footer><a data-brand="footer">One</a><a data-brand="footer">Two</a></footer></body>',
			),
			label: "footer",
			message: /at most one data-brand="footer".*found 2/,
		},
	])("rejects duplicate $label role markers", async ({ html, message }) => {
		const { options, tools } = setup({ screenshotRequired: false });
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Duplicate markers." }, options()),
		).rejects.toThrow(message);
	});

	it.each([
		{
			html: HTML.replace("<header><nav>", "<section>").replace(
				"</nav></header>",
				"</section>",
			),
			label: "nav outside the chassis",
			message: /data-brand="nav" must be inside the nav\/header chassis/,
		},
		{
			html: HTML.replace('<a data-brand="nav" href="/">Wandit</a>', "").replace(
				"</body>",
				'<footer><nav><a data-brand="nav" href="/">Wrong nav mark</a></nav></footer></body>',
			),
			label: "nav inside a footer nav",
			message: /data-brand="nav" must be inside the nav\/header chassis/,
		},
		{
			html: HTML.replace(
				"</main>",
				'<a data-brand="footer">Wrong footer mark</a></main>',
			),
			label: "footer outside footer",
			message: /data-brand="footer" must be inside the page footer/,
		},
	])("rejects $label", async ({ html, message }) => {
		const { options, tools } = setup({ screenshotRequired: false });
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Wrong marker scope." }, options()),
		).rejects.toThrow(message);
	});

	it.each([
		{
			replacement: '<div data-brand="nav">Wandit</div>',
			message: /stampable <a>, <figure>, or <article> wrapper.*<div>/,
			tag: "div",
		},
		{
			replacement:
				'<svg><text data-brand="nav"><tspan>Wandit</tspan></text></svg>',
			message: /stampable <a>, <figure>, or <article> wrapper.*<text>/,
			tag: "text",
		},
		{
			replacement: '<form><article data-brand="nav">Wandit</article></form>',
			message:
				/data-brand="nav" is on <article>.*not stampable in this location/,
			tag: "article inside a form",
		},
	])("rejects a non-stampable $tag marker", async ({
		message,
		replacement,
	}) => {
		const { options, tools } = setup({ screenshotRequired: false });
		const html = HTML.replace(
			'<a data-brand="nav" href="/">Wandit</a>',
			replacement,
		);
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Unstampable marker." }, options()),
		).rejects.toThrow(message);
	});
});

describe("generate_image tool", () => {
	it("refuses once the image budget is exhausted", async () => {
		const { options, state, tools } = setup();
		state.imageSequence = MAX_IMAGES;

		const output = await tools.generate_image.execute?.(IMAGE_INPUT, options());

		expect(output).toMatchObject({
			message: expect.stringContaining("budget"),
			status: "failed",
		});
		expect(generateBuildImage).not.toHaveBeenCalled();
	});

	it("returns a small generated output and shows the image via toModelOutput", async () => {
		const { options, state, tools } = setup();
		const url =
			"https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png";
		vi.mocked(generateBuildImage).mockResolvedValue({
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			status: "generated",
			url,
		});

		const output = materialize(
			await tools.generate_image.execute?.(IMAGE_INPUT, options("img_1")),
		);

		expect(generateBuildImage).toHaveBeenCalledWith({
			aspect: "16:9",
			attemptId: "attempt_1",
			index: 1,
			projectId: "project_1",
			prompt: IMAGE_INPUT.prompt,
		});
		expect(output).toEqual({
			aspect: "16:9",
			role: "hero background",
			status: "generated",
			url,
		});
		expect(state.imagesGenerated).toBe(1);
		// The raw bytes must never land in the transcript output.
		expect(JSON.stringify(output)).not.toContain("aW1nLWJ5dGVz");

		if (output.status !== "generated") {
			throw new Error("generate_image must succeed here");
		}

		const modelOutput = await tools.generate_image.toModelOutput?.({
			input: IMAGE_INPUT,
			output,
			toolCallId: "img_1",
		});

		if (modelOutput?.type !== "content") {
			throw new Error("expected a content tool result");
		}

		expect(modelOutput.value).toEqual([
			{ text: expect.stringContaining(url), type: "text" },
			{
				data: { data: "aW1nLWJ5dGVz", type: "data" },
				mediaType: "image/png",
				type: "file",
			},
		]);
	});

	it("passes handler failures through without counting the image", async () => {
		const { options, state, tools } = setup();
		vi.mocked(generateBuildImage).mockResolvedValue({
			message: "gateway exploded",
			status: "failed",
		});

		const output = await tools.generate_image.execute?.(IMAGE_INPUT, options());

		expect(output).toEqual({ message: "gateway exploded", status: "failed" });
		expect(state.imagesGenerated).toBe(0);

		// The key sequence is never reused: a retry after a failure must not
		// collide with an image a concurrent call may have uploaded meanwhile.
		vi.mocked(generateBuildImage).mockResolvedValue({
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.png",
		});
		await tools.generate_image.execute?.(IMAGE_INPUT, options("img_2"));
		expect(generateBuildImage).toHaveBeenLastCalledWith(
			expect.objectContaining({ index: 2 }),
		);
	});

	it("reserves budget and key indexes atomically across parallel calls", async () => {
		const { options, state, tools } = setup();
		state.imagesGenerated = MAX_IMAGES - 2;
		state.imageSequence = MAX_IMAGES - 2;
		vi.mocked(generateBuildImage).mockImplementation(async ({ index }) => ({
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			status: "generated",
			url: `https://assets.example.com/img-${index}.png`,
		}));

		// The SDK executes one step's tool calls concurrently (Promise.all), so
		// three calls with two budget slots left must produce two DISTINCT keys
		// and one refusal — not three writes to the same object.
		const outputs = (
			await Promise.all([
				tools.generate_image.execute?.(IMAGE_INPUT, options("img_a")),
				tools.generate_image.execute?.(IMAGE_INPUT, options("img_b")),
				tools.generate_image.execute?.(IMAGE_INPUT, options("img_c")),
			])
		).map((output) => materialize(output));

		expect(
			vi.mocked(generateBuildImage).mock.calls.map(([call]) => call.index),
		).toEqual([MAX_IMAGES - 1, MAX_IMAGES]);
		expect(
			outputs.filter((output) => output.status === "generated"),
		).toHaveLength(2);
		expect(outputs.filter((output) => output.status === "failed")).toHaveLength(
			1,
		);
		expect(state.imagesGenerated).toBe(MAX_IMAGES);
	});
});

describe("animate_image tool", () => {
	it("refuses once the video budget is exhausted", async () => {
		const { options, state, tools } = setup();
		state.videoSequence = MAX_VIDEOS;

		const output = await tools.animate_image.execute?.(VIDEO_INPUT, options());

		expect(output).toMatchObject({
			message: expect.stringContaining("budget"),
			status: "failed",
		});
		expect(generateBuildVideo).not.toHaveBeenCalled();
	});

	it("returns the video URL with the source image as poster", async () => {
		const { options, state, tools } = setup();
		const url =
			"https://assets.example.com/sites/project_1/assets/attempt_1/vid-1.mp4";
		vi.mocked(generateBuildVideo).mockResolvedValue({
			mediaType: "video/mp4",
			status: "generated",
			url,
		});

		const output = materialize(
			await tools.animate_image.execute?.(VIDEO_INPUT, options("vid_1")),
		);

		expect(generateBuildVideo).toHaveBeenCalledWith({
			aspect: "16:9",
			attemptId: "attempt_1",
			imageUrl: VIDEO_INPUT.imageUrl,
			index: 1,
			motionPrompt: VIDEO_INPUT.motionPrompt,
			projectId: "project_1",
		});
		expect(output).toEqual({
			posterUrl: VIDEO_INPUT.imageUrl,
			status: "generated",
			url,
		});
		expect(state.videosGenerated).toBe(1);
	});

	it("relays unavailable without counting the video — graceful fallback", async () => {
		const { options, state, tools } = setup();
		vi.mocked(generateBuildVideo).mockResolvedValue({
			message: "video animation not configured — use the still image instead",
			status: "unavailable",
		});

		const output = await tools.animate_image.execute?.(VIDEO_INPUT, options());

		expect(output).toEqual({
			message: "video animation not configured — use the still image instead",
			status: "unavailable",
		});
		expect(state.videosGenerated).toBe(0);
	});

	it("counts a failed attempt and never reuses the key index", async () => {
		const { options, state, tools } = setup();
		vi.mocked(generateBuildVideo).mockResolvedValue({
			message: "gateway exploded",
			status: "failed",
		});

		const output = await tools.animate_image.execute?.(VIDEO_INPUT, options());

		expect(output).toEqual({ message: "gateway exploded", status: "failed" });
		expect(state.videosGenerated).toBe(0);

		// The key sequence is never reused: a retry after a failure must not
		// collide with a video a concurrent call may have uploaded meanwhile.
		vi.mocked(generateBuildVideo).mockResolvedValue({
			mediaType: "video/mp4",
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/vid-2.mp4",
		});
		await tools.animate_image.execute?.(VIDEO_INPUT, options("vid_2"));
		expect(generateBuildVideo).toHaveBeenLastCalledWith(
			expect.objectContaining({ index: 2 }),
		);
		expect(state.videosGenerated).toBe(1);
	});
});

describe("progress events", () => {
	it("emits the full write → screenshot → finish trail to the listener", async () => {
		const events: BuildProgressEvent[] = [];
		const { options, tools } = setup({
			onEvent: (event) => events.push(event),
		});

		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options("w1"),
		);
		await tools.read_file.execute?.({ path: "index.html" }, options("r1"));
		await completeRequiredPasses(tools, options);
		await tools.read_file.execute?.({ path: "index.html" }, options("r2"));
		await tools.finish.execute?.({ summary: "warm editorial page" }, options());

		const types = events.map((event) => event.type);

		expect(types[0]).toBe("page-written");
		expect(events[0]).toMatchObject({ html: HTML, kind: "write" });
		// Each pass announces itself before its capture lands.
		expect(types).toContain("screenshot-start");
		const passEvents = events.filter(
			(event) => event.type === "screenshot-pass",
		);
		expect(passEvents).toHaveLength(REQUIRED_SCREENSHOT_PASSES);
		expect(passEvents[0]).toMatchObject({
			overflow: { desktop: 0, mobile: 12 },
			pass: 1,
		});
		expect(
			passEvents[0]?.type === "screenshot-pass" && passEvents[0].shots.length,
		).toBe(2);
		expect(events.at(-1)).toEqual({
			summary: "warm editorial page",
			type: "finished",
		});
	});

	it("labels an edit as kind edit and a generated image with its url", async () => {
		const events: BuildProgressEvent[] = [];
		const { options, tools } = setup({
			onEvent: (event) => events.push(event),
		});
		vi.mocked(generateBuildImage).mockResolvedValue({
			imageBase64: "aW1n",
			mediaType: "image/png",
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
		});

		await tools.write_file.execute?.(
			{
				content: "<!doctype html><html><body>original</body></html>",
				path: "index.html",
			},
			options("w1"),
		);
		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "revised", search: "original" },
			options("e1"),
		);
		await tools.generate_image.execute?.(IMAGE_INPUT, options("img_1"));

		expect(
			events.filter((event) => event.type === "page-written"),
		).toMatchObject([{ kind: "write" }, { kind: "edit" }]);
		expect(events).toContainEqual({
			role: "hero background",
			type: "image-start",
		});
		expect(events).toContainEqual({
			role: "hero background",
			type: "image-generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
		});
	});

	it("shields the build from a throwing listener", async () => {
		const { options, tools, vfs } = setup({
			onEvent: () => {
				throw new Error("listener bug");
			},
		});

		const output = materialize(
			await tools.write_file.execute?.(
				{ content: HTML, path: "index.html" },
				options("w1"),
			),
		);

		expect(output).toMatchObject({ path: "index.html" });
		expect(vfs.read("index.html")).toBe(HTML);
	});

	it("emits write-start when the model begins streaming the file", async () => {
		const events: BuildProgressEvent[] = [];
		const { options, tools } = setup({
			onEvent: (event) => events.push(event),
		});

		await tools.write_file.onInputStart?.(options("w1"));

		expect(events).toEqual([{ type: "write-start" }]);
	});

	it("emits video-generated for a successful animate_image call", async () => {
		const events: BuildProgressEvent[] = [];
		const { options, tools } = setup({
			onEvent: (event) => events.push(event),
		});
		vi.mocked(generateBuildVideo).mockResolvedValue({
			mediaType: "video/mp4",
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/vid-1.mp4",
		});

		await tools.animate_image.execute?.(VIDEO_INPUT, options("vid_1"));

		expect(events).toEqual([{ type: "video-generated" }]);
	});

	it("does not emit image-generated when the provider fails", async () => {
		const events: BuildProgressEvent[] = [];
		const { options, tools } = setup({
			onEvent: (event) => events.push(event),
		});
		vi.mocked(generateBuildImage).mockResolvedValue({
			message: "gateway exploded",
			status: "failed",
		});

		await tools.generate_image.execute?.(IMAGE_INPUT, options("img_1"));

		expect(events.map((event) => event.type)).toEqual(["image-start"]);
	});
});
