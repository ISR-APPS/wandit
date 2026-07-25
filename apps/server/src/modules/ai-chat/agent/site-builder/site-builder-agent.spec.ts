import { beforeEach, describe, expect, it, vi } from "vitest";

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

const HTML = "<!doctype html><html><body>page</body></html>";

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

	it("accepts index.html, including the ./ prefixed spelling", async () => {
		const { options, tools, vfs } = setup();

		await expect(
			tools.write_file.execute?.(
				{ content: HTML, path: "./index.html" },
				options(),
			),
		).resolves.toMatchObject({ path: "index.html" });
		expect(vfs.read("index.html")).toBe(HTML);
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
		await tools.read_file.execute?.({ path: "index.html" }, options());
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
		await tools.read_file.execute?.({ path: "index.html" }, options());

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

	it("accepts only after the final index.html has been re-read and rendered", async () => {
		const { options, state, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Too early." }, options()),
		).resolves.toMatchObject({ accepted: false });

		await tools.read_file.execute?.({ path: "index.html" }, options());
		await expect(
			tools.finish.execute?.({ summary: "Still too early." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("screenshot_page"),
		});

		await tools.screenshot_page.execute?.({}, options("shot_1"));
		await expect(
			tools.finish.execute?.({ summary: "One pass only." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("1 of 3"),
		});

		await tools.screenshot_page.execute?.({}, options("shot_2"));
		await tools.screenshot_page.execute?.({}, options("shot_3"));
		const accepted = await tools.finish.execute?.(
			{ summary: "Souk Heat direction, warm editorial." },
			options(),
		);

		expect(accepted).toEqual({ accepted: true });
		expect(state.finishAccepted).toBe(true);
		expect(state.screenshotPasses).toBe(3);
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
		await tools.read_file.execute?.({ path: "index.html" }, options());
		await tools.screenshot_page.execute?.({}, options("shot_1"));
		await tools.screenshot_page.execute?.({}, options("shot_2"));
		await tools.screenshot_page.execute?.({}, options("shot_3"));
		await tools.finish.execute?.({ summary: "Done for real." }, options());

		expect(await finishStop({ steps: [] })).toBe(true);
	});

	it("requires fresh code and screenshot reviews after a rewrite", async () => {
		const { options, tools } = setup();
		await tools.write_file.execute?.(
			{ content: HTML, path: "index.html" },
			options(),
		);
		await tools.read_file.execute?.({ path: "index.html" }, options());
		await tools.screenshot_page.execute?.({}, options("shot_1"));
		await tools.write_file.execute?.(
			{ content: HTML.replace("page", "improved page"), path: "index.html" },
			options(),
		);

		await expect(
			tools.finish.execute?.({ summary: "Not reviewed yet." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("Re-read"),
		});

		await tools.read_file.execute?.({ path: "index.html" }, options());
		await expect(
			tools.finish.execute?.({ summary: "Still not rendered." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("screenshot_page"),
		});

		await tools.screenshot_page.execute?.({}, options("shot_2"));
		await expect(
			tools.finish.execute?.({ summary: "Two passes only." }, options()),
		).resolves.toMatchObject({
			accepted: false,
			reason: expect.stringContaining("2 of 3"),
		});

		await tools.screenshot_page.execute?.({}, options("shot_3"));
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
		await tools.read_file.execute?.({ path: "index.html" }, options());

		await expect(
			tools.finish.execute?.({ summary: "Code reviewed." }, options()),
		).resolves.toEqual({ accepted: true });
		expect(state.screenshotRevision).toBe(0);
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
