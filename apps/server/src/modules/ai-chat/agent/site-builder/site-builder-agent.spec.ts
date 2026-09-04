import { ToolLoopAgent } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { openrouterGenerationIdFromError } from "../../../metering/domain/gateway-metering";
import {
	BuilderStallError,
	classifyBuildFailure,
} from "../../../pages/domain/build-failure";
import { extractBriefUserPhotoUrls } from "./brief-user-photos";
import type { BuildProgressEvent } from "./build-progress";
import { buildSiteBuilderSystemPrompt } from "./builder-prompt";
import { buildCodSiteBuilderSystemPrompt } from "./cod-builder-prompt";
import { generateBuildImage, MAX_IMAGES } from "./generate-image";
import { generateBuildVideo, MAX_VIDEOS } from "./generate-video";
import {
	type ScreenshotCapture,
	type ScreenshotSession,
	ScreenshotUnavailableError,
} from "./screenshot";
import { buildSimpleCodSiteBuilderSystemPrompt } from "./simple-cod-builder-prompt";
import {
	buildStopConditions,
	createBuilderTools,
	createBuildLoopState,
	fallbackBuildSummary,
	MAX_SCREENSHOT_PASSES_BY_KIND,
	REQUIRED_SCREENSHOT_PASSES_BY_KIND,
	resolveBuilderReasoningEffort,
	runSiteBuild,
	STALL_TIMEOUT_MS,
} from "./site-builder-agent";
import { VirtualFileSystem } from "./virtual-files";

// These specs exercise the default tool kind ("website") unless a test
// passes pageKind explicitly; COD-specific budgets are tested by name.
const REQUIRED_SCREENSHOT_PASSES = REQUIRED_SCREENSHOT_PASSES_BY_KIND.website;
const MAX_SCREENSHOT_PASSES = MAX_SCREENSHOT_PASSES_BY_KIND.website;

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

vi.mock("./brief-user-photos", () => ({
	extractBriefUserPhotoUrls: vi.fn(),
}));

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

const BROKEN_COD_FORM =
	'<form data-wandit-event="wandit:lead"><label>Phone<input type="tel" name="phone"></label><input type="text" name="company" data-wandit-hp><button type="submit">Order now</button></form>';

const COD_PRODUCT_IMG =
	'<img src="https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png" alt="Product">';

const BROKEN_COD_HTML = HTML.replace(
	"<header><nav>",
	'<header><section class="hero">',
)
	.replace("</nav></header>", "</section></header>")
	.replace("<h1>page</h1>", `<h1>page</h1>${COD_PRODUCT_IMG}`)
	.replace("</main>", `${BROKEN_COD_FORM}</main>`);

const COD_FORM = `<form id="order-form">
	<label>Name<input type="text" name="name" autocomplete="name"></label>
	<label>Phone<input type="tel" name="phone" autocomplete="tel"></label>
	<input type="text" name="company" data-wandit-hp>
	<button type="submit">Order now</button>
</form>`;

const COD_LEAD_SCRIPT = `<script>
	const orderForm = document.getElementById("order-form");
	orderForm.addEventListener("submit", function (event) {
		event.preventDefault();
		const fields = new FormData(orderForm);
		document.addEventListener("wandit:lead:result", function (result) {
			orderForm.hidden = result.detail.ok === true;
		}, { once: true });
		document.dispatchEvent(new CustomEvent("wandit:lead", {
			detail: {
				name: fields.get("name"),
				phone: fields.get("phone"),
			},
		}));
	});
</script>`;

const COD_HTML = HTML.replace("<header><nav>", '<header><section class="hero">')
	.replace("</nav></header>", "</section></header>")
	.replace("<h1>page</h1>", `<h1>page</h1>${COD_PRODUCT_IMG}`)
	.replace("</main>", `${COD_FORM}${COD_LEAD_SCRIPT}</main>`);

// Same page, minus the acknowledgement listener: the lead still dispatches,
// so only the success gate can reject it.
const COD_HTML_WITHOUT_LEAD_RESULT = COD_HTML.replace(
	/\s*document\.addEventListener\("wandit:lead:result"[\s\S]*?\{ once: true \}\);/,
	"",
);

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
	imageEditModel?: string;
	imageModel?: string;
	meteringService?: MeteringService;
	onEvent?: (event: BuildProgressEvent) => void;
	pageKind?: "cod" | "website";
	screenshotRequired?: boolean;
	screenshots?: ScreenshotSession;
	usageEventId?: string;
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
		subject: { actorUserId: "user_1" },
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

function mockSiteBuildStream() {
	return vi
		.spyOn(ToolLoopAgent.prototype, "stream")
		.mockImplementation(async function (this: ToolLoopAgent) {
			const tools = this.tools as unknown as ReturnType<typeof setup>["tools"];
			await tools.write_file.execute?.({ content: HTML, path: "index.html" }, {
				messages: [],
				toolCallId: "build_start_write",
			} as never);

			return {
				fullStream: (async function* () {})(),
				steps: Promise.resolve([]),
			} as never;
		});
}

beforeEach(() => {
	vi.mocked(extractBriefUserPhotoUrls).mockReset().mockReturnValue([]);
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

	it("reports a byte-identical rewrite without changing review gates", async () => {
		const { options, screenshots, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await completeRequiredPasses(tools, options);
		const before = {
			reviewedRevision: state.reviewedRevision,
			screenshotPasses: state.screenshotPasses,
			screenshotRevision: state.screenshotRevision,
			writeRevision: state.writeRevision,
		};

		await expect(
			tools.write_file.execute?.(
				{ content: HTML, path: "./index.html" },
				options(),
			),
		).resolves.toEqual({
			bytes: Buffer.byteLength(HTML, "utf-8"),
			path: "index.html",
			unchanged: true,
		});
		expect(state).toMatchObject(before);
		expect(screenshots.capture).toHaveBeenCalledTimes(
			REQUIRED_SCREENSHOT_PASSES,
		);
		await expect(
			tools.finish.execute?.({ summary: "Nothing changed." }, options()),
		).resolves.toEqual({ accepted: true });
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

	it("refuses captures at the hard cap and lets a later edit finish", async () => {
		const { options, screenshots, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		for (let pass = 1; pass <= MAX_SCREENSHOT_PASSES; pass += 1) {
			await expect(
				tools.screenshot_page.execute?.({}, options(`shot_${pass}`)),
			).resolves.toMatchObject({ refused: false, unavailable: false });
		}

		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "Improved", search: "page" },
			options("edit_after_cap"),
		);
		expect(state.screenshotRevision).toBe(1);
		expect(state.writeRevision).toBe(2);

		await expect(
			tools.screenshot_page.execute?.({}, options("shot_refused")),
		).resolves.toEqual({
			message:
				"screenshot budget exhausted (4 per build) — finish now with the current page",
			refused: true,
		});
		expect(screenshots.capture).toHaveBeenCalledTimes(MAX_SCREENSHOT_PASSES);
		expect(state.screenshotPasses).toBe(MAX_SCREENSHOT_PASSES);

		await expect(
			tools.finish.execute?.({ summary: "Finished at the cap." }, options()),
		).resolves.toEqual({ accepted: true });
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

	it("stops snippet editing after five total failures across the build", async () => {
		const { options, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "x", search: "missing" },
				options(),
			),
		).rejects.toThrow(/not found/);
		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "page", search: "page" },
				options(),
			),
		).rejects.toThrow(/identical/);
		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "[", search: "<" },
				options(),
			),
		).rejects.toThrow(/appears .* times/);

		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "site", search: "page" },
			options(),
		);
		expect(state.failedEditAttempts).toBe(3);

		await expect(
			tools.edit_file.execute?.(
				{ path: "styles.css", replace: "x", search: "missing" },
				options(),
			),
		).rejects.toThrow(/exactly ONE file/);
		await expect(
			tools.edit_file.execute?.(
				{ path: "index.html", replace: "x", search: "still missing" },
				options(),
			),
		).rejects.toThrow(
			"stop snippet-editing; rewrite the affected section with write_file, or screenshot and finish.",
		);
		expect(state.failedEditAttempts).toBe(5);
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
		expect(state.reviewedRevision).toBe(2);
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

	it("returns updated whole-line context and marks the edited revision reviewed", async () => {
		const { options, state, tools } = setup();
		const lines = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`);
		const content = lines.join("\n");
		const replace = ["updated 15", "updated 16", "updated 17"].join("\n");
		await tools.write_file.execute?.(
			{ content, path: "index.html" },
			options(),
		);

		const output = materialize(
			await tools.edit_file.execute?.(
				{
					path: "index.html",
					replace,
					search: ["line 15", "line 16"].join("\n"),
				},
				options(),
			),
		);
		const expectedContext = [
			"Lines 7-25 of index.html after the edit:",
			...lines.slice(6, 14),
			"updated 15",
			"updated 16",
			"updated 17",
			...lines.slice(16, 24),
		].join("\n");

		expect(output).toMatchObject({
			bytes: Buffer.byteLength(
				[
					...lines.slice(0, 14),
					"updated 15",
					"updated 16",
					"updated 17",
					...lines.slice(16),
				].join("\n"),
				"utf-8",
			),
			context: expectedContext,
			path: "index.html",
			revision: 2,
		});
		expect(output.context).not.toContain("line 15");
		expect(output.context).not.toContain("line 16");
		expect(state.reviewedRevision).toBe(2);
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

	it("accepts pass-2 edits from their contexts without a third screenshot", async () => {
		const { options, screenshots, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await tools.screenshot_page.execute?.({}, options("shot_1"));

		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "Improved", search: "page" },
			options("pass_1_edit"),
		);
		await tools.screenshot_page.execute?.({}, options("shot_2"));
		await tools.edit_file.execute?.(
			{ path: "index.html", replace: "Polished", search: "Improved" },
			options("pass_2_edit"),
		);

		expect(state.screenshotPasses).toBe(REQUIRED_SCREENSHOT_PASSES);
		expect(state.screenshotRevision).toBe(2);
		expect(state.reviewedRevision).toBe(3);
		expect(state.writeRevision).toBe(3);
		expect(screenshots.capture).toHaveBeenCalledTimes(2);
		await expect(
			tools.finish.execute?.({ summary: "Pass-2 fixes applied." }, options()),
		).resolves.toEqual({ accepted: true });
		expect(screenshots.capture).toHaveBeenCalledTimes(2);
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
		// must hit the pass-count branch rather than any source-review concern.
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
			{ summary: "Bazar Heat direction, warm editorial." },
			options(),
		);

		expect(accepted).toEqual({ accepted: true });
		expect(state.finishAccepted).toBe(true);
		expect(state.screenshotPasses).toBe(REQUIRED_SCREENSHOT_PASSES);
		expect(state.summary).toBe("Bazar Heat direction, warm editorial.");
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

	it("accepts a valid rewrite after the two required review passes", async () => {
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
			tools.finish.execute?.({ summary: "Rewritten after review." }, options()),
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

describe("COD builder prompt", () => {
	it("pins post-pass-4 finishing, world price exceptions, and genre wids", async () => {
		const prompt = await buildCodSiteBuilderSystemPrompt();

		expect(prompt).toContain(
			"After the fourth screenshot pass, apply the batch of fixes and call finish directly",
		);
		expect(prompt).toContain(
			"Four screenshot passes are the minimum and six are the hard maximum",
		);
		expect(prompt).toContain('data-wandit-placeholder="1"');
		expect(
			prompt.match(
				/unless the base world explicitly puts first price in the sticky bar/g,
			),
		).toHaveLength(2);
		expect(prompt).toContain('"trust-footer" for the trust footer');
		expect(prompt).not.toContain('"site-footer" for the trust footer');
	});
});

describe("PHOTO QUALITY GATE prompts", () => {
	it("requires visual judgment, faithful enhancement, and a raw-photo fallback in every mode", async () => {
		const prompts = await Promise.all([
			buildSiteBuilderSystemPrompt(),
			buildCodSiteBuilderSystemPrompt(),
			buildSimpleCodSiteBuilderSystemPrompt(),
		]);

		for (const prompt of prompts) {
			expect(prompt).toContain("PHOTO QUALITY GATE");
			expect(prompt).toContain("Before writing HTML, LOOK at every one");
			expect(prompt).toContain("MUST NOT be placed raw in a prime");
			expect(prompt).toContain("product stays EXACTLY as photographed");
			expect(prompt).toContain(
				"NEVER invent the product from text when a real photo exists",
			);
			expect(prompt).toContain(
				"a weak image of the real product still beats no product",
			);
			expect(prompt).toContain(
				"enhancement never adds features, badges, text, or packaging",
			);
			expect(prompt).toContain(
				"Trust your own eyes first and any per-photo quality note",
			);
		}
	});

	it("adds the low-quality prime-slot check to SIMPLE COD pass 2", async () => {
		const prompt = await buildSimpleCodSiteBuilderSystemPrompt();

		expect(prompt).toContain(
			"no low-quality raw photo occupies a prime slot when an enhanced edit exists or could have been made within budget",
		);
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

describe("COD finish gate", () => {
	it("rejects the legacy form with no name-capable input", async () => {
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: BROKEN_COD_HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Broken COD order page." }, options()),
		).rejects.toThrow(/capture <form>.*name-capable <input>/);
	});

	it("rejects an attribute-only lead marker after the name field is fixed", async () => {
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		const html = BROKEN_COD_HTML.replace(
			"<label>Phone",
			'<label>Name<input name="name" autocomplete="name"></label><label>Phone',
		);
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Inert COD order page." }, options()),
		).rejects.toThrow(
			/must dispatch a "wandit:lead" CustomEvent from a <script>/,
		);
	});

	it("accepts a hero-scoped brand marker and the complete lead form pack", async () => {
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: COD_HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "COD order page." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("rejects a COD page without a single <img> element", async () => {
		// The product must be SEEN and slots must be editor-replaceable —
		// div/svg placeholder frames never get the panel's upload control.
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: COD_HTML.replace(COD_PRODUCT_IMG, ""), path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Imageless COD page." }, options()),
		).rejects.toThrow(/must contain at least one <img>/);
	});

	it("requires the COD pass minimum (4) and honors the COD cap (6)", async () => {
		const { options, tools } = setup({ pageKind: "cod" });
		await tools.write_file.execute?.(
			{ content: COD_HTML, path: "index.html" },
			options(),
		);

		for (let pass = 1; pass <= 2; pass += 1) {
			await tools.screenshot_page.execute?.({}, options(`cod_shot_${pass}`));
		}

		// Two passes satisfy a WEBSITE build but not a COD build.
		await expect(
			tools.finish.execute?.({ summary: "Too early." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining(
				`2 of ${REQUIRED_SCREENSHOT_PASSES_BY_KIND.cod} required`,
			),
		});

		for (let pass = 3; pass <= MAX_SCREENSHOT_PASSES_BY_KIND.cod; pass += 1) {
			await expect(
				tools.screenshot_page.execute?.({}, options(`cod_shot_${pass}`)),
			).resolves.toMatchObject({ refused: false, unavailable: false });
		}

		await expect(
			tools.screenshot_page.execute?.({}, options("cod_shot_refused")),
		).resolves.toEqual({
			message:
				`screenshot budget exhausted (${MAX_SCREENSHOT_PASSES_BY_KIND.cod} ` +
				"per build) — finish now with the current page",
			refused: true,
		});

		await expect(
			tools.finish.execute?.({ summary: "COD page at the cap." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("gives COD-safe placement advice for an unstamplable hero badge", async () => {
		const marker = '<a data-brand="nav" href="/">Wandit</a>';
		const formWithMarker = COD_FORM.replace(
			"<label>",
			'<article data-brand="nav">Wandit</article><label>',
		);
		const html = COD_HTML.replace(COD_FORM, "").replace(marker, formWithMarker);
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		let error: unknown;

		try {
			await tools.finish.execute?.(
				{ summary: "Invalid hero badge." },
				options(),
			);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain(
			"hero <header> or hero <section> scope",
		);
		expect((error as Error).message).toContain(
			'<a href="#order-form" data-brand="nav"> hero badge',
		);
		expect((error as Error).message).not.toContain(
			"recognized nav/header/footer chassis",
		);
	});

	it.each([
		{
			html: COD_HTML.replace("<main>", "<nav>Forbidden</nav><main>"),
			label: "a nav element",
			message: /must contain zero <nav> elements \(found 1\)/,
		},
		{
			html: COD_HTML.replace(COD_FORM, ""),
			label: "no lead form",
			message: /exactly one <form> \(found 0\)/,
		},
		{
			html: COD_HTML.replace("</main>", `${COD_FORM}</main>`),
			label: "multiple lead forms",
			message: /exactly one <form> \(found 2\)/,
		},
		{
			html: COD_HTML.replace('type="tel"', 'type="text"'),
			label: "no telephone input",
			message: /at least one input\[type=tel\]/,
		},
		{
			html: COD_HTML.replace(
				'<label>Name<input type="text" name="name" autocomplete="name"></label>',
				"",
			),
			label: "no name-capable input",
			message: /capture <form>.*name-capable <input>/,
		},
		{
			html: COD_HTML.replace(
				COD_LEAD_SCRIPT,
				'<div data-wandit-event="wandit:lead"></div>',
			),
			label: "only an inert lead event marker",
			message: /must dispatch a "wandit:lead" CustomEvent from a <script>/,
		},
		{
			html: COD_HTML.replace(" data-wandit-hp", ""),
			label: "no honeypot",
			message: /exactly one data-wandit-hp honeypot \(found 0\)/,
		},
		{
			html: COD_HTML.replace('name="phone"', 'name="phone" data-wandit-hp'),
			label: "multiple honeypots",
			message: /exactly one data-wandit-hp honeypot \(found 2\)/,
		},
		{
			html: COD_HTML_WITHOUT_LEAD_RESULT,
			label: "an unacknowledged success state",
			message: /must handle the "wandit:lead:result" acknowledgement event/,
		},
	])("rejects $label", async ({ html, message }) => {
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: html, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Invalid COD page." }, options()),
		).rejects.toThrow(message);
	});

	it("still forbids the nav brand marker inside a footer", async () => {
		const marker = '<a data-brand="nav" href="/">Wandit</a>';
		const inFooter = COD_HTML.replace(marker, "").replace(
			"</body>",
			`<footer><section>${marker}</section></footer></body>`,
		);
		const { options, tools } = setup({
			pageKind: "cod",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: inFooter, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Wrong marker scope." }, options()),
		).rejects.toThrow(
			/nearest section scope being <header> or <section>.*never/,
		);
	});

	it("keeps the website validator unchanged", async () => {
		const { options, tools } = setup({
			pageKind: "website",
			screenshotRequired: false,
		});
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Website page." }, options()),
		).resolves.toEqual({ accepted: true });
	});
});

describe("self-contained script finish gate", () => {
	const GSAP_CDN_TAGS =
		'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>' +
		'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>';
	const HTML_WITH_GSAP_CDN = HTML.replace("</body>", `${GSAP_CDN_TAGS}</body>`);

	it("sanctions the pinned GSAP CDN pair — it will be auto-inlined", async () => {
		const { options, tools } = setup({ screenshotRequired: false });
		await tools.write_file.execute?.(
			{ content: HTML_WITH_GSAP_CDN, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "GSAP page." }, options()),
		).resolves.toEqual({ accepted: true });
	});

	it("rejects any other external script with corrective guidance", async () => {
		const { options, state, tools } = setup({ screenshotRequired: false });
		const withLenis = HTML_WITH_GSAP_CDN.replace(
			"</body>",
			'<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js"></script></body>',
		);
		await tools.write_file.execute?.(
			{ content: withLenis, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Lenis page." }, options()),
		).rejects.toThrow(
			/loads external scripts \(https:\/\/cdn\.jsdelivr\.net\/npm\/lenis.*only\s+sanctioned external scripts/s,
		);
		expect(state.finishAccepted).toBe(false);
	});

	it("runSiteBuild ships the CDN pair inlined into the canonical HTML", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async function (this: ToolLoopAgent) {
				const tools = this.tools as unknown as ReturnType<
					typeof setup
				>["tools"];
				await tools.write_file.execute?.(
					{ content: HTML_WITH_GSAP_CDN, path: "index.html" },
					{ messages: [], toolCallId: "gsap_write" } as never,
				);

				return {
					fullStream: (async function* () {})(),
					steps: Promise.resolve([]),
				} as never;
			});

		try {
			const build = await runSiteBuild({
				attemptId: "attempt_gsap",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "GSAP page",
			});
			const index = build.files.find((file) => file.path === "index.html");

			expect(index?.content).toContain("/*gsap core 3.12.5 inlined*/");
			expect(index?.content).toContain("/*gsap ScrollTrigger 3.12.5 inlined*/");
			expect(index?.content).not.toContain("cdn.jsdelivr.net");
			expect(index?.content).toContain("data-wid=");
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
		}
	});
});

describe("finish-pass document title", () => {
	async function buildWith(html: string, title: string) {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async function (this: ToolLoopAgent) {
				const tools = this.tools as unknown as ReturnType<
					typeof setup
				>["tools"];
				await tools.write_file.execute?.(
					{ content: html, path: "index.html" },
					{ messages: [], toolCallId: "title_write" } as never,
				);

				return {
					fullStream: (async function* () {})(),
					steps: Promise.resolve([]),
				} as never;
			});

		try {
			const build = await runSiteBuild({
				attemptId: "attempt_title",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title,
			});

			return build.files.find((file) => file.path === "index.html")?.content;
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
		}
	}

	it("fills a missing <title> with the Brain's short human title", async () => {
		// The HTML fixture's <head> carries only the token <style>.
		const content = await buildWith(HTML, "Huile d argan bio");

		expect(content).toContain("<title>Huile d argan bio</title>");
	});

	it("keeps the title the builder wrote", async () => {
		const authored = HTML.replace(
			"<head>",
			"<head><title>Serum Éclat — livraison 48 h</title>",
		);
		const content = await buildWith(authored, "Huile d argan bio");

		expect(content).toContain("<title>Serum Éclat — livraison 48 h</title>");
		expect(content).not.toContain("Huile d");
	});
});

const IMAGE_CHILD_EVENT = {
	id: "image_event_1",
	operation: "image",
	pricingSnapshot: {
		estimatedUnitUsdMicros: 134_400,
		mode: "measured",
		operation: "image",
		source: "operation_registry_reservation",
		unit: "image",
		usdMicrosPerCredit: 40_000,
	},
	reservedCredits: 336,
};
const VIDEO_CHILD_EVENT = {
	id: "video_event_1",
	operation: "video",
	pricingSnapshot: {
		estimatedUnitUsdMicros: 210_000,
		mode: "measured",
		operation: "video",
		source: "operation_registry_reservation",
		unit: "video",
		usdMicrosPerCredit: 40_000,
	},
	reservedCredits: 550,
};

describe("generate_image tool", () => {
	it("creates and settles an image child event under the page-build event", async () => {
		const metering = {
			captureGeneration: vi.fn(async () => ({ id: "image_ref_1" })),
			// gemini-3-pro-image default: $0.1344 → 336 cc, above the 100 cc floor.
			estimateMeasuredCost: vi.fn(async () => ({
				costUsdMicros: 134_400,
				credits: 336,
				unitUsdMicros: 134_400,
			})),
			reserve: vi.fn(async () => IMAGE_CHILD_EVENT),
			settle: vi.fn(async () => undefined),
			usdMicrosPerCredit: 40_000,
		};
		const { options, tools } = setup({
			meteringService: metering as unknown as MeteringService,
			usageEventId: "page_event_1",
		});
		const providerMetadata = {
			gateway: { generationId: "generation_image_1" },
		};
		const usage = { inputTokens: 9, outputTokens: 2 };
		vi.mocked(generateBuildImage).mockResolvedValue({
			height: 1024,
			imageBase64: "aW1n",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata,
			status: "generated",
			url: "https://assets.example.com/img-1.png",
			width: 1536,
			usage,
		});

		await tools.generate_image.execute?.(IMAGE_INPUT, options("img_1"));

		expect(metering.reserve).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			expect.objectContaining({
				attemptRef: "attempt_1:image:1",
				credits: 336,
				estimatedCostUsdMicros: 134_400,
				idempotencyKey: "page-build-image:page_event_1:1",
				measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 1 },
				parentEventId: "page_event_1",
			}),
		);
		expect(metering.captureGeneration).toHaveBeenCalledWith("image_event_1", {
			providerMetadata,
			stepUsage: {
				metering: { fixedUnits: 1 },
				providerUsage: usage,
			},
		});
		expect(metering.settle).toHaveBeenCalledWith(
			"image_event_1",
			expect.objectContaining({
				costUsdMicros: 134_400,
				finalCredits: 336,
				pricing: "direct",
				pricingSnapshot: expect.objectContaining({
					mode: "measured",
					outcome: "delivered",
					source: "measured_local",
				}),
			}),
		);
	});

	it("charges a provider-completed image when direct R2 storage fails", async () => {
		const metering = {
			captureGeneration: vi.fn(async () => ({ id: "image_ref_1" })),
			estimateMeasuredCost: vi.fn(async () => ({
				costUsdMicros: 134_400,
				credits: 336,
				unitUsdMicros: 134_400,
			})),
			refund: vi.fn(async () => undefined),
			reserve: vi.fn(async () => IMAGE_CHILD_EVENT),
			settle: vi.fn(async () => undefined),
			usdMicrosPerCredit: 40_000,
		};
		const { options, state, tools } = setup({
			meteringService: metering as unknown as MeteringService,
			usageEventId: "page_event_1",
		});
		vi.mocked(generateBuildImage).mockResolvedValue({
			message: "R2 unavailable",
			model: "test/image-model",
			providerMetadata: {
				gateway: { generationId: "generation_image_storage_failure" },
			},
			providerUnits: 1,
			status: "failed",
			usage: { inputTokens: 9, outputTokens: 2 },
		});

		await expect(
			tools.generate_image.execute?.(IMAGE_INPUT, options("img_storage")),
		).resolves.toEqual({ message: "R2 unavailable", status: "failed" });
		expect(state.imagesGenerated).toBe(0);
		expect(metering.captureGeneration).toHaveBeenCalledWith(
			"image_event_1",
			expect.objectContaining({
				stepUsage: expect.objectContaining({
					metering: { fixedUnits: 1 },
				}),
			}),
		);
		expect(metering.settle).toHaveBeenCalledWith(
			"image_event_1",
			expect.objectContaining({
				finalCredits: 336,
				pricingSnapshot: expect.objectContaining({ units: 1 }),
			}),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("does not settle an image child without a durable gateway reference", async () => {
		const metering = {
			captureGeneration: vi.fn(async () => null),
			estimateMeasuredCost: vi.fn(async () => null),
			reserve: vi.fn(async () => IMAGE_CHILD_EVENT),
			settle: vi.fn(async () => undefined),
			usdMicrosPerCredit: 40_000,
		};
		const { options, tools } = setup({
			meteringService: metering as unknown as MeteringService,
			usageEventId: "page_event_1",
		});
		vi.mocked(generateBuildImage).mockResolvedValue({
			height: 1024,
			imageBase64: "aW1n",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata: {},
			status: "generated",
			url: "https://assets.example.com/img-1.png",
			width: 1536,
			usage: { inputTokens: 9, outputTokens: 2 },
		});

		await expect(
			tools.generate_image.execute?.(IMAGE_INPUT, options("img_1")),
		).rejects.toThrow("AI Gateway generation id is missing");
		expect(metering.captureGeneration).toHaveBeenCalledTimes(3);
		expect(metering.settle).not.toHaveBeenCalled();
	});

	it("propagates a child reservation refusal before calling the image provider", async () => {
		const refusal = new Error("payment required");
		const metering = {
			estimateMeasuredCost: vi.fn(async () => null),
			reserve: vi.fn(async () => Promise.reject(refusal)),
			usdMicrosPerCredit: 40_000,
		};
		const { options, tools } = setup({
			meteringService: metering as unknown as MeteringService,
			usageEventId: "page_event_1",
		});

		await expect(
			tools.generate_image.execute?.(IMAGE_INPUT, options("img_1")),
		).rejects.toBe(refusal);
		expect(generateBuildImage).not.toHaveBeenCalled();
	});

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
			height: 1024,
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata: {},
			status: "generated",
			url,
			width: 1536,
		});

		const output = materialize(
			await tools.generate_image.execute?.(IMAGE_INPUT, options("img_1")),
		);

		expect(generateBuildImage).toHaveBeenCalledWith({
			aspect: "16:9",
			attemptId: "attempt_1",
			index: 1,
			metering: { operation: "image", organizationId: null, userId: "user_1" },
			projectId: "project_1",
			prompt: IMAGE_INPUT.prompt,
		});
		expect(output).toEqual({
			aspect: "16:9",
			height: 1024,
			role: "hero background",
			status: "generated",
			url,
			width: 1536,
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
		// The real pixels reach the model, so it can write width/height on the
		// <img> instead of guessing a box.
		const [marker] = modelOutput.value;
		expect(marker?.type === "text" && marker.text).toContain("1536x1024px");
	});

	it("threads the queue-time image model snapshots into the handler", async () => {
		const { options, tools } = setup({
			imageEditModel: "google/gemini-3-pro-image",
			imageModel: "meta/muse-image-1.0",
		});
		vi.mocked(generateBuildImage).mockResolvedValue({
			height: 1024,
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			model: "meta/muse-image-1.0",
			providerMetadata: {},
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
			width: 1536,
		});

		await tools.generate_image.execute?.(IMAGE_INPUT, options("img_1"));

		// The handler must see the attempt's snapshot, never the worker env.
		expect(generateBuildImage).toHaveBeenCalledWith(
			expect.objectContaining({
				imageEditModel: "google/gemini-3-pro-image",
				imageModel: "meta/muse-image-1.0",
			}),
		);
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
			height: 1024,
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata: {},
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-2.png",
			width: 1536,
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
			height: 1024,
			imageBase64: "aW1nLWJ5dGVz",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata: {},
			status: "generated",
			url: `https://assets.example.com/img-${index}.png`,
			width: 1536,
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

	it("keeps the first six distinct source photos", async () => {
		const { options, tools } = setup();
		vi.mocked(generateBuildImage).mockResolvedValue({
			height: 1024,
			imageBase64: "aW1n",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata: {},
			status: "generated",
			url: "https://assets.example.com/img-sources.png",
			width: 1536,
			usage: { inputTokens: 9, outputTokens: 2 },
		});
		const sourceImageUrls = Array.from(
			{ length: 8 },
			(_, index) => `https://assets.example.com/uploads/u/photo-${index}.jpg`,
		);

		const output = await tools.generate_image.execute?.(
			{
				...IMAGE_INPUT,
				// A repeated URL is one photo; the two extras are dropped.
				sourceImageUrls: [sourceImageUrls[0] as string, ...sourceImageUrls],
			},
			options("img_sources"),
		);

		expect(output).toMatchObject({ status: "generated" });
		expect(generateBuildImage).toHaveBeenLastCalledWith(
			expect.objectContaining({ sourceImageUrls: sourceImageUrls.slice(0, 6) }),
		);
	});
});

describe("animate_image tool", () => {
	it("creates and settles a video child event under the page-build event", async () => {
		const metering = {
			captureGeneration: vi.fn(async () => ({ id: "video_ref_1" })),
			// Kling std $0.042/s × 5 s = $0.21 → 525 cc, below the 550 cc floor.
			estimateMeasuredCost: vi.fn(async () => ({
				costUsdMicros: 210_000,
				credits: 525,
				unitUsdMicros: 42_000,
			})),
			reserve: vi.fn(async () => VIDEO_CHILD_EVENT),
			settle: vi.fn(async () => undefined),
			usdMicrosPerCredit: 40_000,
		};
		const { options, tools } = setup({
			meteringService: metering as unknown as MeteringService,
			usageEventId: "page_event_1",
		});
		const providerMetadata = {
			gateway: { generationId: "generation_video_1" },
		};
		vi.mocked(generateBuildVideo).mockResolvedValue({
			mediaType: "video/mp4",
			model: "test/video-model",
			providerMetadata,
			status: "generated",
			url: "https://assets.example.com/vid-1.mp4",
		});

		await tools.animate_image.execute?.(VIDEO_INPUT, options("vid_1"));

		expect(metering.reserve).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1" },
			expect.objectContaining({
				attemptRef: "attempt_1:video:1",
				credits: 550,
				estimatedCostUsdMicros: 210_000,
				measuredTerms: { estimatedUnitUsdMicros: 210_000, units: 1 },
				idempotencyKey: "page-build-video:page_event_1:1",
				model: "klingai/kling-v2.6-i2v",
				parentEventId: "page_event_1",
			}),
		);
		expect(metering.captureGeneration).toHaveBeenCalledWith("video_event_1", {
			providerMetadata,
			stepUsage: {
				metering: { fixedUnits: 1 },
				providerUsage: null,
			},
		});
		expect(metering.settle).toHaveBeenCalledWith(
			"video_event_1",
			expect.objectContaining({
				costUsdMicros: 210_000,
				finalCredits: 525,
				pricing: "direct",
			}),
		);
	});

	it("charges a provider-completed video when direct R2 storage fails", async () => {
		const metering = {
			captureGeneration: vi.fn(async () => ({ id: "video_ref_1" })),
			refund: vi.fn(async () => undefined),
			// Kling std $0.042/s × 5 s = $0.21 → 525 cc, below the 550 cc floor.
			estimateMeasuredCost: vi.fn(async () => ({
				costUsdMicros: 210_000,
				credits: 525,
				unitUsdMicros: 42_000,
			})),
			reserve: vi.fn(async () => VIDEO_CHILD_EVENT),
			settle: vi.fn(async () => undefined),
			usdMicrosPerCredit: 40_000,
		};
		const { options, state, tools } = setup({
			meteringService: metering as unknown as MeteringService,
			usageEventId: "page_event_1",
		});
		vi.mocked(generateBuildVideo).mockResolvedValue({
			message: "R2 unavailable",
			model: "test/video-model",
			providerMetadata: {
				gateway: { generationId: "generation_video_storage_failure" },
			},
			providerUnits: 1,
			status: "failed",
		});

		await expect(
			tools.animate_image.execute?.(VIDEO_INPUT, options("vid_storage")),
		).resolves.toEqual({ message: "R2 unavailable", status: "failed" });
		expect(state.videosGenerated).toBe(0);
		expect(metering.captureGeneration).toHaveBeenCalledWith(
			"video_event_1",
			expect.objectContaining({
				stepUsage: expect.objectContaining({
					metering: { fixedUnits: 1 },
				}),
			}),
		);
		expect(metering.settle).toHaveBeenCalledWith(
			"video_event_1",
			expect.objectContaining({
				finalCredits: 525,
				pricingSnapshot: expect.objectContaining({ units: 1 }),
			}),
		);
		expect(metering.refund).not.toHaveBeenCalled();
	});

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
			model: "test/video-model",
			providerMetadata: {},
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
			metering: { operation: "video", organizationId: null, userId: "user_1" },
			modelId: "klingai/kling-v2.6-i2v",
			motionPrompt: VIDEO_INPUT.motionPrompt,
			projectId: "project_1",
			voiceControl: false,
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
			model: "test/video-model",
			providerMetadata: {},
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

describe("runSiteBuild", () => {
	it("uses truthful fallback provenance for early and step-limit exits", () => {
		expect(fallbackBuildSummary(3)).toBe(
			"The builder ended without an explicit finish; publishing the last valid revision.",
		);
		expect(fallbackBuildSummary(64)).toBe(
			"Build reached its step budget; publishing the last valid revision.",
		);
	});

	it("honors the composer pick and defers to the provider on auto", () => {
		// No per-model forcing anymore: effort is the explicit pick or the env
		// fallback, and "auto" (the default) sends no reasoning parameter.
		expect(resolveBuilderReasoningEffort("xhigh")).toBe("xhigh");
		expect(resolveBuilderReasoningEffort("low")).toBe("low");
		expect(resolveBuilderReasoningEffort("auto")).toBeUndefined();
		expect(resolveBuilderReasoningEffort()).toBeUndefined();
	});

	it("aborts a no-progress stream and classifies it as provider_timeout", async () => {
		vi.useFakeTimers();
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const onGenerationError = vi.fn();
		const providerAbortError = Object.assign(
			new Error("provider stream aborted"),
			{
				openrouterGenerationId: "gen_stalled_openrouter",
			},
		);
		let streamSignal: AbortSignal | undefined;
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async (options) => {
				const signal = options.abortSignal;

				if (!signal) {
					throw new Error("expected the combined stream abort signal");
				}

				streamSignal = signal;

				return {
					fullStream: (async function* () {
						await new Promise<never>((_, reject) => {
							if (signal.aborted) {
								reject(providerAbortError);
								return;
							}

							signal.addEventListener(
								"abort",
								() => reject(providerAbortError),
								{ once: true },
							);
						});
					})(),
					steps: Promise.resolve([]),
				} as never;
			});
		const callerAbortController = new AbortController();

		try {
			const buildErrorPromise = runSiteBuild({
				abortSignal: callerAbortController.signal,
				attemptId: "attempt_stalled",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/stalled",
				onGenerationError,
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Stalled page",
			}).then(
				() => null,
				(error: unknown) => error,
			);

			await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS);
			const buildError = await buildErrorPromise;
			const generationError = onGenerationError.mock.calls[0]?.[0];

			expect(streamSignal).toBeDefined();
			expect(streamSignal).not.toBe(callerAbortController.signal);
			expect(streamSignal?.aborted).toBe(true);
			expect(streamSignal?.reason).toBeInstanceOf(BuilderStallError);
			expect(callerAbortController.signal.aborted).toBe(false);
			expect(generationError).toBeInstanceOf(BuilderStallError);
			expect(
				(generationError as BuilderStallError).idleMs,
			).toBeGreaterThanOrEqual(STALL_TIMEOUT_MS);
			expect((generationError as BuilderStallError).modelId).toBe(
				"deepseek/stalled",
			);
			expect(openrouterGenerationIdFromError(generationError)).toBe(
				"gen_stalled_openrouter",
			);
			expect(classifyBuildFailure(buildError)).toBe("provider_timeout");
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
			vi.useRealTimers();
		}
	});

	it("publishes a valid revision best-effort when a later step stalls", async () => {
		vi.useFakeTimers();
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const onGenerationError = vi.fn();
		let streamSignal: AbortSignal | undefined;
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async function (this: ToolLoopAgent, options) {
				const signal = options.abortSignal;

				if (!signal) {
					throw new Error("expected the combined stream abort signal");
				}

				streamSignal = signal;
				const tools = this.tools as unknown as ReturnType<
					typeof setup
				>["tools"];
				await tools.write_file.execute?.(
					{ content: HTML, path: "index.html" },
					{ messages: [], toolCallId: "stall_write" } as never,
				);

				return {
					fullStream: (async function* () {
						yield { text: "first step complete", type: "text-delta" };
						await new Promise<void>((resolve) => {
							if (signal.aborted) {
								resolve();
								return;
							}

							signal.addEventListener("abort", () => resolve(), { once: true });
						});
					})(),
					steps: Promise.resolve([]),
				} as never;
			});

		try {
			const buildPromise = runSiteBuild({
				attemptId: "attempt_partial_stall",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/stalled",
				onGenerationError,
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Partial stalled page",
			});

			await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS);
			const build = await buildPromise;

			expect(build.files.some((file) => file.path === "index.html")).toBe(true);
			expect(streamSignal?.aborted).toBe(true);
			expect(onGenerationError).toHaveBeenCalledWith(
				expect.any(BuilderStallError),
			);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
			vi.useRealTimers();
		}
	});

	it("does not abort while a slow builder tool is executing", async () => {
		vi.useFakeTimers();
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		let streamSignal: AbortSignal | undefined;
		vi.mocked(generateBuildImage).mockImplementation(async () => {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, STALL_TIMEOUT_MS + 10_000);
			});

			return {
				height: 1024,
				imageBase64: "aW1nLWJ5dGVz",
				mediaType: "image/png",
				model: "test/image-model",
				providerMetadata: {},
				status: "generated",
				url: "https://assets.example.com/img-slow.png",
				width: 1536,
			};
		});
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async function (this: ToolLoopAgent, options) {
				const signal = options.abortSignal;

				if (!signal) {
					throw new Error("expected the combined stream abort signal");
				}

				streamSignal = signal;
				const tools = this.tools as unknown as ReturnType<
					typeof setup
				>["tools"];
				await options.onToolExecutionStart?.({} as never);
				try {
					await tools.generate_image.execute?.(IMAGE_INPUT, {
						messages: [],
						toolCallId: "slow_image",
					} as never);
				} finally {
					await options.onToolExecutionEnd?.({} as never);
				}
				await tools.write_file.execute?.(
					{ content: HTML, path: "index.html" },
					{ messages: [], toolCallId: "slow_write" } as never,
				);

				return {
					fullStream: (async function* () {})(),
					steps: Promise.resolve([]),
				} as never;
			});

		try {
			const buildPromise = runSiteBuild({
				attemptId: "attempt_slow_tool",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Slow tool page",
			});

			await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS + 1);
			expect(streamSignal?.aborted).toBe(false);
			await vi.advanceTimersByTimeAsync(9_999);
			const build = await buildPromise;

			expect(build.files.some((file) => file.path === "index.html")).toBe(true);
			expect(streamSignal?.aborted).toBe(false);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
			vi.useRealTimers();
		}
	});

	it("keeps a normally progressing stream unaffected", async () => {
		vi.useFakeTimers();
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const progressIntervalMs = STALL_TIMEOUT_MS - 60_000;
		let streamSignal: AbortSignal | undefined;
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async function (this: ToolLoopAgent, options) {
				const signal = options.abortSignal;

				if (!signal) {
					throw new Error("expected the combined stream abort signal");
				}

				streamSignal = signal;
				const tools = this.tools as unknown as ReturnType<
					typeof setup
				>["tools"];
				await tools.write_file.execute?.(
					{ content: HTML, path: "index.html" },
					{ messages: [], toolCallId: "progress_write" } as never,
				);

				return {
					fullStream: (async function* () {
						for (let index = 0; index < 3; index += 1) {
							await new Promise<void>((resolve) => {
								setTimeout(resolve, progressIntervalMs);
							});
							yield { text: `progress-${index}`, type: "text-delta" };
						}
					})(),
					steps: Promise.resolve([]),
				} as never;
			});

		try {
			const buildPromise = runSiteBuild({
				attemptId: "attempt_progressing",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Progressing page",
			});

			for (let part = 0; part < 3; part += 1) {
				await vi.advanceTimersByTimeAsync(progressIntervalMs);
				expect(streamSignal?.aborted).toBe(false);
			}

			const build = await buildPromise;
			expect(build.files.some((file) => file.path === "index.html")).toBe(true);
			expect(streamSignal?.aborted).toBe(false);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
			vi.useRealTimers();
		}
	});

	it("starts a vision-capable build with the brief's user photos attached", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const firstPhoto =
			"https://assets.example.com/public/uploads/user_1/upload_1/front.jpg";
		const secondPhoto =
			"https://assets.example.com/public/uploads/user_2/upload_2/side.webp";
		const brief = `BRAND ASSETS:\n- ${firstPhoto}\n- ${secondPhoto}`;
		vi.mocked(extractBriefUserPhotoUrls).mockReturnValue([
			firstPhoto,
			secondPhoto,
		]);
		const streamSpy = mockSiteBuildStream();

		try {
			await runSiteBuild({
				attemptId: "attempt_photos",
				brief,
				model: "openai/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Photo page",
			});

			expect(extractBriefUserPhotoUrls).toHaveBeenCalledWith(brief);
			expect(streamSpy).toHaveBeenCalledWith({
				abortSignal: expect.any(AbortSignal),
				messages: [
					{
						content: [
							{
								text: `Build the landing page now.\n\nTITLE: Photo page\n\nBRIEF:\n${brief}`,
								type: "text",
							},
							{
								text: `[User photo 1 — URL: ${firstPhoto}]`,
								type: "text",
							},
							{ data: firstPhoto, mediaType: "image", type: "file" },
							{
								text: `[User photo 2 — URL: ${secondPhoto}]`,
								type: "text",
							},
							{ data: secondPhoto, mediaType: "image", type: "file" },
							{
								text: "These are the user's real photos from the brief, attached so you can SEE them. Judge each one's quality before you write HTML, per your PHOTO QUALITY GATE law. To enhance, restage, or refit one to a slot's shape, pass its exact URL from its marker as generate_image sourceImageUrls.",
								type: "text",
							},
						],
						role: "user",
					},
				],
				onToolExecutionEnd: expect.any(Function),
				onToolExecutionStart: expect.any(Function),
			});
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
		}
	});

	it("keeps the plain prompt path for a text-only DeepSeek build", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const photo =
			"https://assets.example.com/public/uploads/user_1/upload_1/front.jpg";
		const brief = `BRAND ASSETS:\n- ${photo}`;
		vi.mocked(extractBriefUserPhotoUrls).mockReturnValue([photo]);
		const streamSpy = mockSiteBuildStream();

		try {
			await runSiteBuild({
				attemptId: "attempt_text_only",
				brief,
				model: "deepseek/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Text-only page",
			});

			expect(extractBriefUserPhotoUrls).not.toHaveBeenCalled();
			expect(streamSpy).toHaveBeenCalledWith({
				abortSignal: expect.any(AbortSignal),
				onToolExecutionEnd: expect.any(Function),
				onToolExecutionStart: expect.any(Function),
				prompt:
					"Build the landing page now.\n\nTITLE: Text-only page\n\n" +
					`BRIEF:\n${brief}`,
			});
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
		}
	});

	it("ships a valid step-limit revision and aggregates usage", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const streamSpy = vi
			.spyOn(ToolLoopAgent.prototype, "stream")
			.mockImplementation(async function (this: ToolLoopAgent) {
				const tools = this.tools as unknown as ReturnType<
					typeof setup
				>["tools"];
				await tools.write_file.execute?.(
					{ content: HTML, path: "index.html" },
					{ messages: [], toolCallId: "budget_write" } as never,
				);

				return {
					fullStream: (async function* () {
						yield {
							error: new Error("gateway failed after the write"),
							type: "error",
						};
					})(),
					steps: Promise.resolve([
						{
							usage: {
								inputTokens: 100,
								outputTokens: 25,
								totalTokens: 125,
							},
						},
						{
							usage: {
								inputTokens: 10,
								outputTokens: 5,
								totalTokens: 15,
							},
						},
						...Array.from({ length: 62 }, () => ({
							usage: {
								inputTokens: undefined,
								outputTokens: undefined,
								totalTokens: undefined,
							},
						})),
					]),
				} as never;
			});

		try {
			const build = await runSiteBuild({
				attemptId: "attempt_budget",
				brief: "Build a substantial warm editorial landing page.",
				model: "deepseek/test",
				projectId: "project_1",
				subject: { actorUserId: "user_1" },
				system: "Build the page with the supplied tools.",
				title: "Budget page",
			});
			const index = build.files.find((file) => file.path === "index.html");

			expect(build).toMatchObject({
				steps: 64,
				summary:
					"Build reached its step budget; publishing the last valid revision.",
				usage: { inputTokens: 110, outputTokens: 30, totalTokens: 140 },
			});
			expect(index?.content).toContain("data-wid=");
			const logs = consoleSpy.mock.calls.flat().join("\n");
			expect(logs).toContain(
				"stream ended with an error; evaluating the last page revision",
			);
			expect(logs).toContain("usage: in=110 out=30 total=140 steps=64");
			expect(logs).toContain("shipping best-effort page at step budget");
		} finally {
			streamSpy.mockRestore();
			consoleSpy.mockRestore();
		}
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
			height: 1024,
			imageBase64: "aW1n",
			mediaType: "image/png",
			model: "test/image-model",
			providerMetadata: {},
			status: "generated",
			url: "https://assets.example.com/sites/project_1/assets/attempt_1/img-1.png",
			width: 1536,
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
			model: "test/video-model",
			providerMetadata: {},
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
