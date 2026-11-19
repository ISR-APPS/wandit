/**
 * The `compare_clone` host tool of the builder turn. The agent calls it to
 * measure how close its page is to a page that `capture_site` captured.
 * `BuilderHostToolRegistry` builds it once per build turn of a web app.
 * It reads the capture folder and the screenshot from the sandbox, compares
 * them with `diffCloneBands`, and writes the diff images back. It is free.
 */
import { posix } from "node:path";

import {
	type CompareCloneHostToolInput,
	type CompareCloneHostToolOutput,
	compareCloneHostToolInputSchema,
	type SiteCaptureManifest,
	siteCaptureManifestSchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../domain/ports/host-tools";
import type {
	SandboxFile,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import {
	CLONE_BAND_PASS_PERCENT,
	CLONE_CAPTURE_ROOT_DIR,
	cloneFileNumberOf,
} from "../../domain/site-clone";
import { diffCloneBands } from "../../infrastructure/site-clone/band-images";

/** The tool name that the registry and the clone rules of `site-clone.ts` share. */
export const COMPARE_CLONE_TOOL_NAME = "compare_clone";

/**
 * Hard cap of `compare_clone` calls in one builder turn. The clone rules ask
 * for 4 desktop and 3 mobile calls. The cap stops an endless fix loop.
 */
export const BUILDER_MAX_CLONE_COMPARES_PER_TURN = 8;

// The image types that `agent-browser screenshot` can write.
const SCREENSHOT_EXTENSION = /\.(?:jpe?g|png)$/;
// 20 MB. A full-page JPEG of a long page has some MB. The task process holds each file in memory.
const SCREENSHOT_MAX_BYTES = 20 * 1024 * 1024;
// 6 reads at a time: the 24 bands of a mobile capture take 4 rounds, and the sandbox API gets no burst.
const BAND_READS_AT_ONCE = 6;

// Security check: `readFile` loads the full file into the task process. A huge file, or a device
// such as /dev/zero behind a symlink, stops the worker. So the tool checks each file before the read.
// True when each path that exists is a regular file of at most SCREENSHOT_MAX_BYTES.
// A missing path prints no line: `readFile` then returns null, and the caller answers for it.
async function isEachFileSmall(
	sandbox: SandboxHandle,
	paths: string[],
): Promise<boolean> {
	// `-L` follows a symlink, as `readFile` does. "%F|%s" prints the file kind and the size in bytes.
	const result = await sandbox.exec("stat", [
		"-L",
		"-c",
		"%F|%s",
		"--",
		...paths,
	]);
	// Exit 1 means only that a path is missing. A higher code means stat did not run.
	if (result.exitCode > 1) {
		return false;
	}
	return result.stdout
		.split("\n")
		.filter((line) => line !== "")
		.every((line) => {
			const [kind, size] = line.split("|");
			return (
				(kind === "regular file" || kind === "regular empty file") &&
				Number(size) <= SCREENSHOT_MAX_BYTES
			);
		});
}

// Reads `capture.json` of one capture folder. Null means no capture: the file is absent or is not a manifest.
async function readCaptureManifest(
	sandbox: SandboxHandle,
	captureDir: string,
): Promise<SiteCaptureManifest | null> {
	const bytes = await sandbox.readFile(`${captureDir}/capture.json`);
	if (bytes === null) {
		return null;
	}
	let json: unknown;
	try {
		json = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		// The agent can write this file. A text that is not JSON is the same as no capture.
		return null;
	}
	const manifest = siteCaptureManifestSchema.safeParse(json);
	return manifest.success ? manifest.data : null;
}

/**
 * Builds the AI SDK tool the harness sees. The call counter is a closure
 * here because the registry calls this factory once per turn. A bad input
 * and a sandbox failure answer `failed`. The tool never throws.
 */
export function createCompareCloneTool(
	deps: { logger: Pick<Console, "info" | "warn"> },
	context: HostToolContext,
): Tool<CompareCloneHostToolInput, CompareCloneHostToolOutput> {
	let compareSequence = 0;

	return tool({
		description:
			"Compare a full-page screenshot of your preview with the captured " +
			"page. First save the screenshot under /tmp with `agent-browser " +
			"screenshot --full`. Returns the mismatch percent of each band. For " +
			`each band above ${CLONE_BAND_PASS_PERCENT} %, it writes an image of ` +
			"your band with the different pixels in red. Free. Max " +
			`${BUILDER_MAX_CLONE_COMPARES_PER_TURN} calls per turn.`,
		inputSchema: compareCloneHostToolInputSchema,
		execute: async ({
			captureId,
			screenshotPath,
			viewport,
		}): Promise<CompareCloneHostToolOutput> => {
			const startedAt = Date.now();
			const finish = (
				output: CompareCloneHostToolOutput,
			): CompareCloneHostToolOutput => {
				deps.logger.info("host-tool.compare_clone", {
					durationMs: Date.now() - startedAt,
					status: output.status,
					turnId: context.turnId,
					viewport,
					worstPercent:
						output.status === "compared" ? output.worstPercent : null,
				});
				return output;
			};
			const fail = (message: string): CompareCloneHostToolOutput =>
				finish({ message, status: "failed" });

			// Security check: the host reads this file, so the agent must not name a project file.
			// `normalize` resolves each ".." segment, so a path that starts with /tmp/ after it stays in /tmp.
			const clonePath = posix.normalize(screenshotPath);
			if (
				!clonePath.startsWith("/tmp/") ||
				!SCREENSHOT_EXTENSION.test(clonePath)
			) {
				return fail(
					"screenshotPath must be a .jpg, .jpeg, or .png file under /tmp.",
				);
			}

			if (compareSequence >= BUILDER_MAX_CLONE_COMPARES_PER_TURN) {
				return fail(
					`Compare budget exhausted (${BUILDER_MAX_CLONE_COMPARES_PER_TURN} per turn)`,
				);
			}
			// The tool calls of one step run at the same time. Each call takes its slot
			// before the first await, so they cannot pass the cap together.
			compareSequence += 1;
			const callsLeft = BUILDER_MAX_CLONE_COMPARES_PER_TURN - compareSequence;

			// The input schema permits only 16 hex chars in `captureId`, so this path stays in the folder.
			const captureDir = `${CLONE_CAPTURE_ROOT_DIR}/${captureId}`;
			const sourcePathOf = (band: number) =>
				`${captureDir}/${viewport}/${cloneFileNumberOf(band)}.jpg`;

			try {
				if (
					!(await isEachFileSmall(context.sandbox, [
						`${captureDir}/capture.json`,
						clonePath,
					]))
				) {
					return fail(
						"The screenshot or capture.json is above 20 MB or is not a file. Save the screenshot as a JPEG of quality 80.",
					);
				}
				const manifest = await readCaptureManifest(context.sandbox, captureDir);
				if (manifest === null) {
					return fail("No capture with this id. Call capture_site first.");
				}
				const source = manifest[viewport];
				// `capture_site` keeps a capture whose mobile screenshot failed.
				if (source === null) {
					return fail(
						"This capture has no mobile bands. Compare the desktop viewport only.",
					);
				}

				const cloneScreenshot = await context.sandbox.readFile(clonePath);
				if (cloneScreenshot === null) {
					return fail(
						`No file at ${clonePath}. Save the screenshot there first.`,
					);
				}

				const sourcePaths = Array.from(
					{ length: source.bandCount },
					(_, index) => sourcePathOf(index + 1),
				);
				// The agent can replace a band file, so the bands get the same check.
				if (!(await isEachFileSmall(context.sandbox, sourcePaths))) {
					return fail(
						"A band file of the capture is above 20 MB or is not a file. Call capture_site again.",
					);
				}
				const sourceBands: Uint8Array[] = [];
				for (
					let start = 0;
					start < sourcePaths.length;
					start += BAND_READS_AT_ONCE
				) {
					const bandFiles = await Promise.all(
						sourcePaths
							.slice(start, start + BAND_READS_AT_ONCE)
							.map((path) => context.sandbox.readFile(path)),
					);
					for (const bandFile of bandFiles) {
						// The agent can delete a file of the capture folder.
						if (bandFile === null) {
							return fail(
								"A band file of the capture is missing. Call capture_site again.",
							);
						}
						sourceBands.push(bandFile);
					}
				}

				let diff: Awaited<ReturnType<typeof diffCloneBands>>;
				try {
					diff = await diffCloneBands(sourceBands, cloneScreenshot, viewport);
				} catch (error) {
					// sharp throws on a file that is not an image. The agent wrote the file, so the agent hears it.
					deps.logger.warn("host-tool.compare_clone.unreadable-image", {
						message: getErrorMessage(error),
						turnId: context.turnId,
					});
					return fail("The screenshot is not a readable image.");
				}

				const diffFiles: SandboxFile[] = [];
				const bands = diff.bands.map(
					({ diffImage, mismatchPercent }, index) => {
						const band = index + 1;
						let diffPath: string | null = null;
						if (diffImage !== null) {
							diffPath = `${captureDir}/diff/${viewport}-${cloneFileNumberOf(band)}.jpg`;
							diffFiles.push({ content: diffImage, path: diffPath });
						}
						return {
							band,
							diffPath,
							mismatchPercent,
							sourcePath: sourcePathOf(band),
						};
					},
				);
				if (diffFiles.length > 0) {
					await context.sandbox.writeFiles(diffFiles);
				}

				return finish({
					bands,
					callsLeft,
					cloneHeightCssPx: diff.cloneHeightCssPx,
					passed: bands.every(
						(band) => band.mismatchPercent <= CLONE_BAND_PASS_PERCENT,
					),
					sourceHeightCssPx: source.pageHeightCssPx,
					status: "compared",
					viewport,
					worstPercent: Math.max(...bands.map((band) => band.mismatchPercent)),
				});
			} catch (error) {
				// A sandbox read or write failed. Nothing is half done: a later call writes the diff files again.
				deps.logger.warn("host-tool.compare_clone.sandbox-failed", {
					message: getErrorMessage(error),
					turnId: context.turnId,
				});
				return fail("The sandbox did not answer. Try once more.");
			}
		},
	});
}
