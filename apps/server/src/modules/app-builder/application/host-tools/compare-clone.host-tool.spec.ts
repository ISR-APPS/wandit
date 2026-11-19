import type {
	CompareCloneHostToolInput,
	SiteCaptureManifest,
} from "@wandit/contracts";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { HostToolContext } from "../../domain/ports/host-tools";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import { cutScreenshotBands } from "../../infrastructure/site-clone/band-images";
import { createCompareCloneTool } from "./compare-clone.host-tool";

const CAPTURE_ID = "0123456789abcdef";
const CAPTURE_DIR = `/tmp/wandit/clone/${CAPTURE_ID}`;
const SCREENSHOT_PATH = "/tmp/clone-desktop.png";
const INPUT: CompareCloneHostToolInput = {
	captureId: CAPTURE_ID,
	screenshotPath: SCREENSHOT_PATH,
	viewport: "desktop",
};

/** The tool on a fake web app sandbox with no file. */
async function setup() {
	const provider = new FakeSandboxProvider();
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "web-app@1.1.0",
	});
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		framework: "web-app",
		holdEventId: null,
		knownThemeFile: () => null,
		mode: "build",
		onThemeFileWritten: () => {},
		organizationId: null,
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: null },
		templateVersion: "web-app@1.1.0",
		turnId: "turn-1",
	};
	const execute = createCompareCloneTool(
		{ logger: { info: () => {}, warn: () => {} } },
		context,
	).execute;
	if (execute === undefined) {
		throw new Error("compare_clone must define execute");
	}
	const compare = (input: CompareCloneHostToolInput) =>
		execute(input, { context: {}, messages: [], toolCallId: "tc-1" });
	return { compare, provider, sandbox };
}

/**
 * A white desktop page of two bands (1440 x 1800 px) as a PNG. Each band
 * holds one dark block of 600 x 400 px, which is 18.5 % of the band.
 * `hasSecondBlock: false` leaves the second band empty.
 */
function pageImage(hasSecondBlock: boolean): Promise<Uint8Array> {
	const block = {
		create: {
			background: "#101828",
			channels: 3,
			height: 400,
			width: 600,
		},
	} as const;
	return sharp({
		create: { background: "#ffffff", channels: 3, height: 1800, width: 1440 },
	})
		.composite([
			{ input: block, left: 120, top: 200 },
			...(hasSecondBlock ? [{ input: block, left: 120, top: 1100 }] : []),
		])
		.png()
		.toBuffer();
}

/** Writes the capture of the two-band page, as `capture_site` does, and the clone screenshot. */
async function writeCaptureAndScreenshot(
	sandbox: Awaited<ReturnType<typeof setup>>["sandbox"],
	screenshot: Uint8Array,
) {
	const { bands, pageHeightCssPx } = await cutScreenshotBands(
		await pageImage(true),
		"desktop",
	);
	const manifest: SiteCaptureManifest = {
		desktop: { bandCount: bands.length, pageHeightCssPx },
		mobile: null,
		url: "https://example.com/",
	};
	await sandbox.writeFiles([
		{ content: JSON.stringify(manifest), path: `${CAPTURE_DIR}/capture.json` },
		...bands.map((band, index) => ({
			content: band,
			path: `${CAPTURE_DIR}/desktop/0${index + 1}.jpg`,
		})),
		{ content: screenshot, path: SCREENSHOT_PATH },
	]);
}

/** Queues the answers of the two size checks: capture.json with the screenshot, then the two bands. */
function respondSmallFiles(provider: FakeSandboxProvider) {
	const small = {
		exitCode: 0,
		stderr: "",
		stdout: "regular file|1000\nregular file|1000\n",
	};
	provider.respondTo("stat", small);
	provider.respondTo("stat", small);
}

describe("createCompareCloneTool", () => {
	// Each row fails on one rule only: the ".." resolution, the /tmp/ prefix, the image extension.
	it.each([
		"/tmp/../vercel/sandbox/public/logo.png",
		"/vercel/sandbox/public/logo.png",
		"/tmp/a.txt",
	])("refuses the screenshot path %s and reads no file", async (screenshotPath) => {
		const { compare, provider } = await setup();

		const output = await compare({ ...INPUT, screenshotPath });

		expect(output).toMatchObject({ status: "failed" });
		expect(provider.calls.filter((call) => call.method === "readFile")).toEqual(
			[],
		);
	});

	it("passes a screenshot equal to the source and writes no diff file", async () => {
		const { compare, provider, sandbox } = await setup();
		respondSmallFiles(provider);
		await writeCaptureAndScreenshot(sandbox, await pageImage(true));

		const output = await compare(INPUT);

		expect(output).toMatchObject({
			bands: [
				{ band: 1, diffPath: null, mismatchPercent: 0 },
				{ band: 2, diffPath: null, mismatchPercent: 0 },
			],
			callsLeft: 7,
			cloneHeightCssPx: 1800,
			passed: true,
			sourceHeightCssPx: 1800,
			status: "compared",
			worstPercent: 0,
		});
		expect(await sandbox.listFiles(`${CAPTURE_DIR}/diff`)).toEqual([]);
	});

	it("fails a screenshot with one changed band and writes the diff image of that band", async () => {
		const { compare, provider, sandbox } = await setup();
		respondSmallFiles(provider);
		await writeCaptureAndScreenshot(sandbox, await pageImage(false));

		const output = await compare(INPUT);

		const diffPath = `${CAPTURE_DIR}/diff/desktop-02.jpg`;
		expect(output).toMatchObject({
			bands: [
				{ band: 1, diffPath: null, mismatchPercent: 0 },
				{ band: 2, diffPath, sourcePath: `${CAPTURE_DIR}/desktop/02.jpg` },
			],
			passed: false,
			status: "compared",
		});
		// The block that the clone does not have is 18.5 % of the band.
		expect(output).toHaveProperty("worstPercent", expect.closeTo(18.5, 0));
		expect(await sandbox.listFiles(`${CAPTURE_DIR}/diff`)).toEqual([diffPath]);
	});

	it("refuses a screenshot above 20 MB before it reads the file", async () => {
		const { compare, provider, sandbox } = await setup();
		await writeCaptureAndScreenshot(sandbox, await pageImage(true));
		provider.respondTo("stat", {
			exitCode: 0,
			stderr: "",
			stdout: "regular file|1000\nregular file|30000000\n",
		});

		const output = await compare(INPUT);

		expect(output).toMatchObject({ status: "failed" });
		expect(provider.calls.filter((call) => call.method === "readFile")).toEqual(
			[],
		);
	});

	it("refuses call 9 of one turn", async () => {
		const { compare, provider } = await setup();
		// The capture folder is empty, so stat prints no line and exits 1.
		for (let call = 1; call <= 8; call += 1) {
			provider.respondTo("stat", { exitCode: 1, stderr: "", stdout: "" });
		}

		const outputs = [];
		for (let call = 1; call <= 9; call += 1) {
			outputs.push(await compare(INPUT));
		}

		// The first 8 calls reach the capture folder, which is empty here.
		expect(outputs[7]).toEqual({
			message: "No capture with this id. Call capture_site first.",
			status: "failed",
		});
		expect(outputs[8]).toEqual({
			message: "Compare budget exhausted (8 per turn)",
			status: "failed",
		});
	});
});
